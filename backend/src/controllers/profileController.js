const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { emitirToken } = require('../services/sesion');
const {
  EMAIL_REGEX, PASSWORD_REGEX, MENSAJE_PASSWORD_DEBIL, USERNAME_REGEX, MENSAJE_USERNAME, SALT_ROUNDS,
  SEXOS, TEXTOS_PERFIL, MENSAJE_SEXO, MENSAJE_FECHA_NACIMIENTO, PAISES, MENSAJE_PAIS, MENSAJE_TELEFONO,
  limpiarTextoPerfil, limpiarTelefono, fechaNacimientoValida,
} = require('../config/validacion');

// La foto llega como data URL: solo admito imágenes de estos tipos en base64
const avatarRegex = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const AVATAR_MAX_CARACTERES = 200000;

// Columnas del usuario que se pueden enseñar (nunca password_hash).
// `age` no es una columna: se calcula con la fecha de nacimiento cada vez (guardar la
// edad en sí la dejaría desfasada cada cumpleaños). Esta fecha tampoco se enseña a nadie
// más que a su dueño: hoy GET /profile solo devuelve el perfil propio.
const COLUMNAS_PUBLICAS = `id, username, email, bio, avatar, created_at,
  first_name, last_name, birth_date, gender, location, country, phone,
  EXTRACT(YEAR FROM age(birth_date))::int AS age`;

// Comparo la contraseña enviada con el hash guardado. Si la contraseña es
// incorrecta respondo yo mismo y devuelvo false para que el controlador pare.
// Uso 403 y no 401: el frontend entiende un 401 como "sesión caducada" y
// cerraría la sesión, y aquí la sesión está bien, solo se ha escrito mal la clave.
async function contrasenaCorrecta(userId, password, res) {
  if (typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'Introduce tu contraseña actual' });
    return false;
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

  if (result.rows.length === 0) {
    // El token es válido pero la cuenta ya no existe (por ejemplo, se borró)
    res.status(401).json({ error: 'La cuenta no existe' });
    return false;
  }

  const coincide = await bcrypt.compare(password, result.rows[0].password_hash);

  if (!coincide) {
    res.status(403).json({ error: 'La contraseña actual no es correcta' });
    return false;
  }

  return true;
}

// GET /profile — datos del usuario autenticado
async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'La cuenta no existe' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error en getProfile:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /profile/stats — estadísticas de la biblioteca del usuario
async function getStats(req, res) {
  const userId = req.user.id;

  try {
    // Un solo recorrido de la tabla: COUNT(*) FILTER (WHERE ...) cuenta solo las
    // filas que cumplen la condición. AVG ignora los NULL (juegos sin nota).
    // Los COUNT llegan como bigint y pg los entrega como texto, por eso ::int.
    const resumen = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'jugando')::int AS jugando,
              COUNT(*) FILTER (WHERE status = 'completado')::int AS completado,
              COUNT(*) FILTER (WHERE status = 'abandonado')::int AS abandonado,
              COUNT(*) FILTER (WHERE status = 'pendiente')::int AS pendiente,
              COUNT(rating)::int AS valorados,
              ROUND(AVG(rating), 1)::float AS nota_media
       FROM user_games
       WHERE user_id = $1`,
      [userId]
    );

    const mejores = await pool.query(
      `SELECT id, igdb_id, name, cover_url, rating
       FROM user_games
       WHERE user_id = $1 AND rating IS NOT NULL
       ORDER BY rating DESC, updated_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({ stats: resumen.rows[0], mejores: mejores.rows });
  } catch (err) {
    console.error('Error en getStats:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PATCH /profile — cambiar nombre de usuario, bio, foto y datos personales (nombre,
// apellidos, fecha de nacimiento, sexo, localización, país y teléfono)
// Todos los campos son opcionales: solo se tocan los que llegan. Campo ausente = no lo
// toco; null (o texto vacío) = lo borro, salvo el nombre de usuario, que es obligatorio.
async function updateProfile(req, res) {
  const { username, bio, avatar, birth_date, gender, country, phone } = req.body;

  // Igual que en updateGame: campo ausente = no lo toco; null = lo borro
  const has = (field) => Object.prototype.hasOwnProperty.call(req.body, field);

  // Columna -> valor ya validado, de lo que se va a cambiar
  const cambios = {};

  if (has('username')) {
    if (typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
    }
    // Sin recortar: el formulario ya manda el nombre listo (minúsculas, sin espacios)
    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({ error: MENSAJE_USERNAME });
    }
    cambios.username = username;
  }

  if (has('bio')) {
    if (bio !== null && (typeof bio !== 'string' || bio.length > 300)) {
      return res.status(400).json({ error: 'La bio no puede pasar de 300 caracteres' });
    }
    // Una bio vacía o solo con espacios se guarda como NULL
    cambios.bio = typeof bio === 'string' ? bio.trim() || null : null;
  }

  if (has('avatar')) {
    if (avatar !== null) {
      if (typeof avatar !== 'string' || avatar.length > AVATAR_MAX_CARACTERES || !avatarRegex.test(avatar)) {
        return res.status(400).json({ error: 'La foto no es válida (JPG, PNG o WebP, tamaño reducido)' });
      }
    }
    cambios.avatar = avatar;
  }

  // Nombre, apellidos y localización: texto libre y corto
  for (const campo of Object.keys(TEXTOS_PERFIL)) {
    if (!has(campo)) continue;
    const limpio = limpiarTextoPerfil(campo, req.body[campo]);
    if (limpio === undefined) {
      return res.status(400).json({ error: TEXTOS_PERFIL[campo].mensaje });
    }
    cambios[campo] = limpio;
  }

  if (has('birth_date')) {
    if (birth_date !== null && (typeof birth_date !== 'string' || !fechaNacimientoValida(birth_date))) {
      return res.status(400).json({ error: MENSAJE_FECHA_NACIMIENTO });
    }
    cambios.birth_date = birth_date;
  }

  if (has('gender')) {
    if (gender !== null && !SEXOS.includes(gender)) {
      return res.status(400).json({ error: MENSAJE_SEXO });
    }
    cambios.gender = gender;
  }

  if (has('country')) {
    // El código tal cual (mayúsculas, dos letras) y de la lista: no lo "arreglo"
    if (country !== null && !PAISES.includes(country)) {
      return res.status(400).json({ error: MENSAJE_PAIS });
    }
    cambios.country = country;
  }

  if (has('phone')) {
    const limpio = limpiarTelefono(phone);
    if (limpio === undefined) {
      return res.status(400).json({ error: MENSAJE_TELEFONO });
    }
    cambios.phone = limpio;
  }

  try {
    const columnas = Object.keys(cambios);
    let result;

    if (columnas.length === 0) {
      // Nada que cambiar: devuelvo el perfil tal cual
      result = await pool.query(`SELECT ${COLUMNAS_PUBLICAS} FROM users WHERE id = $1`, [req.user.id]);
    } else {
      // Los nombres de columna salen de las claves de `cambios`, que pone este mismo
      // código (nunca el cuerpo de la petición tal cual); los valores van como parámetros
      const asignaciones = columnas.map((columna, i) => `${columna} = $${i + 1}`).join(', ');
      result = await pool.query(
        `UPDATE users SET ${asignaciones} WHERE id = $${columnas.length + 1}
         RETURNING ${COLUMNAS_PUBLICAS}`,
        [...columnas.map((columna) => cambios[columna]), req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'La cuenta no existe' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      // Salta el UNIQUE de username
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }
    console.error('Error en updateProfile:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PATCH /profile/email — cambiar el email (pide la contraseña actual)
async function updateEmail(req, res) {
  const { email, current_password } = req.body;

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'El email no tiene un formato válido' });
  }

  try {
    if (!(await contrasenaCorrecta(req.user.id, current_password, res))) return;

    const result = await pool.query(
      `UPDATE users SET email = $1 WHERE id = $2 RETURNING ${COLUMNAS_PUBLICAS}`,
      [email, req.user.id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese email ya está en uso' });
    }
    console.error('Error en updateEmail:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PATCH /profile/password — cambiar la contraseña (pide la actual)
async function updatePassword(req, res) {
  const { current_password, new_password } = req.body;

  if (typeof new_password !== 'string' || !PASSWORD_REGEX.test(new_password)) {
    return res.status(400).json({ error: MENSAJE_PASSWORD_DEBIL });
  }

  try {
    if (!(await contrasenaCorrecta(req.user.id, current_password, res))) return;

    // Subo token_version: las demás sesiones abiertas (otro ordenador, otro navegador)
    // dejan de valer. La de quien lo está haciendo recibe un token nuevo para no
    // echarla a ella también.
    const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1
        WHERE id = $2
        RETURNING id, username, token_version`,
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Contraseña actualizada', token: emitirToken(result.rows[0]) });
  } catch (err) {
    console.error('Error en updatePassword:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /profile — borrar la cuenta (pide la contraseña)
async function deleteAccount(req, res) {
  const { password } = req.body;

  try {
    if (!(await contrasenaCorrecta(req.user.id, password, res))) return;

    // ON DELETE CASCADE (ver schema.sql) borra también todos sus juegos
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);

    res.json({ message: 'Cuenta eliminada' });
  } catch (err) {
    console.error('Error en deleteAccount:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { getProfile, getStats, updateProfile, updateEmail, updatePassword, deleteAccount };

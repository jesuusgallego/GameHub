const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const {
  MINUTOS_VALIDEZ, MAX_INTENTOS, ESPERA_SEGUNDOS,
  generarCodigo, huellaDelCodigo, codigoCorrecto,
} = require('../services/recuperacion');
const { enviarCodigoRecuperacion } = require('../services/correoService');

const SALT_ROUNDS = 10;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// POST /auth/register
async function register(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // Compruebo antes de insertar para poder avisar con un 409 claro
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El email o username ya está en uso' });
    }

    // Nunca guardo la contraseña: solo su hash con bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error en register:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Si falla el email o la contraseña doy el mismo error, para no revelar qué emails están registrados
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // El token lleva el id y el nombre del usuario y caduca a los 7 días
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /auth/forgot-password — pide un código por correo para restablecer la contraseña
// Respondo SIEMPRE lo mismo, exista o no el email: si no, esta ruta serviría para
// averiguar qué emails tienen cuenta (como en login, que da el mismo error en los dos
// casos). Por la misma razón el correo se envía sin esperarlo: esperar haría esta
// respuesta más lenta cuando la cuenta existe, y eso también delataría.
async function forgotPassword(req, res) {
  const { email, idioma } = req.body;

  if (typeof email !== 'string' || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'El email no tiene un formato válido' });
  }

  try {
    const result = await pool.query('SELECT id, username FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user) {
      const codigo = generarCodigo();

      // Guardo la huella del código. Si ya había uno, lo sustituyo SOLO si pasó la
      // espera (WHERE del DO UPDATE); si no, rowCount es 0 y no envío nada. Así nadie
      // puede llenar de correos a una persona pidiendo códigos sin parar.
      const guardado = await pool.query(
        `INSERT INTO password_resets (user_id, code_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 minute'))
         ON CONFLICT (user_id) DO UPDATE
           SET code_hash = EXCLUDED.code_hash,
               expires_at = EXCLUDED.expires_at,
               attempts = 0,
               created_at = NOW()
           WHERE password_resets.created_at < NOW() - ($4::int * INTERVAL '1 second')`,
        [user.id, huellaDelCodigo(user.id, codigo), MINUTOS_VALIDEZ, ESPERA_SEGUNDOS]
      );

      if (guardado.rowCount > 0) {
        enviarCodigoRecuperacion({
          para: email,
          username: user.username,
          codigo,
          minutos: MINUTOS_VALIDEZ,
          idioma,
        }).catch((err) => console.error('No se pudo enviar el correo de recuperación:', err.message));
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en forgotPassword:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /auth/reset-password — cambia la contraseña con el código recibido por correo
async function resetPassword(req, res) {
  const { email, code, new_password } = req.body;

  if (typeof email !== 'string' || typeof code !== 'string' || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!passwordRegex.test(new_password)) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
    });
  }

  // Un solo mensaje para todo lo que puede ir mal (no hay código, caducó, se agotaron
  // los intentos, es otro código): distinguirlos ayudaría a quien intenta adivinarlo.
  const CODIGO_INVALIDO = 'El código no es válido o ha caducado';

  try {
    // Gasto un intento ANTES de comprobar el código, en la misma sentencia que lo
    // busca. Si primero comprobara y luego contara, 1.000 peticiones simultáneas
    // podrían probar 1.000 códigos antes de que ninguna sumase su intento.
    const vigente = await pool.query(
      `UPDATE password_resets pr
          SET attempts = pr.attempts + 1
         FROM users u
        WHERE u.id = pr.user_id
          AND u.email = $1
          AND pr.expires_at > NOW()
          AND pr.attempts < $2
        RETURNING pr.user_id, pr.code_hash`,
      [email, MAX_INTENTOS]
    );

    const fila = vigente.rows[0];

    if (!fila || !codigoCorrecto(fila.user_id, code, fila.code_hash)) {
      return res.status(400).json({ error: CODIGO_INVALIDO });
    }

    // Cambio la contraseña y borro el código en una sola sentencia (atómica): un
    // código sirve una única vez.
    const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.query(
      `WITH usado AS (DELETE FROM password_resets WHERE user_id = $1)
       UPDATE users SET password_hash = $2 WHERE id = $1`,
      [fila.user_id, passwordHash]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en resetPassword:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { register, login, forgotPassword, resetPassword };

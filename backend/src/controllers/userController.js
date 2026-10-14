const pool = require('../config/db');
const { USERNAME_REGEX } = require('../config/validacion');
const { relacionEntre, puedeVer } = require('../services/privacidad');
const { estadisticasDe } = require('../services/estadisticas');

// Quien busca o mira un perfil: las consultas devuelven, de cada persona, cómo se
// relaciona con quien pregunta ($1). Este trozo de SQL se repite en la búsqueda y en el
// perfil: une la fila de friendships entre las dos personas, esté en el sentido que esté.
const UNIR_AMISTAD = `
  LEFT JOIN friendships f
    ON (f.requester_id = $1 AND f.addressee_id = u.id)
    OR (f.requester_id = u.id AND f.addressee_id = $1)`;

// GET /users/search?q=ana — personas cuyo nombre de usuario empieza por `q`
// Solo busco por el comienzo del nombre (no "contiene"): así no se puede recorrer a toda
// la gente con una letra suelta, y q tiene que tener al menos 2 caracteres. No salen ni
// yo mismo, ni quien me ha bloqueado, ni a quien yo he bloqueado (esos están en su lista).
async function searchUsers(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  if (!/^[a-z0-9_]{2,20}$/.test(q)) {
    return res.status(400).json({ error: 'Escribe al menos 2 caracteres: letras minúsculas, números o guion bajo' });
  }

  const yo = req.user.id;

  try {
    // starts_with y no LIKE 'q%': en un LIKE el guion bajo es un comodín, y un nombre de
    // usuario puede llevarlo
    const result = await pool.query(
      `SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar, u.bio,
              f.id AS friendship_id, f.status, f.requester_id
         FROM users u
         ${UNIR_AMISTAD}
        WHERE starts_with(u.username, $2)
          AND u.id <> $1
          AND NOT EXISTS (
            SELECT 1 FROM blocks b
             WHERE (b.blocker_id = u.id AND b.blocked_id = $1)
                OR (b.blocker_id = $1 AND b.blocked_id = u.id)
          )
        ORDER BY u.username
        LIMIT 20`,
      [yo, q]
    );

    res.json({
      results: result.rows.map((u) => ({
        username: u.username,
        has_avatar: u.has_avatar,
        bio: u.bio,
        relation: relacionEntre({ esYo: false, amistad: u.status ? u : null, yo }),
        friendship_id: u.friendship_id,
      })),
    });
  } catch (err) {
    console.error('Error en searchUsers:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /users/:username — el perfil de otra persona, con solo lo que yo puedo ver
//  - Nombre de usuario, foto y bio: los ve cualquiera con sesión.
//  - Datos personales y biblioteca: según lo que haya elegido esa persona (ver
//    services/privacidad.js). El teléfono, la fecha de nacimiento y el email no salen NUNCA.
//  - Si esa persona me ha bloqueado, respondo como si no existiera (404): así no sé ni
//    que tiene cuenta. Si la he bloqueado yo, solo enseño lo mínimo para poder desbloquearla.
async function getUserProfile(req, res) {
  const nombre = req.params.username;

  // Un nombre que no cumple la regla no puede existir: ni lo busco
  if (!USERNAME_REGEX.test(nombre)) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const yo = req.user.id;

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.bio, u.created_at, (u.avatar IS NOT NULL) AS has_avatar,
              u.first_name, u.last_name, u.gender, u.location, u.country,
              EXTRACT(YEAR FROM age(u.birth_date))::int AS age,
              u.visibility_personal, u.visibility_library,
              f.id AS friendship_id, f.status, f.requester_id,
              EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id) AS blocked_by_me,
              EXISTS (SELECT 1 FROM blocks WHERE blocker_id = u.id AND blocked_id = $1) AS blocked_me
         FROM users u
         ${UNIR_AMISTAD}
        WHERE u.username = $2`,
      [yo, nombre]
    );

    const u = result.rows[0];

    if (!u || u.blocked_me) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (u.blocked_by_me) {
      return res.json({
        user: { username: u.username, has_avatar: u.has_avatar, relation: 'bloqueado', personal: null, library: null },
      });
    }

    const relation = relacionEntre({ esYo: u.id === yo, amistad: u.status ? u : null, yo });

    // Solo mando lo que se puede ver; lo demás va como null y el cliente sabe por
    // `*_level` cuál es la razón ("solo con sus amigos", "es privada")
    const personal = puedeVer(u.visibility_personal, relation)
      ? {
          first_name: u.first_name,
          last_name: u.last_name,
          age: u.age,
          gender: u.gender,
          location: u.location,
          country: u.country,
        }
      : null;

    const library = puedeVer(u.visibility_library, relation) ? await estadisticasDe(u.id) : null;

    res.json({
      user: {
        username: u.username,
        has_avatar: u.has_avatar,
        bio: u.bio,
        created_at: u.created_at,
        relation,
        friendship_id: u.friendship_id,
        personal,
        personal_level: u.visibility_personal,
        library,
        library_level: u.visibility_library,
      },
    });
  } catch (err) {
    console.error('Error en getUserProfile:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /users/:username/avatar — la foto de perfil como imagen
// Sin sesión: un <img> no puede mandar la cabecera Authorization. Es la misma foto que
// ve cualquiera que tenga cuenta (el registro es abierto), así que no revela nada nuevo.
// Sirve para no meter fotos en base64 dentro de cada lista de personas: el navegador las
// pide una a una, las guarda y solo las vuelve a pedir si han cambiado (ETag).
const AVATAR_DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/;

async function getAvatar(req, res) {
  const nombre = req.params.username;

  if (!USERNAME_REGEX.test(nombre)) return res.status(404).end();

  try {
    const result = await pool.query('SELECT avatar FROM users WHERE username = $1', [nombre]);
    const avatar = result.rows[0]?.avatar;
    const partes = avatar && AVATAR_DATA_URL.exec(avatar);

    if (!partes) return res.status(404).end();

    // "no-cache" no es "no guardar": guarda la imagen pero pregunta antes de usarla. Express
    // pone el ETag solo y contesta 304 (sin cuerpo) si no ha cambiado.
    res.set('Cache-Control', 'public, no-cache');
    res.type(partes[1]).send(Buffer.from(partes[2], 'base64'));
  } catch (err) {
    console.error('Error en getAvatar:', err);
    res.status(500).end();
  }
}

module.exports = { searchUsers, getUserProfile, getAvatar };

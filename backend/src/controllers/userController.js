const pool = require('../config/db');
const { USERNAME_REGEX } = require('../config/validacion');
const { relacionEntre, puedeVer, datosPersonalesVisibles } = require('../services/privacidad');
const { estadisticasDe } = require('../services/estadisticas');
const { amigosDe, amigosEnComun, puedeSolicitar, sinBloqueos } = require('../services/amistades');
const { ErrorSteam, getLogrosDetallados } = require('../services/steamService');
const { IDIOMAS, IDIOMA_ORIGINAL } = require('../services/traduccionService');

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
// yo mismo, ni quien me ha bloqueado, ni a quien yo he bloqueado (esos están en su lista),
// ni quien ha elegido no aparecer en las búsquedas (a no ser que ya sea mi amigo).
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
              f.id AS friendship_id, f.status, f.requester_id,
              ${puedeSolicitar('$1', 'u.id', 'u.request_policy')} AS can_request,
              ${amigosEnComun('$1', 'u.id')} AS mutual
         FROM users u
         ${UNIR_AMISTAD}
        WHERE starts_with(u.username, $2)
          AND u.id <> $1
          AND (u.searchable OR f.status = 'aceptada')
          AND ${sinBloqueos('$1')}
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
        can_request: u.can_request,
        mutual: u.mutual,
      })),
    });
  } catch (err) {
    console.error('Error en searchUsers:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Busca a una persona por su nombre y calcula cómo se relaciona con quien pregunta.
// Lo usan el perfil, su biblioteca y su lista de amigos, que empiezan igual. Devuelve:
//  - { error: 404 } si no existe o si ella me ha bloqueado (para mí no existe)
//  - { u, relation, bloqueadoPorMi } en el resto de casos
async function personaYRelacion(nombre, yo) {
  // Un nombre que no cumple la regla no puede existir: ni lo busco
  if (!USERNAME_REGEX.test(nombre)) return { error: 404 };

  const result = await pool.query(
    `SELECT u.id, u.username, u.bio, u.created_at, (u.avatar IS NOT NULL) AS has_avatar,
            u.first_name, u.last_name, u.gender, u.location, u.country,
            EXTRACT(YEAR FROM age(u.birth_date))::int AS age,
            u.visibility_name, u.visibility_age, u.visibility_gender, u.visibility_location,
            u.visibility_library, u.visibility_reviews, u.visibility_friends, u.visibility_achievements,
            u.request_policy,
            f.id AS friendship_id, f.status, f.requester_id,
            ${puedeSolicitar('$1', 'u.id', 'u.request_policy')} AS can_request,
            EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id) AS blocked_by_me,
            EXISTS (SELECT 1 FROM blocks WHERE blocker_id = u.id AND blocked_id = $1) AS blocked_me
       FROM users u
       ${UNIR_AMISTAD}
      WHERE u.username = $2`,
    [yo, nombre]
  );

  const u = result.rows[0];
  if (!u || u.blocked_me) return { error: 404 };

  return {
    u,
    bloqueadoPorMi: u.blocked_by_me,
    relation: relacionEntre({ esYo: u.id === yo, amistad: u.status ? u : null, yo }),
  };
}

// GET /users/:username — el perfil de otra persona, con solo lo que yo puedo ver
//  - Nombre de usuario, foto y bio: los ve cualquiera con sesión.
//  - Cada dato personal, la biblioteca, las reseñas y la lista de amigos: según lo que haya
//    elegido esa persona (ver services/privacidad.js). El teléfono, la fecha de nacimiento
//    y el email no salen NUNCA.
//  - Si esa persona me ha bloqueado, respondo como si no existiera (404): así no sé ni
//    que tiene cuenta. Si la he bloqueado yo, solo enseño lo mínimo para poder desbloquearla.
async function getUserProfile(req, res) {
  const yo = req.user.id;

  try {
    const { error, u, relation, bloqueadoPorMi } = await personaYRelacion(req.params.username, yo);

    if (error) return res.status(error).json({ error: 'Usuario no encontrado' });

    if (bloqueadoPorMi) {
      return res.json({
        user: { username: u.username, has_avatar: u.has_avatar, relation: 'bloqueado', personal: {}, library: null },
      });
    }

    const verBiblioteca = puedeVer(u.visibility_library, relation);
    const verAmigos = puedeVer(u.visibility_friends, relation);
    const esYo = relation === 'self';

    // Lo que depende de la relación con quien mira se calcula solo si hay algo que contar
    const [biblioteca, enComun, juegosEnComun, nAmigos] = await Promise.all([
      verBiblioteca ? estadisticasDe(u.id) : null,
      esYo ? null : amigosEnComunDe(yo, u.id),
      !esYo && verBiblioteca ? juegosEnComunCon(yo, u.id) : null,
      verAmigos ? contarAmigos(u.id, yo) : null,
    ]);

    res.json({
      user: {
        username: u.username,
        has_avatar: u.has_avatar,
        bio: u.bio,
        created_at: u.created_at,
        relation,
        friendship_id: u.friendship_id,
        can_request: u.can_request,
        personal: datosPersonalesVisibles(u, relation),
        library: biblioteca,
        library_level: u.visibility_library,
        friends_level: u.visibility_friends,
        reviews_visible: puedeVer(u.visibility_reviews, relation),
        achievements_visible: verBiblioteca && puedeVer(u.visibility_achievements, relation),
        friends_count: nAmigos,
        mutual_friends: enComun,
        games_in_common: juegosEnComun,
      },
    });
  } catch (err) {
    console.error('Error en getUserProfile:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Los amigos en común de dos personas, hasta 8 con su foto y el total. Solo cuentan los
// que no esconden su lista de amigos (ver amigosEnComun en services/amistades.js).
async function amigosEnComunDe(yo, otro) {
  const result = await pool.query(
    `SELECT m.username, (m.avatar IS NOT NULL) AS has_avatar, COUNT(*) OVER ()::int AS total
       FROM users m
      WHERE m.id IN (${amigosDe('$1')}) AND m.id IN (${amigosDe('$2')})
        AND m.visibility_friends <> 'nadie'
      ORDER BY m.username
      LIMIT 8`,
    [yo, otro]
  );

  return {
    total: result.rows[0]?.total ?? 0,
    people: result.rows.map(({ username, has_avatar }) => ({ username, has_avatar })),
  };
}

// Cuántos juegos de su biblioteca tengo yo también (mismo igdb_id)
async function juegosEnComunCon(yo, otro) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM user_games a JOIN user_games b ON b.igdb_id = a.igdb_id
      WHERE a.user_id = $1 AND b.user_id = $2`,
    [yo, otro]
  );
  return result.rows[0].n;
}

// Cuántos amigos tiene una persona, sin contar a quien me ha bloqueado ni a quien he
// bloqueado yo (esos no los veré en su lista)
async function contarAmigos(persona, yo) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users u
      WHERE u.id IN (${amigosDe('$1')}) AND ${sinBloqueos('$2')}`,
    [persona, yo]
  );
  return result.rows[0].n;
}

// GET /users/:username/games — la biblioteca de otra persona, si me deja verla
// Cada juego trae, si yo también lo tengo, mi estado y mi nota ("en común"): sirve para
// compararnos. El texto de la reseña solo sale si esa persona deja ver sus reseñas.
async function getUserGames(req, res) {
  const yo = req.user.id;

  try {
    const { error, u, relation, bloqueadoPorMi } = await personaYRelacion(req.params.username, yo);

    if (error || bloqueadoPorMi) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeVer(u.visibility_library, relation)) {
      return res.status(403).json({ error: 'Esta persona no comparte su biblioteca contigo' });
    }

    const verResenas = puedeVer(u.visibility_reviews, relation);
    const verLogros = puedeVer(u.visibility_achievements, relation);

    // Las horas y los logros solo salen si esa persona los deja ver (visibility_achievements).
    // Lo mío (my_*) es mío: sale siempre, para comparar.
    const result = await pool.query(
      `SELECT g.igdb_id, g.name, g.cover_url, g.status, g.rating, g.platform, g.updated_at,
              CASE WHEN $3 THEN g.review ELSE NULL END AS review,
              (g.review IS NOT NULL AND g.review <> '') AS has_review,
              CASE WHEN $4 THEN g.playtime_minutes END AS playtime_minutes,
              CASE WHEN $4 THEN g.achievements_unlocked END AS achievements_unlocked,
              CASE WHEN $4 THEN g.achievements_total END AS achievements_total,
              (m.id IS NOT NULL) AS in_common, m.status AS my_status, m.rating AS my_rating,
              m.playtime_minutes AS my_playtime_minutes,
              m.achievements_unlocked AS my_achievements_unlocked,
              m.achievements_total AS my_achievements_total
         FROM user_games g
         LEFT JOIN user_games m ON m.igdb_id = g.igdb_id AND m.user_id = $1 AND g.user_id <> $1
        WHERE g.user_id = $2
        ORDER BY g.updated_at DESC
        LIMIT 500`,
      [yo, u.id, verResenas, verLogros]
    );

    res.json({ games: result.rows, reviews_visible: verResenas, achievements_visible: verLogros });
  } catch (err) {
    console.error('Error en getUserGames:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /users/:username/common — lo que tengo en común con otra persona: los juegos que
// tenemos los dos (con el estado y la nota de cada uno) y los amigos que compartimos.
//  - Los juegos solo salen si esa persona me deja ver su biblioteca (si no, `games` es null).
//  - Los amigos en común salen siempre, salvo los que esconden su propia lista de amigos
//    (igual que el contador del perfil: no se deduce una amistad de que aparezca aquí).
async function getCommon(req, res) {
  const yo = req.user.id;

  try {
    const { error, u, relation, bloqueadoPorMi } = await personaYRelacion(req.params.username, yo);

    if (error || bloqueadoPorMi) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (relation === 'self') return res.status(400).json({ error: 'Es tu propio perfil' });

    const verBiblioteca = puedeVer(u.visibility_library, relation);
    const verLogros = verBiblioteca && puedeVer(u.visibility_achievements, relation);
    const verResenas = verBiblioteca && puedeVer(u.visibility_reviews, relation);

    const [juegos, amigos] = await Promise.all([
      verBiblioteca
        ? pool.query(
          `SELECT t.igdb_id, t.name, t.cover_url,
                  m.status AS my_status, m.rating AS my_rating,
                  t.status AS their_status, t.rating AS their_rating,
                  m.platform AS my_platform, t.platform AS their_platform,
                  m.playtime_minutes AS my_playtime_minutes,
                  m.achievements_unlocked AS my_achievements_unlocked,
                  m.achievements_total AS my_achievements_total,
                  CASE WHEN $3 THEN t.playtime_minutes END AS their_playtime_minutes,
                  CASE WHEN $3 THEN t.achievements_unlocked END AS their_achievements_unlocked,
                  CASE WHEN $3 THEN t.achievements_total END AS their_achievements_total,
                  CASE WHEN $4 THEN t.review END AS their_review,
                  (t.review IS NOT NULL AND t.review <> '') AS their_has_review
             FROM user_games t
             JOIN user_games m ON m.igdb_id = t.igdb_id AND m.user_id = $1
            WHERE t.user_id = $2
            ORDER BY t.name`,
          [yo, u.id, verLogros, verResenas]
        )
        : null,
      pool.query(
        `SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar, u.bio,
                f.id AS friendship_id, f.status, f.requester_id,
                COUNT(*) OVER ()::int AS total,
                CASE WHEN u.visibility_library IN ('amigos', 'todos')
                     THEN (SELECT COUNT(*)::int FROM user_games c WHERE c.user_id = u.id) END AS games_count
           FROM users u
           ${UNIR_AMISTAD}
          WHERE u.id IN (${amigosDe('$1')}) AND u.id IN (${amigosDe('$2')})
            AND u.visibility_friends <> 'nadie'
            AND ${sinBloqueos('$1')}
          ORDER BY u.username`,
        [yo, u.id]
      ),
    ]);

    res.json({
      games: juegos ? juegos.rows : null,
      achievements_visible: verLogros,
      reviews_visible: verResenas,
      friends: amigos.rows.map((p) => ({
        username: p.username,
        has_avatar: p.has_avatar,
        bio: p.bio,
        games_count: p.games_count,
        relation: relacionEntre({ esYo: false, amistad: p.status ? p : null, yo }),
        friendship_id: p.friendship_id,
        can_request: true,
      })),
    });
  } catch (err) {
    console.error('Error en getCommon:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /users/:username/games/:igdbId/achievements?lang=es — los logros de Steam de un juego
// de otra persona (los que ha conseguido y los que no), si me deja verlos.
// Hay que poder ver su biblioteca Y sus logros (visibility_achievements). La lista se pide a
// Steam con el SteamID de esa persona, igual que en mi propia ficha: no se guarda.
async function getUserGameAchievements(req, res) {
  const yo = req.user.id;

  // El id llega por la URL: solo dígitos, sin ceros delante y hasta 9 (cabe en un INTEGER).
  // Number('1e3') daría 1000, por eso compruebo el texto y no el número.
  const texto = req.params.igdbId;
  if (typeof texto !== 'string' || !/^[1-9][0-9]{0,8}$/.test(texto)) {
    return res.status(404).json({ error: 'Juego no encontrado' });
  }
  const igdbId = Number(texto);

  const lang = req.query.lang ?? IDIOMA_ORIGINAL;
  if (typeof lang !== 'string' || !IDIOMAS.includes(lang)) {
    return res.status(400).json({ error: `lang debe ser uno de: ${IDIOMAS.join(', ')}` });
  }

  try {
    const { error, u, relation, bloqueadoPorMi } = await personaYRelacion(req.params.username, yo);

    if (error || bloqueadoPorMi) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeVer(u.visibility_library, relation) || !puedeVer(u.visibility_achievements, relation)) {
      return res.status(403).json({ error: 'Esta persona no comparte sus logros contigo' });
    }

    const result = await pool.query(
      `SELECT g.steam_appid, a.external_id
         FROM user_games g
         LEFT JOIN linked_accounts a ON a.user_id = g.user_id AND a.platform = 'steam'
        WHERE g.user_id = $1 AND g.igdb_id = $2`,
      [u.id, igdbId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Juego no encontrado' });

    const { steam_appid: appid, external_id: steamId } = result.rows[0];
    if (!appid || !steamId) {
      return res.status(404).json({ error: 'Este juego no está vinculado con Steam' });
    }

    try {
      res.json({ achievements: await getLogrosDetallados(steamId, appid, lang) });
    } catch (err) {
      if (!(err instanceof ErrorSteam)) throw err;
      // Con "Detalles del juego" en privado, Steam no da los logros de esa cuenta. El mensaje
      // del servicio habla en segunda persona ("tu perfil"): aquí el perfil es de otra persona.
      if (err.status === 422) {
        return res.status(422).json({ error: 'Esta persona tiene privados sus detalles de juego en Steam' });
      }
      res.status(err.status).json({ error: err.message });
    }
  } catch (err) {
    console.error('Error en getUserGameAchievements:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /users/:username/friends — la lista de amigos de otra persona, si me deja verla
// Cada amigo sale con mi relación con él (para poder añadirle desde ahí). No salen quienes
// me han bloqueado ni a quienes he bloqueado yo.
async function getUserFriends(req, res) {
  const yo = req.user.id;

  try {
    const { error, u, relation, bloqueadoPorMi } = await personaYRelacion(req.params.username, yo);

    if (error || bloqueadoPorMi) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!puedeVer(u.visibility_friends, relation)) {
      return res.status(403).json({ error: 'Esta persona no comparte su lista de amigos contigo' });
    }

    const result = await pool.query(
      `SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar, u.bio,
              f.id AS friendship_id, f.status, f.requester_id,
              ${puedeSolicitar('$1', 'u.id', 'u.request_policy')} AS can_request,
              (u.id = $1) AS is_me,
              (u.id IN (${amigosDe('$1')})) AS mutual
         FROM users u
         ${UNIR_AMISTAD}
        WHERE u.id IN (${amigosDe('$2')})
          AND ${sinBloqueos('$1')}
        ORDER BY u.username`,
      [yo, u.id]
    );

    res.json({
      friends: result.rows.map((p) => ({
        username: p.username,
        has_avatar: p.has_avatar,
        bio: p.bio,
        relation: relacionEntre({ esYo: p.is_me, amistad: p.status ? p : null, yo }),
        friendship_id: p.friendship_id,
        can_request: p.can_request,
        mutual: p.mutual,
      })),
    });
  } catch (err) {
    console.error('Error en getUserFriends:', err);
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

module.exports = {
  searchUsers, getUserProfile, getUserGames, getUserFriends, getCommon, getUserGameAchievements, getAvatar,
};

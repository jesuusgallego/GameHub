const pool = require('../config/db');
const { USERNAME_REGEX } = require('../config/validacion');
const { amigosDe, hayAmigosEnComun, amigosEnComun, sinBloqueos } = require('../services/amistades');

// Una persona tal como la enseñan las listas
const PERSONA = `u.username, (u.avatar IS NOT NULL) AS has_avatar, u.bio`;

// Devuelve { id, username, request_policy } del usuario con ese nombre, o null. Si el nombre no cumple
// la regla ni consulto.
async function buscarUsuario(nombre) {
  if (typeof nombre !== 'string' || !USERNAME_REGEX.test(nombre)) return null;
  const result = await pool.query('SELECT id, username, request_policy FROM users WHERE username = $1', [nombre]);
  return result.rows[0] ?? null;
}

// La fila de friendships entre dos personas (en cualquier sentido), o undefined
async function amistadEntre(a, b) {
  const result = await pool.query(
    `SELECT id, status, requester_id FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [a, b]
  );
  return result.rows[0];
}

function errorInterno(res, nombre, err) {
  console.error(`Error en ${nombre}:`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

// GET /friends — mis amigos, por orden alfabético
// Cada uno trae, si deja ver su biblioteca a sus amigos: cuántos juegos tiene, cuántos ha
// completado, su nota media, cuántos juegos tenemos en común y a qué está jugando ahora (su
// juego "jugando" más reciente, y desde cuándo). Como ya somos amigos, la regla es que su
// nivel sea 'amigos' o 'todos'. `mutual` son los amigos que compartimos.
async function listFriends(req, res) {
  try {
    const result = await pool.query(
      `SELECT ${PERSONA}, f.responded_at AS since,
              s.n AS games_count, s.completed AS completed_count, s.avg_rating,
              CASE WHEN u.visibility_library IN ('amigos', 'todos')
                   THEN (SELECT COUNT(*)::int FROM user_games a
                           JOIN user_games b ON b.igdb_id = a.igdb_id
                          WHERE a.user_id = $1 AND b.user_id = u.id) END AS games_in_common,
              ${amigosEnComun('$1', 'u.id')} AS mutual,
              p.igdb_id AS playing_id, p.name AS playing_name, p.cover_url AS playing_cover,
              p.updated_at AS playing_since
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS n,
                  COUNT(*) FILTER (WHERE c.status = 'completado')::int AS completed,
                  ROUND(AVG(c.rating)::numeric, 1)::float AS avg_rating
             FROM user_games c
            WHERE c.user_id = u.id AND u.visibility_library IN ('amigos', 'todos')
         ) s ON u.visibility_library IN ('amigos', 'todos')
         LEFT JOIN LATERAL (
           SELECT g.igdb_id, g.name, g.cover_url, g.updated_at FROM user_games g
            WHERE g.user_id = u.id AND g.status = 'jugando'
              AND u.visibility_library IN ('amigos', 'todos')
            ORDER BY g.updated_at DESC LIMIT 1
         ) p ON TRUE
        WHERE f.status = 'aceptada' AND (f.requester_id = $1 OR f.addressee_id = $1)
        ORDER BY u.username`,
      [req.user.id]
    );

    res.json({
      friends: result.rows.map(({ playing_id, playing_name, playing_cover, playing_since, ...amigo }) => ({
        ...amigo,
        playing: playing_name
          ? { igdb_id: playing_id, name: playing_name, cover_url: playing_cover, since: playing_since }
          : null,
      })),
    });
  } catch (err) {
    errorInterno(res, 'listFriends', err);
  }
}

// GET /friends/activity — lo último que han hecho mis amigos en su biblioteca
// No hay una tabla de eventos: salen de los propios juegos. Un juego es un movimiento
// cuando lo añadió la persona o lo editó después; los que entraron de golpe al importar
// Steam no cuentan (serían cientos de "ha añadido..." de una vez). Solo salen amigos que
// dejan ver su biblioteca.
async function listActivity(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar,
              g.igdb_id, g.name, g.cover_url, g.status, g.rating, g.updated_at,
              (g.updated_at = g.created_at) AS added
         FROM user_games g
         JOIN users u ON u.id = g.user_id
        WHERE u.id IN (${amigosDe('$1')})
          AND u.visibility_library IN ('amigos', 'todos')
          AND (g.imported_from IS NULL OR g.updated_at > g.created_at)
        ORDER BY g.updated_at DESC
        LIMIT 30`,
      [req.user.id]
    );
    res.json({ activity: result.rows });
  } catch (err) {
    errorInterno(res, 'listActivity', err);
  }
}

// GET /friends/suggestions — personas que quizá conozcas: amigos de mis amigos
// Ordenadas por cuántos amigos tenemos en común. No salen: yo, mis amigos, quien ya tiene
// una solicitud conmigo (en un sentido u otro), bloqueos, quien no quiere aparecer en las
// búsquedas ni quien no acepta solicitudes. Y un amigo mío solo cuenta como "puente" si no
// esconde su lista de amigos.
async function listSuggestions(req, res) {
  try {
    const result = await pool.query(
      `WITH mis(id) AS (${amigosDe('$1')})
       SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar, u.bio, COUNT(*)::int AS mutual
         FROM mis
         JOIN users x ON x.id = mis.id AND x.visibility_friends <> 'nadie'
         JOIN friendships f ON f.status = 'aceptada' AND (f.requester_id = x.id OR f.addressee_id = x.id)
         JOIN users u ON u.id = CASE WHEN f.requester_id = x.id THEN f.addressee_id ELSE f.requester_id END
        WHERE u.id <> $1
          AND u.id NOT IN (SELECT id FROM mis)
          AND u.searchable
          AND u.request_policy <> 'nadie'
          AND NOT EXISTS (
            SELECT 1 FROM friendships y
             WHERE (y.requester_id = $1 AND y.addressee_id = u.id)
                OR (y.requester_id = u.id AND y.addressee_id = $1)
          )
          AND ${sinBloqueos('$1')}
        GROUP BY u.id
        ORDER BY mutual DESC, u.username
        LIMIT 12`,
      [req.user.id]
    );
    res.json({ suggestions: result.rows });
  } catch (err) {
    errorInterno(res, 'listSuggestions', err);
  }
}

// GET /friends/requests — solicitudes pendientes: las que me han enviado y las que envié
async function listRequests(req, res) {
  try {
    const result = await pool.query(
      `SELECT f.id, ${PERSONA}, f.created_at, (f.requester_id = $1) AS sent
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
        WHERE f.status = 'pendiente' AND (f.requester_id = $1 OR f.addressee_id = $1)
        ORDER BY f.created_at DESC`,
      [req.user.id]
    );

    res.json({
      received: result.rows.filter((r) => !r.sent).map(({ sent, ...r }) => r),
      sent: result.rows.filter((r) => r.sent).map(({ sent, ...r }) => r),
    });
  } catch (err) {
    errorInterno(res, 'listRequests', err);
  }
}

// GET /friends/requests/count — cuántas solicitudes tengo sin responder. Es la consulta de
// la insignia de la barra, que la interfaz repite cada minuto mientras se usa la app (ver
// frontend/src/sondeo.js): por eso es solo un número, sin las personas ni sus fotos, y usa
// el índice (addressee_id, status).
async function countRequests(req, res) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS received
         FROM friendships
        WHERE addressee_id = $1 AND status = 'pendiente'`,
      [req.user.id]
    );

    res.json({ received: result.rows[0].received });
  } catch (err) {
    errorInterno(res, 'countRequests', err);
  }
}

// POST /friends/requests { username } — enviar una solicitud de amistad
// Si esa persona ya me había enviado una, no hay nada que esperar: las dos quieren, y se
// acepta en el acto.
async function sendRequest(req, res) {
  const yo = req.user.id;

  try {
    if (typeof req.body.username !== 'string' || req.body.username === '') {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const otro = await buscarUsuario(req.body.username);

    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (otro.id === yo) {
      return res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo' });
    }

    const bloqueos = await pool.query(
      `SELECT blocker_id FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [yo, otro.id]
    );

    // Si me ha bloqueado, no sé ni que existe (igual que al mirar su perfil)
    if (bloqueos.rows.some((b) => b.blocker_id === otro.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (bloqueos.rows.length > 0) {
      return res.status(409).json({ error: 'Has bloqueado a este usuario: desbloquéalo para enviarle una solicitud' });
    }

    const existente = await amistadEntre(yo, otro.id);
    // (la política de solicitudes se mira más abajo: si esa persona ya me había pedido
    // amistad a mí, da igual lo que tenga elegido: ya ha dicho que sí)

    if (existente) {
      if (existente.status === 'aceptada') {
        return res.status(409).json({ error: 'Ya sois amigos' });
      }
      if (existente.requester_id === yo) {
        return res.status(409).json({ error: 'Ya le has enviado una solicitud a este usuario' });
      }

      // Me había enviado ella una solicitud: la acepto
      await pool.query(
        `UPDATE friendships SET status = 'aceptada', responded_at = NOW() WHERE id = $1`,
        [existente.id]
      );
      return res.json({ relation: 'amigos', friendship_id: existente.id });
    }

    // Quién puede enviarme solicitudes: lo elige cada persona en su privacidad
    if (otro.request_policy === 'nadie') {
      return res.status(403).json({ error: 'Esta persona no acepta solicitudes de amistad' });
    }
    if (otro.request_policy === 'amigos_de_amigos') {
      const comun = await pool.query(`SELECT ${hayAmigosEnComun('$1', '$2')} AS ok`, [yo, otro.id]);
      if (!comun.rows[0].ok) {
        return res.status(403).json({ error: 'Esta persona solo acepta solicitudes de amigos de sus amigos' });
      }
    }

    const creada = await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) RETURNING id`,
      [yo, otro.id]
    );

    res.status(201).json({ relation: 'enviada', friendship_id: creada.rows[0].id });
  } catch (err) {
    // Dos solicitudes a la vez entre las mismas personas: gana la primera (índice único)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una solicitud entre vosotros' });
    }
    errorInterno(res, 'sendRequest', err);
  }
}

// El id de una solicitud llega por la URL: solo dígitos, sin ceros delante y de hasta 9
// (cabe de sobra en el INTEGER de Postgres). Number('1e3') daría 1000: por eso no me
// fío de Number() y compruebo el texto.
function idDeSolicitud(req) {
  const texto = req.params.id;
  return typeof texto === 'string' && /^[1-9][0-9]{0,8}$/.test(texto) ? Number(texto) : null;
}

// POST /friends/requests/:id/accept — aceptar una solicitud que me han enviado
// Solo quien la recibió puede aceptarla (addressee_id): con el id de otra solicitud no
// pasa nada, igual que si no existiera.
async function acceptRequest(req, res) {
  const id = idDeSolicitud(req);
  if (!id) return res.status(404).json({ error: 'Solicitud no encontrada' });

  try {
    const result = await pool.query(
      `UPDATE friendships SET status = 'aceptada', responded_at = NOW()
        WHERE id = $1 AND addressee_id = $2 AND status = 'pendiente'
        RETURNING id`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ relation: 'amigos', friendship_id: id });
  } catch (err) {
    errorInterno(res, 'acceptRequest', err);
  }
}

// DELETE /friends/requests/:id — rechazar una solicitud recibida o cancelar una enviada
async function deleteRequest(req, res) {
  const id = idDeSolicitud(req);
  if (!id) return res.status(404).json({ error: 'Solicitud no encontrada' });

  try {
    const result = await pool.query(
      `DELETE FROM friendships
        WHERE id = $1 AND status = 'pendiente' AND (addressee_id = $2 OR requester_id = $2)`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ relation: 'ninguna' });
  } catch (err) {
    errorInterno(res, 'deleteRequest', err);
  }
}

// DELETE /friends/:username — dejar de ser amigos
async function removeFriend(req, res) {
  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });

    const result = await pool.query(
      `DELETE FROM friendships
        WHERE status = 'aceptada'
          AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [req.user.id, otro.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'No sois amigos' });
    res.json({ relation: 'ninguna' });
  } catch (err) {
    errorInterno(res, 'removeFriend', err);
  }
}

// GET /friends/blocks — a quién he bloqueado
async function listBlocks(req, res) {
  try {
    const result = await pool.query(
      `SELECT ${PERSONA}, b.created_at
         FROM blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY u.username`,
      [req.user.id]
    );
    res.json({ blocks: result.rows });
  } catch (err) {
    errorInterno(res, 'listBlocks', err);
  }
}

// POST /friends/blocks { username } — bloquear a alguien
// Una sola sentencia con dos pasos (WITH): apunta el bloqueo y borra la amistad o
// solicitud que hubiera entre los dos. Se hacen juntos o no se hace ninguno.
async function blockUser(req, res) {
  try {
    const otro = await buscarUsuario(req.body.username);
    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (otro.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
    }

    await pool.query(
      `WITH bloqueo AS (
         INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
       )
       DELETE FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user.id, otro.id]
    );

    res.status(201).json({ relation: 'bloqueado' });
  } catch (err) {
    errorInterno(res, 'blockUser', err);
  }
}

// DELETE /friends/blocks/:username — quitar un bloqueo (no devuelve la amistad)
async function unblockUser(req, res) {
  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });

    await pool.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user.id, otro.id]);
    res.json({ relation: 'ninguna' });
  } catch (err) {
    errorInterno(res, 'unblockUser', err);
  }
}

module.exports = {
  listFriends, listActivity, listSuggestions, listRequests, countRequests, sendRequest, acceptRequest, deleteRequest,
  removeFriend, listBlocks, blockUser, unblockUser,
};

const pool = require('../config/db');
const { USERNAME_REGEX, MENSAJE_CHAT_INVALIDO } = require('../config/validacion');
const { sinBloqueos } = require('../services/amistades');
const escribiendo = require('../services/escribiendo');
const {
  PAGINA, VENTANA_BORRADOS, errorInterno, entero, leerPaginacion, limpiarMensaje, sigueEscribiendo,
} = require('../services/chatComun');
const { gruposDe, sinLeerEnGrupos } = require('./gruposController');

// Devuelve { id, username, has_avatar } del usuario con ese nombre, o null. Si el nombre no
// cumple la regla ni consulto.
async function buscarUsuario(nombre) {
  if (typeof nombre !== 'string' || !USERNAME_REGEX.test(nombre)) return null;
  const result = await pool.query(
    'SELECT id, username, (avatar IS NOT NULL) AS has_avatar FROM users WHERE username = $1',
    [nombre]
  );
  return result.rows[0] ?? null;
}

// Si alguna de las dos personas ha bloqueado a la otra. Con un bloqueo de por medio la
// conversación no existe para ninguna de las dos (igual que el perfil: ver friendController).
async function hayBloqueo(a, b) {
  const result = await pool.query(
    `SELECT 1 FROM blocks
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [a, b]
  );
  return result.rows.length > 0;
}

// La pareja de personas de un mensaje, en cualquier sentido: es lo que usa el índice
// idx_messages_pareja. `m` es el alias de la tabla messages; a y b, los dos ids (SQL). Los
// ::int son necesarios: LEAST de dos parámetros sin tipo ($1, $2) se interpreta como texto y
// Postgres no sabe comparar un entero con un texto.
function entre(m, a, b) {
  return `LEAST(${m}.sender_id, ${m}.recipient_id) = LEAST(${a}::int, ${b}::int)
      AND GREATEST(${m}.sender_id, ${m}.recipient_id) = GREATEST(${a}::int, ${b}::int)`;
}

// El mensaje tal como lo ve el cliente. Lo borrado no lleva texto. `read_at` solo se manda en
// los míos: es el "visto", y a quien recibe no le sirve.
function aMensaje(fila) {
  const borrado = fila.deleted_at !== null;
  return {
    id: fila.id,
    mine: fila.mine,
    body: borrado ? '' : fila.body,
    created_at: fila.created_at,
    deleted: borrado,
    ...(fila.mine && { read_at: fila.read_at }),
  };
}

// Hasta qué mensaje he vaciado la conversación con esa persona (0 si nunca la vacié). Lo de
// antes no lo veo. Ver chat_clears en schema.sql.
async function vaciadoHasta(yo, otro) {
  const result = await pool.query(
    'SELECT cleared_id FROM chat_clears WHERE user_id = $1 AND other_id = $2',
    [yo, otro]
  );
  return result.rows[0]?.cleared_id ?? 0;
}

// Quién está escribiendo en la conversación entre dos personas (la otra, nunca yo)
function estaEscribiendo(yo, otro) {
  return escribiendo.quienes(escribiendo.claveDosPersonas(yo, otro), yo).length > 0;
}

// GET /chat — mis conversaciones, la más reciente primero: las de dos personas y los grupos
// Una conversación con una persona es cada una con la que tengo al menos un mensaje que no he
// vaciado, con el último mensaje, cuántos tengo sin leer y si todavía somos amigos (si no,
// solo se puede leer). No salen las personas con las que hay un bloqueo. Los grupos salen
// siempre (mientras esté dentro), aunque los haya vaciado. Cada fila lleva `type` ('user' o
// 'group'), `key` (el nombre de la persona o 'g:<id>' para un grupo: un nombre de usuario no
// puede llevar ':') y `at`, la hora por la que se ordena.
async function listConversations(req, res) {
  const yo = req.user.id;
  try {
    const [personas, grupos] = await Promise.all([
      pool.query(
        `SELECT u.id, u.username, (u.avatar IS NOT NULL) AS has_avatar,
                l.id AS last_id, (l.sender_id = $1) AS last_mine, left(l.body, 140) AS last_body,
                (l.deleted_at IS NOT NULL) AS last_deleted, l.created_at AS last_at,
                n.sin_leer AS unread,
                EXISTS (SELECT 1 FROM friendships f
                         WHERE f.status = 'aceptada'
                           AND ((f.requester_id = $1 AND f.addressee_id = u.id)
                             OR (f.requester_id = u.id AND f.addressee_id = $1))) AS is_friend
           FROM (SELECT DISTINCT CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS otro_id
                   FROM messages WHERE sender_id = $1 OR recipient_id = $1) c
           JOIN users u ON u.id = c.otro_id
           LEFT JOIN chat_clears cc ON cc.user_id = $1 AND cc.other_id = u.id
           JOIN LATERAL (
             SELECT m.id, m.sender_id, m.body, m.created_at, m.deleted_at FROM messages m
              WHERE ${entre('m', '$1', 'u.id')} AND m.id > COALESCE(cc.cleared_id, 0)
              ORDER BY m.id DESC LIMIT 1
           ) l ON TRUE
           JOIN LATERAL (
             SELECT COUNT(*)::int AS sin_leer FROM messages m
              WHERE m.recipient_id = $1 AND m.sender_id = u.id
                AND m.read_at IS NULL AND m.deleted_at IS NULL AND m.id > COALESCE(cc.cleared_id, 0)
           ) n ON TRUE
          WHERE ${sinBloqueos('$1')}`,
        [yo]
      ),
      gruposDe(yo),
    ]);

    const conversaciones = [
      ...personas.rows.map(({ id, last_id, last_mine, last_body, last_deleted, last_at, ...persona }) => ({
        type: 'user',
        key: persona.username,
        ...persona,
        typing: estaEscribiendo(yo, id),
        at: last_at,
        last: { id: last_id, mine: last_mine, body: last_deleted ? '' : last_body, deleted: last_deleted, created_at: last_at },
      })),
      ...grupos,
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    res.json({ conversations: conversaciones });
  } catch (err) {
    errorInterno(res, 'listConversations', err);
  }
}

// GET /chat/unread — cuántos mensajes tengo sin leer y en cuántas conversaciones (personas y
// grupos), y los más recientes de esos mensajes (`latest`, hasta 10, el más nuevo primero).
// Lo consulta la barra para la insignia y, con `latest`, la interfaz decide qué avisos del
// sistema enseñar (cada uno lleva `ref`, un identificador único: 'u<id>' o 'g<id>'). No cuenta
// lo de personas con un bloqueo ni lo que vacié.
async function countUnread(req, res) {
  const yo = req.user.id;
  try {
    const condicion = `m.recipient_id = $1 AND m.read_at IS NULL AND m.deleted_at IS NULL
          AND ${sinBloqueos('$1')}
          AND m.id > COALESCE((SELECT cleared_id FROM chat_clears cc
                                WHERE cc.user_id = $1 AND cc.other_id = u.id), 0)`;
    const [cuenta, ultimos, grupos] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS unread, COUNT(DISTINCT u.id)::int AS conversations
           FROM messages m JOIN users u ON u.id = m.sender_id
          WHERE ${condicion}`,
        [yo]
      ),
      pool.query(
        `SELECT m.id, u.username, left(m.body, 140) AS body, m.created_at
           FROM messages m JOIN users u ON u.id = m.sender_id
          WHERE ${condicion}
          ORDER BY m.id DESC LIMIT 10`,
        [yo]
      ),
      sinLeerEnGrupos(yo),
    ]);

    const latest = [
      ...ultimos.rows.map((f) => ({
        ref: `u${f.id}`, key: f.username, from: f.username, group: null, body: f.body, created_at: f.created_at,
      })),
      ...grupos.latest,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    res.json({
      unread: cuenta.rows[0].unread + grupos.unread,
      conversations: cuenta.rows[0].conversations + grupos.conversations,
      latest,
    });
  } catch (err) {
    errorInterno(res, 'countUnread', err);
  }
}

// GET /chat/:username — una conversación
//  - sin parámetros: los últimos mensajes (hasta PAGINA)
//  - ?before=<id>: los PAGINA anteriores a ese mensaje (para "cargar anteriores")
//  - ?after=<id>: los que han llegado desde ese mensaje (es lo que repite el sondeo)
// Siempre vienen por orden, del más antiguo al más nuevo. Además de los mensajes, la
// respuesta trae lo que puede haber cambiado en los que ya tiene el cliente: `peer_read`
// (hasta qué mensaje mío ha leído la otra persona, y cuándo) y `deleted` (los ids borrados
// entre los últimos mensajes).
async function getConversation(req, res) {
  const paginacion = leerPaginacion(req.query);
  if (paginacion === null) return res.status(400).json({ error: 'Parámetro no válido' });
  const { despues, antes } = paginacion;

  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro || otro.id === req.user.id || await hayBloqueo(req.user.id, otro.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const yo = req.user.id;
    // Lo que vacié no vuelve a salir: veo solo los mensajes posteriores
    const desde = await vaciadoHasta(yo, otro.id);

    let consulta;
    if (despues !== null) {
      consulta = pool.query(
        `SELECT m.id, (m.sender_id = $1) AS mine, m.body, m.created_at, m.read_at, m.deleted_at
           FROM messages m WHERE ${entre('m', '$1', '$2')} AND m.id > GREATEST($3::int, $4::int)
          ORDER BY m.id LIMIT 200`,
        [yo, otro.id, despues, desde]
      );
    } else {
      consulta = pool.query(
        `SELECT m.id, (m.sender_id = $1) AS mine, m.body, m.created_at, m.read_at, m.deleted_at
           FROM messages m WHERE ${entre('m', '$1', '$2')} AND ($3::int IS NULL OR m.id < $3)
            AND m.id > $4
          ORDER BY m.id DESC LIMIT ${PAGINA + 1}`,
        [yo, otro.id, antes, desde]
      );
    }

    const [mensajes, leido, borrados, amistad] = await Promise.all([
      consulta,
      pool.query(
        `SELECT m.id, m.read_at FROM messages m
          WHERE m.sender_id = $1 AND m.recipient_id = $2 AND m.read_at IS NOT NULL
          ORDER BY m.id DESC LIMIT 1`,
        [yo, otro.id]
      ),
      pool.query(
        `SELECT id FROM (
           SELECT m.id, m.deleted_at FROM messages m WHERE ${entre('m', '$1', '$2')} AND m.id > $3
            ORDER BY m.id DESC LIMIT ${VENTANA_BORRADOS}
         ) recientes WHERE deleted_at IS NOT NULL`,
        [yo, otro.id, desde]
      ),
      pool.query(
        `SELECT 1 FROM friendships
          WHERE status = 'aceptada'
            AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [yo, otro.id]
      ),
    ]);

    let filas = mensajes.rows;
    let hayMas = false;
    if (despues === null) {
      // Pedí uno más de la cuenta: si llegó, quedan anteriores. Y lo doy la vuelta, que salió
      // del más nuevo al más antiguo.
      hayMas = filas.length > PAGINA;
      filas = filas.slice(0, PAGINA).reverse();
    }

    res.json({
      user: { username: otro.username, has_avatar: otro.has_avatar },
      is_friend: amistad.rows.length > 0,
      messages: filas.map(aMensaje),
      has_more: hayMas,
      peer_read: leido.rows[0] ? { id: leido.rows[0].id, at: leido.rows[0].read_at } : null,
      deleted: borrados.rows.map((f) => f.id),
      typing: estaEscribiendo(yo, otro.id),
    });
  } catch (err) {
    errorInterno(res, 'getConversation', err);
  }
}

// POST /chat/:username { body } — enviar un mensaje (solo entre amigos)
// La comprobación de la amistad va dentro del propio INSERT: si dejáis de ser amigos justo
// ahora, no se cuela un mensaje entre la comprobación y el guardado.
async function sendMessage(req, res) {
  const texto = limpiarMensaje(req.body?.body);
  if (texto === null) return res.status(400).json({ error: MENSAJE_CHAT_INVALIDO });

  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro || await hayBloqueo(req.user.id, otro.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (otro.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes escribirte a ti mismo' });
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body)
       SELECT $1, $2, $3
        WHERE EXISTS (SELECT 1 FROM friendships
                       WHERE status = 'aceptada'
                         AND ((requester_id = $1 AND addressee_id = $2)
                           OR (requester_id = $2 AND addressee_id = $1)))
       RETURNING id, body, created_at, read_at, deleted_at`,
      [req.user.id, otro.id, texto]
    );

    if (result.rowCount === 0) return res.status(403).json({ error: 'Solo puedes escribir a tus amigos' });
    // Ya no está escribiendo: ha enviado
    escribiendo.marcar(escribiendo.claveDosPersonas(req.user.id, otro.id), req.user.id, false);
    res.status(201).json({ message: aMensaje({ ...result.rows[0], mine: true }) });
  } catch (err) {
    errorInterno(res, 'sendMessage', err);
  }
}

// POST /chat/:username/read — marcar como leídos los mensajes que me ha enviado esa persona
// Lo llama el cliente cuando de verdad los está viendo (conversación abierta y pestaña
// visible), no al pedirlos: así "visto" significa visto.
async function markRead(req, res) {
  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });

    const result = await pool.query(
      `UPDATE messages SET read_at = NOW()
        WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL AND deleted_at IS NULL`,
      [req.user.id, otro.id]
    );
    res.json({ read: result.rowCount });
  } catch (err) {
    errorInterno(res, 'markRead', err);
  }
}

// DELETE /chat/:username/messages/:id — borrar un mensaje que yo envié
// El texto se vacía de verdad. Solo el autor puede, y aunque ya no seáis amigos. Con el id de
// un mensaje ajeno o inexistente responde 404, igual que si no existiera.
async function deleteMessage(req, res) {
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Mensaje no encontrado' });

  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro) return res.status(404).json({ error: 'Usuario no encontrado' });

    const result = await pool.query(
      `UPDATE messages SET body = '', deleted_at = NOW()
        WHERE id = $1 AND sender_id = $2 AND recipient_id = $3 AND deleted_at IS NULL`,
      [id, req.user.id, otro.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ id, deleted: true });
  } catch (err) {
    errorInterno(res, 'deleteMessage', err);
  }
}

// POST /chat/:username/clear — vaciar la conversación SOLO para mí: la otra persona la sigue
// teniendo entera. Apunto hasta qué mensaje la vacié (chat_clears) y, si la otra persona
// también la había vaciado, borro de verdad los mensajes que ya no puede ver ninguna de las dos.
// Los mensajes sin leer que vacío dejan de contar, pero NO se marcan como leídos: la otra
// persona no verá un "Visto" que no ha pasado.
async function clearConversation(req, res) {
  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro || otro.id === req.user.id || await hayBloqueo(req.user.id, otro.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const yo = req.user.id;

    const result = await pool.query(
      `INSERT INTO chat_clears (user_id, other_id, cleared_id)
       SELECT $1, $2, COALESCE(MAX(m.id), 0) FROM messages m WHERE ${entre('m', '$1', '$2')}
       ON CONFLICT (user_id, other_id) DO UPDATE SET cleared_id = EXCLUDED.cleared_id
       RETURNING cleared_id`,
      [yo, otro.id]
    );

    // Lo que ninguna de las dos ve ya (por debajo de la marca más baja de las dos) se borra
    await pool.query(
      `DELETE FROM messages m
        WHERE ${entre('m', '$1', '$2')}
          AND m.id <= (SELECT LEAST(a.cleared_id, b.cleared_id)
                         FROM chat_clears a
                         JOIN chat_clears b ON b.user_id = a.other_id AND b.other_id = a.user_id
                        WHERE a.user_id = $1 AND a.other_id = $2)`,
      [yo, otro.id]
    );

    res.json({ cleared_id: result.rows[0].cleared_id });
  } catch (err) {
    errorInterno(res, 'clearConversation', err);
  }
}

// POST /chat/:username/typing { active? } — estoy escribiendo a esa persona (o he dejado de
// hacerlo). Solo entre amigos: a quien no puede recibir mensajes no le llega. Ver
// services/escribiendo.js
async function typing(req, res) {
  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro || otro.id === req.user.id) return res.status(404).json({ error: 'Usuario no encontrado' });

    const amistad = await pool.query(
      `SELECT 1 FROM friendships
        WHERE status = 'aceptada'
          AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [req.user.id, otro.id]
    );
    if (amistad.rows.length === 0) return res.status(403).json({ error: 'Solo puedes escribir a tus amigos' });

    escribiendo.marcar(escribiendo.claveDosPersonas(req.user.id, otro.id), req.user.id, sigueEscribiendo(req.body));
    res.status(204).end();
  } catch (err) {
    errorInterno(res, 'typing', err);
  }
}

module.exports = {
  listConversations, countUnread, getConversation, sendMessage, markRead, deleteMessage,
  clearConversation, typing, limpiarMensaje,
};

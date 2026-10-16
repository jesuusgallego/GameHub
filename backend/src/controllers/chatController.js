const pool = require('../config/db');
const { USERNAME_REGEX, MENSAJE_MAX, MENSAJE_CHAT_INVALIDO } = require('../config/validacion');
const { sinBloqueos } = require('../services/amistades');

// Cuántos mensajes salen de golpe al abrir una conversación o al pedir los anteriores
const PAGINA = 50;
// Cuántos mensajes recientes se revisan en cada consulta para enterarse de los borrados
const VENTANA_BORRADOS = 200;

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

function errorInterno(res, nombre, err) {
  console.error(`Error en ${nombre}:`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

// Un id que viene en la URL o en la consulta: entero positivo que cabe en un SERIAL, o null
function entero(texto) {
  return typeof texto === 'string' && /^[1-9][0-9]{0,9}$/.test(texto) && Number(texto) <= 2147483647
    ? Number(texto)
    : null;
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

// Lo que se puede escribir en un mensaje: salto de línea (\n) y tabulador, pero ningún otro
// carácter de control. Un NUL (\0) además hace fallar a Postgres.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Deja el texto listo para guardar: saltos de Windows a \n, sin caracteres de control, sin
// espacios ni saltos en los extremos y como mucho una línea en blanco seguida. Devuelve null
// si no es texto o queda vacío o demasiado largo.
function limpiarMensaje(texto) {
  if (typeof texto !== 'string') return null;
  const limpio = texto
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return limpio.length >= 1 && limpio.length <= MENSAJE_MAX ? limpio : null;
}

// GET /chat — mis conversaciones, la más reciente primero
// Es cada persona con la que tengo al menos un mensaje (enviado o recibido), con el último
// mensaje, cuántos tengo sin leer y si todavía somos amigos (si no, solo se puede leer).
// No salen las personas con las que hay un bloqueo.
async function listConversations(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar,
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
         JOIN LATERAL (
           SELECT m.id, m.sender_id, m.body, m.created_at, m.deleted_at FROM messages m
            WHERE ${entre('m', '$1', 'u.id')}
            ORDER BY m.id DESC LIMIT 1
         ) l ON TRUE
         JOIN LATERAL (
           SELECT COUNT(*)::int AS sin_leer FROM messages m
            WHERE m.recipient_id = $1 AND m.sender_id = u.id
              AND m.read_at IS NULL AND m.deleted_at IS NULL
         ) n ON TRUE
        WHERE ${sinBloqueos('$1')}
        ORDER BY l.id DESC`,
      [req.user.id]
    );

    res.json({
      conversations: result.rows.map(({ last_id, last_mine, last_body, last_deleted, last_at, ...persona }) => ({
        ...persona,
        last: { id: last_id, mine: last_mine, body: last_deleted ? '' : last_body, deleted: last_deleted, created_at: last_at },
      })),
    });
  } catch (err) {
    errorInterno(res, 'listConversations', err);
  }
}

// GET /chat/unread — cuántos mensajes tengo sin leer y de cuántas personas. Es lo que
// consulta la barra para la insignia de "Chat"; no cuenta los de personas con un bloqueo.
async function countUnread(req, res) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread, COUNT(DISTINCT u.id)::int AS conversations
         FROM messages m
         JOIN users u ON u.id = m.sender_id
        WHERE m.recipient_id = $1 AND m.read_at IS NULL AND m.deleted_at IS NULL
          AND ${sinBloqueos('$1')}`,
      [req.user.id]
    );
    res.json(result.rows[0]);
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
  const despues = req.query.after === undefined ? null : entero(req.query.after);
  const antes = req.query.before === undefined ? null : entero(req.query.before);
  if ((req.query.after !== undefined && despues === null) || (req.query.before !== undefined && antes === null)) {
    return res.status(400).json({ error: 'Parámetro no válido' });
  }

  try {
    const otro = await buscarUsuario(req.params.username);
    if (!otro || otro.id === req.user.id || await hayBloqueo(req.user.id, otro.id)) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const yo = req.user.id;

    let consulta;
    if (despues !== null) {
      consulta = pool.query(
        `SELECT m.id, (m.sender_id = $1) AS mine, m.body, m.created_at, m.read_at, m.deleted_at
           FROM messages m WHERE ${entre('m', '$1', '$2')} AND m.id > $3
          ORDER BY m.id LIMIT 200`,
        [yo, otro.id, despues]
      );
    } else {
      consulta = pool.query(
        `SELECT m.id, (m.sender_id = $1) AS mine, m.body, m.created_at, m.read_at, m.deleted_at
           FROM messages m WHERE ${entre('m', '$1', '$2')} AND ($3::int IS NULL OR m.id < $3)
          ORDER BY m.id DESC LIMIT ${PAGINA + 1}`,
        [yo, otro.id, antes]
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
           SELECT m.id, m.deleted_at FROM messages m WHERE ${entre('m', '$1', '$2')}
            ORDER BY m.id DESC LIMIT ${VENTANA_BORRADOS}
         ) recientes WHERE deleted_at IS NOT NULL`,
        [yo, otro.id]
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

module.exports = {
  listConversations, countUnread, getConversation, sendMessage, markRead, deleteMessage, limpiarMensaje,
};

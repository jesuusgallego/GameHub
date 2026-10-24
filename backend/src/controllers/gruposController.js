const pool = require('../config/db');
const {
  USERNAME_REGEX, GRUPO_MAX_MIEMBROS, MENSAJE_NOMBRE_GRUPO, MENSAJE_MIEMBROS_GRUPO, MENSAJE_CHAT_INVALIDO,
} = require('../config/validacion');
const { amigosDe } = require('../services/amistades');
const escribiendo = require('../services/escribiendo');
const {
  PAGINA, VENTANA_BORRADOS, errorInterno, entero, leerPaginacion, limpiarMensaje, limpiarNombreGrupo,
  sigueEscribiendo,
} = require('../services/chatComun');

// Chats de grupo: de 3 a GRUPO_MAX_MIEMBROS personas. Las reglas:
//  - Crea un grupo quien quiera, con amigos suyos. Quien lo crea lo administra: cambia el
//    nombre, añade gente (amigos suyos) y saca a quien quiera. Cualquiera puede salir.
//  - Si sale quien administra, el grupo pasa a quien lleve más tiempo dentro. Si sale el
//    último, el grupo se borra.
//  - Dentro del grupo no hace falta ser amigo de todos. Lo que no se permite es juntar a dos
//    personas con un bloqueo entre ellas: ni al crearlo ni al añadir.
//  - Si bloqueas a alguien que ya está en un grupo contigo, sus mensajes te llegan ocultos.
//  - Quien entra no ve lo que se dijo antes (since_id) y quien sale deja de ver el grupo.
// Las tablas y las marcas de cada persona (since_id, last_read_id, cleared_id) están en
// schema.sql.

const NO_EXISTE = 'Grupo no encontrado';
const SOLO_ADMIN = 'Solo quien administra el grupo puede hacer eso';
const SOLO_AMIGOS = 'Solo puedes añadir a tus amigos';
const HAY_BLOQUEO = 'No se puede juntar a esas personas en un grupo';
const MAXIMO = 'Un grupo tiene como mucho 10 personas';
const YA_ESTAN = 'Esas personas ya están en el grupo';
const NO_ESTA = 'Esa persona no está en el grupo';

// Un error con su código HTTP, para cortar una transacción y responder con él
class ErrorHttp extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

function responderError(res, nombre, err) {
  if (err instanceof ErrorHttp) return res.status(err.codigo).json({ error: err.message });
  errorInterno(res, nombre, err);
}

// Ejecuta `fn(db)` dentro de una transacción: o se guarda todo lo que hace o nada (si algo
// falla a medias, ROLLBACK deshace lo anterior)
async function enTransaccion(fn) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const resultado = await fn(db);
    await db.query('COMMIT');
    return resultado;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}

// La lista de nombres de usuario que llega al crear un grupo o añadir gente: de 1 a
// GRUPO_MAX_MIEMBROS - 1 nombres válidos y sin repetir, o null
function leerNombres(lista) {
  if (!Array.isArray(lista) || lista.length === 0 || lista.length >= GRUPO_MAX_MIEMBROS) return null;
  if (!lista.every((n) => typeof n === 'string' && USERNAME_REGEX.test(n))) return null;
  return new Set(lista).size === lista.length ? lista : null;
}

// Mi sitio en un grupo: el grupo y mis marcas, o null si no estoy (o no existe). `desde` es a
// partir de qué mensaje veo (lo anterior es de antes de entrar o lo vacié).
// Con `bloquear`, la fila del grupo queda bloqueada hasta el final de la transacción: dos
// cambios de miembros a la vez se hacen uno detrás de otro (si no, entre los dos podrían
// pasar del máximo).
async function miSitio(db, grupoId, yo, bloquear = false) {
  const result = await db.query(
    `SELECT g.id, g.name, g.owner_id, g.created_at, m.since_id, m.last_read_id, m.cleared_id,
            GREATEST(m.since_id, m.cleared_id) AS desde
       FROM chat_groups g
       JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = $2
      WHERE g.id = $1
      ${bloquear ? 'FOR UPDATE OF g' : ''}`,
    [grupoId, yo]
  );
  return result.rows[0] ?? null;
}

// Las personas del grupo, en el orden en que entraron
async function miembros(db, grupoId) {
  const result = await db.query(
    `SELECT u.id, u.username, (u.avatar IS NOT NULL) AS has_avatar, m.last_read_id
       FROM chat_group_members m JOIN users u ON u.id = m.user_id
      WHERE m.group_id = $1
      ORDER BY m.joined_at, m.user_id`,
    [grupoId]
  );
  return result.rows;
}

// Los ids de las personas con esos nombres que son amigas mías. Si falta alguna (no existe o no
// es mi amiga), error: no digo cuál para no revelar si existe.
async function amigosConNombre(db, yo, nombres) {
  const result = await db.query(
    `SELECT u.id FROM users u WHERE u.username = ANY($2::text[]) AND u.id IN (${amigosDe('$1')})`,
    [yo, nombres]
  );
  if (result.rows.length !== nombres.length) throw new ErrorHttp(403, SOLO_AMIGOS);
  return result.rows.map((f) => f.id);
}

// Error si entre esas personas hay algún bloqueo, en cualquier sentido
async function comprobarSinBloqueos(db, ids) {
  const result = await db.query(
    'SELECT 1 FROM blocks WHERE blocker_id = ANY($1::int[]) AND blocked_id = ANY($1::int[]) LIMIT 1',
    [ids]
  );
  if (result.rows.length > 0) throw new ErrorHttp(403, HAY_BLOQUEO);
}

// Guarda un aviso del grupo ("ana añadió a luis"...). Ver group_messages en schema.sql.
function aviso(db, grupoId, quien, evento, { objetivo = null, texto = '' } = {}) {
  return db.query(
    `INSERT INTO group_messages (group_id, sender_id, kind, event, target_id, body)
     VALUES ($1, $2, 'event', $3, $4, $5)`,
    [grupoId, quien, evento, objetivo, texto]
  );
}

// Borra de verdad los mensajes que ya no puede ver nadie del grupo: los que quedan por debajo
// de la marca más baja (todos los vaciaron, o son de antes de que entraran los que quedan).
async function purgar(db, grupoId) {
  await db.query(
    `DELETE FROM group_messages
      WHERE group_id = $1
        AND id <= (SELECT MIN(GREATEST(since_id, cleared_id)) FROM chat_group_members WHERE group_id = $1)`,
    [grupoId]
  );
}

// Las columnas de un mensaje tal como las necesita aMensaje. $1 es mi id. `hidden`: lo envió
// alguien a quien he bloqueado.
const COLUMNAS = `gm.id, (gm.sender_id = $1) AS mine, s.username AS sender, gm.kind, gm.event,
       t.username AS target, gm.body, gm.created_at, gm.deleted_at,
       EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $1 AND b.blocked_id = gm.sender_id) AS hidden`;
const TABLAS = `FROM group_messages gm
       JOIN users s ON s.id = gm.sender_id
       LEFT JOIN users t ON t.id = gm.target_id`;

// Un mensaje tal como lo ve el cliente. Los avisos llevan `event` y `target` (a quién afecta);
// lo borrado y lo oculto van sin texto.
function aMensaje(fila) {
  const borrado = fila.deleted_at !== null;
  const oculto = fila.kind === 'text' && fila.hidden && !borrado;
  return {
    id: fila.id,
    mine: fila.mine,
    sender: fila.sender,
    kind: fila.kind,
    ...(fila.kind === 'event' && { event: fila.event, target: fila.target }),
    body: borrado || oculto ? '' : fila.body,
    created_at: fila.created_at,
    deleted: borrado,
    ...(oculto && { hidden: true }),
  };
}

// Lo que cuenta como "sin leer" en un grupo para la persona de la fila m de chat_group_members:
// mensajes de texto de otras personas, posteriores a todas mis marcas, sin borrar y de alguien
// a quien no he bloqueado. `gm` es la tabla group_messages.
const SIN_LEER = `gm.id > GREATEST(m.since_id, m.cleared_id, m.last_read_id)
       AND gm.sender_id <> m.user_id AND gm.kind = 'text' AND gm.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = m.user_id AND b.blocked_id = gm.sender_id)`;

// ---- Para la lista de conversaciones y los avisos (los usa chatController) ----------------

// Mis grupos como filas de la lista de conversaciones (ver chatController.listConversations)
async function gruposDe(yo) {
  const result = await pool.query(
    `SELECT g.id, g.name, m.joined_at,
            l.id AS last_id, (l.sender_id = $1) AS last_mine, ls.username AS last_sender,
            l.kind AS last_kind, l.event AS last_event, lt.username AS last_target,
            left(l.body, 140) AS last_body, (l.deleted_at IS NOT NULL) AS last_deleted,
            l.created_at AS last_at,
            EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $1 AND b.blocked_id = l.sender_id) AS last_hidden,
            (SELECT COUNT(*)::int FROM group_messages gm WHERE gm.group_id = g.id AND ${SIN_LEER}) AS unread,
            (SELECT COUNT(*)::int FROM chat_group_members mm WHERE mm.group_id = g.id) AS member_count,
            COALESCE((
              SELECT json_agg(json_build_object('username', x.username, 'has_avatar', x.has_avatar))
                FROM (SELECT u.username, (u.avatar IS NOT NULL) AS has_avatar
                        FROM chat_group_members mm JOIN users u ON u.id = mm.user_id
                       WHERE mm.group_id = g.id AND mm.user_id <> $1
                       ORDER BY mm.joined_at, mm.user_id LIMIT 3) x
            ), '[]'::json) AS members
       FROM chat_group_members m
       JOIN chat_groups g ON g.id = m.group_id
       LEFT JOIN LATERAL (
         SELECT gm.* FROM group_messages gm
          WHERE gm.group_id = g.id AND gm.id > GREATEST(m.since_id, m.cleared_id)
          ORDER BY gm.id DESC LIMIT 1
       ) l ON TRUE
       LEFT JOIN users ls ON ls.id = l.sender_id
       LEFT JOIN users lt ON lt.id = l.target_id
      WHERE m.user_id = $1`,
    [yo]
  );

  // Quién escribe en cada grupo: está en memoria (ids); los nombres, en una sola consulta
  const escribiendoPor = new Map(result.rows.map((f) => [f.id, escribiendo.quienes(escribiendo.claveGrupo(f.id), yo)]));
  const ids = [...new Set([...escribiendoPor.values()].flat())];
  const nombres = new Map();
  if (ids.length > 0) {
    const gente = await pool.query('SELECT id, username FROM users WHERE id = ANY($1::int[])', [ids]);
    for (const p of gente.rows) nombres.set(p.id, p.username);
  }

  return result.rows.map((f) => {
    const oculto = f.last_kind === 'text' && f.last_hidden && !f.last_deleted;
    return {
      type: 'group',
      key: `g:${f.id}`,
      id: f.id,
      name: f.name,
      members: f.members,
      member_count: f.member_count,
      unread: f.unread,
      typing: escribiendoPor.get(f.id).map((id) => nombres.get(id)).filter(Boolean),
      at: f.last_at ?? f.joined_at,
      last: f.last_id === null ? null : {
        id: f.last_id,
        mine: f.last_mine,
        sender: f.last_sender,
        kind: f.last_kind,
        ...(f.last_kind === 'event' && { event: f.last_event, target: f.last_target }),
        body: f.last_deleted || oculto ? '' : f.last_body,
        deleted: f.last_deleted,
        ...(oculto && { hidden: true }),
        created_at: f.last_at,
      },
    };
  });
}

// Cuántos mensajes de grupo tengo sin leer y en cuántos grupos, y los más recientes (para los
// avisos del sistema). Ver chatController.countUnread.
async function sinLeerEnGrupos(yo) {
  const [cuenta, ultimos] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS unread, COUNT(DISTINCT gm.group_id)::int AS conversations
         FROM chat_group_members m JOIN group_messages gm ON gm.group_id = m.group_id
        WHERE m.user_id = $1 AND ${SIN_LEER}`,
      [yo]
    ),
    pool.query(
      `SELECT gm.id, gm.group_id, g.name AS group_name, s.username AS sender,
              left(gm.body, 140) AS body, gm.created_at
         FROM chat_group_members m
         JOIN group_messages gm ON gm.group_id = m.group_id
         JOIN chat_groups g ON g.id = m.group_id
         JOIN users s ON s.id = gm.sender_id
        WHERE m.user_id = $1 AND ${SIN_LEER}
        ORDER BY gm.id DESC LIMIT 10`,
      [yo]
    ),
  ]);
  return {
    ...cuenta.rows[0],
    latest: ultimos.rows.map((f) => ({
      ref: `g${f.id}`,
      key: `g:${f.group_id}`,
      from: f.sender,
      group: f.group_name,
      body: f.body,
      created_at: f.created_at,
    })),
  };
}

// Antes de borrar una cuenta: sus grupos pasan a otra persona y se borran los grupos en los
// que estaba sola. El resto (su fila de miembro y sus mensajes) lo borra el CASCADE.
async function alBorrarCuenta(db, yo) {
  await db.query(
    `DELETE FROM chat_groups g
      WHERE EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = g.id AND m.user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = g.id AND m.user_id <> $1)`,
    [yo]
  );
  await db.query(
    `UPDATE chat_groups g
        SET owner_id = (SELECT m.user_id FROM chat_group_members m
                         WHERE m.group_id = g.id AND m.user_id <> $1
                         ORDER BY m.joined_at, m.user_id LIMIT 1)
      WHERE g.owner_id = $1`,
    [yo]
  );
}

// ---- Rutas -----------------------------------------------------------------------------

// POST /chat/g { name, members: [nombres] } — crear un grupo con amigos míos
async function createGroup(req, res) {
  const nombre = limpiarNombreGrupo(req.body?.name);
  if (nombre === null) return res.status(400).json({ error: MENSAJE_NOMBRE_GRUPO });
  const nombres = leerNombres(req.body?.members);
  if (nombres === null || nombres.length < 2) return res.status(400).json({ error: MENSAJE_MIEMBROS_GRUPO });

  const yo = req.user.id;
  try {
    const id = await enTransaccion(async (db) => {
      const ids = await amigosConNombre(db, yo, nombres);
      await comprobarSinBloqueos(db, [yo, ...ids]);

      const grupo = await db.query(
        'INSERT INTO chat_groups (name, owner_id) VALUES ($1, $2) RETURNING id',
        [nombre, yo]
      );
      const grupoId = grupo.rows[0].id;
      await db.query(
        'INSERT INTO chat_group_members (group_id, user_id) SELECT $1, unnest($2::int[])',
        [grupoId, [yo, ...ids]]
      );
      await aviso(db, grupoId, yo, 'created', { texto: nombre });
      return grupoId;
    });
    res.status(201).json({ group: { id, key: `g:${id}`, name: nombre } });
  } catch (err) {
    responderError(res, 'createGroup', err);
  }
}

// GET /chat/g/:id — un grupo y sus mensajes. Igual que la conversación entre dos personas
// (ver chatController.getConversation): sin parámetros, los últimos; ?before=<id>, los
// anteriores; ?after=<id>, lo nuevo. Además trae las personas del grupo, hasta dónde ha leído
// cada una (para el "Visto por...") y quién está escribiendo.
async function getGroup(req, res) {
  const paginacion = leerPaginacion(req.query);
  if (paginacion === null) return res.status(400).json({ error: 'Parámetro no válido' });
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });

  const yo = req.user.id;
  try {
    const sitio = await miSitio(pool, id, yo);
    if (!sitio) return res.status(404).json({ error: NO_EXISTE });

    const { despues, antes } = paginacion;
    const consulta = despues !== null
      ? pool.query(
        `SELECT ${COLUMNAS} ${TABLAS}
          WHERE gm.group_id = $2 AND gm.id > GREATEST($3::int, $4::int)
          ORDER BY gm.id LIMIT 200`,
        [yo, id, sitio.desde, despues]
      )
      : pool.query(
        `SELECT ${COLUMNAS} ${TABLAS}
          WHERE gm.group_id = $2 AND gm.id > $3 AND ($4::int IS NULL OR gm.id < $4)
          ORDER BY gm.id DESC LIMIT ${PAGINA + 1}`,
        [yo, id, sitio.desde, antes]
      );

    const [mensajes, gente, borrados] = await Promise.all([
      consulta,
      miembros(pool, id),
      pool.query(
        `SELECT id FROM (
           SELECT gm.id, gm.deleted_at FROM group_messages gm
            WHERE gm.group_id = $1 AND gm.id > $2
            ORDER BY gm.id DESC LIMIT ${VENTANA_BORRADOS}
         ) recientes WHERE deleted_at IS NOT NULL`,
        [id, sitio.desde]
      ),
    ]);

    let filas = mensajes.rows;
    let hayMas = false;
    if (despues === null) {
      hayMas = filas.length > PAGINA;
      filas = filas.slice(0, PAGINA).reverse();
    }

    const nombrePorId = new Map(gente.map((p) => [p.id, p.username]));
    res.json({
      group: {
        id,
        key: `g:${id}`,
        name: sitio.name,
        created_at: sitio.created_at,
        is_owner: sitio.owner_id === yo,
        members: gente.map((p) => ({ username: p.username, has_avatar: p.has_avatar, is_owner: p.id === sitio.owner_id })),
      },
      messages: filas.map(aMensaje),
      has_more: hayMas,
      reads: gente.filter((p) => p.id !== yo).map((p) => ({ username: p.username, last_read_id: p.last_read_id })),
      deleted: borrados.rows.map((f) => f.id),
      typing: escribiendo.quienes(escribiendo.claveGrupo(id), yo).map((i) => nombrePorId.get(i)).filter(Boolean),
    });
  } catch (err) {
    errorInterno(res, 'getGroup', err);
  }
}

// POST /chat/g/:id { body } — escribir en el grupo. Que siga dentro se comprueba en el propio
// INSERT, igual que la amistad en el chat entre dos personas.
async function sendGroupMessage(req, res) {
  const texto = limpiarMensaje(req.body?.body);
  if (texto === null) return res.status(400).json({ error: MENSAJE_CHAT_INVALIDO });
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });

  const yo = req.user.id;
  try {
    const result = await pool.query(
      `WITH nuevo AS (
         INSERT INTO group_messages (group_id, sender_id, body)
         SELECT $1, $2, $3
          WHERE EXISTS (SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2)
         RETURNING id, sender_id, body, created_at, deleted_at
       )
       SELECT n.id, n.body, n.created_at, n.deleted_at, u.username AS sender
         FROM nuevo n JOIN users u ON u.id = n.sender_id`,
      [id, yo, texto]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: NO_EXISTE });

    escribiendo.marcar(escribiendo.claveGrupo(id), yo, false);
    res.status(201).json({ message: aMensaje({ ...result.rows[0], mine: true, kind: 'text', hidden: false }) });
  } catch (err) {
    errorInterno(res, 'sendGroupMessage', err);
  }
}

// POST /chat/g/:id/read — he leído hasta el último mensaje del grupo
async function markGroupRead(req, res) {
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });
  try {
    const result = await pool.query(
      `UPDATE chat_group_members
          SET last_read_id = GREATEST(last_read_id,
                (SELECT COALESCE(MAX(id), 0) FROM group_messages WHERE group_id = $1))
        WHERE group_id = $1 AND user_id = $2
        RETURNING last_read_id`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: NO_EXISTE });
    res.json({ last_read_id: result.rows[0].last_read_id });
  } catch (err) {
    errorInterno(res, 'markGroupRead', err);
  }
}

// DELETE /chat/g/:id/messages/:mid — borrar un mensaje mío (el texto se vacía de verdad)
async function deleteGroupMessage(req, res) {
  const id = entero(req.params.id);
  const mensajeId = entero(req.params.mid);
  if (id === null || mensajeId === null) return res.status(404).json({ error: 'Mensaje no encontrado' });
  try {
    const result = await pool.query(
      `UPDATE group_messages gm SET body = '', deleted_at = NOW()
        WHERE gm.id = $1 AND gm.group_id = $2 AND gm.sender_id = $3 AND gm.kind = 'text'
          AND gm.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM chat_group_members WHERE group_id = $2 AND user_id = $3)`,
      [mensajeId, id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ id: mensajeId, deleted: true });
  } catch (err) {
    errorInterno(res, 'deleteGroupMessage', err);
  }
}

// PATCH /chat/g/:id { name } — cambiar el nombre (solo quien administra)
async function renameGroup(req, res) {
  const nombre = limpiarNombreGrupo(req.body?.name);
  if (nombre === null) return res.status(400).json({ error: MENSAJE_NOMBRE_GRUPO });
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });

  const yo = req.user.id;
  try {
    await enTransaccion(async (db) => {
      const sitio = await miSitio(db, id, yo, true);
      if (!sitio) throw new ErrorHttp(404, NO_EXISTE);
      if (sitio.owner_id !== yo) throw new ErrorHttp(403, SOLO_ADMIN);
      if (sitio.name === nombre) return;
      await db.query('UPDATE chat_groups SET name = $1 WHERE id = $2', [nombre, id]);
      await aviso(db, id, yo, 'renamed', { texto: nombre });
    });
    res.json({ name: nombre });
  } catch (err) {
    responderError(res, 'renameGroup', err);
  }
}

// POST /chat/g/:id/members { members: [nombres] } — añadir amigos míos (solo quien administra).
// Quien entra empieza a leer desde ahora: since_id es el último mensaje que hay.
async function addMembers(req, res) {
  const nombres = leerNombres(req.body?.members);
  if (nombres === null) return res.status(400).json({ error: MAXIMO });
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });

  const yo = req.user.id;
  try {
    const anadidos = await enTransaccion(async (db) => {
      const sitio = await miSitio(db, id, yo, true);
      if (!sitio) throw new ErrorHttp(404, NO_EXISTE);
      if (sitio.owner_id !== yo) throw new ErrorHttp(403, SOLO_ADMIN);

      const actuales = (await miembros(db, id)).map((p) => p.id);
      const nuevos = (await amigosConNombre(db, yo, nombres)).filter((n) => !actuales.includes(n));
      if (nuevos.length === 0) throw new ErrorHttp(409, YA_ESTAN);
      if (actuales.length + nuevos.length > GRUPO_MAX_MIEMBROS) throw new ErrorHttp(400, MAXIMO);
      await comprobarSinBloqueos(db, [...actuales, ...nuevos]);

      const ultimo = await db.query('SELECT COALESCE(MAX(id), 0) AS id FROM group_messages WHERE group_id = $1', [id]);
      await db.query(
        `INSERT INTO chat_group_members (group_id, user_id, since_id, last_read_id)
         SELECT $1, unnest($2::int[]), $3, $3`,
        [id, nuevos, ultimo.rows[0].id]
      );
      for (const nuevo of nuevos) await aviso(db, id, yo, 'added', { objetivo: nuevo });
      return nuevos.length;
    });
    res.status(201).json({ added: anadidos });
  } catch (err) {
    responderError(res, 'addMembers', err);
  }
}

// DELETE /chat/g/:id/members/:username — con mi nombre, salgo del grupo; con el de otra
// persona, la saco (solo quien administra).
async function removeMember(req, res) {
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });
  const nombre = req.params.username;
  if (!USERNAME_REGEX.test(nombre)) return res.status(404).json({ error: NO_ESTA });

  const yo = req.user.id;
  try {
    const resultado = await enTransaccion(async (db) => {
      const sitio = await miSitio(db, id, yo, true);
      if (!sitio) throw new ErrorHttp(404, NO_EXISTE);

      const persona = await db.query(
        `SELECT u.id FROM users u
           JOIN chat_group_members m ON m.user_id = u.id AND m.group_id = $1
          WHERE u.username = $2`,
        [id, nombre]
      );
      const objetivo = persona.rows[0]?.id;
      if (objetivo === undefined) throw new ErrorHttp(404, NO_ESTA);
      const salgoYo = objetivo === yo;
      if (!salgoYo && sitio.owner_id !== yo) throw new ErrorHttp(403, SOLO_ADMIN);

      await db.query('DELETE FROM chat_group_members WHERE group_id = $1 AND user_id = $2', [id, objetivo]);
      escribiendo.marcar(escribiendo.claveGrupo(id), objetivo, false);

      const quedan = (await miembros(db, id)).map((p) => p.id);
      if (quedan.length === 0) {
        await db.query('DELETE FROM chat_groups WHERE id = $1', [id]);
        return { left: salgoYo, group_deleted: true };
      }

      if (salgoYo) await aviso(db, id, yo, 'left');
      else await aviso(db, id, yo, 'removed', { objetivo });

      // Se ha ido quien administraba: el grupo pasa a quien lleve más tiempo dentro
      if (sitio.owner_id === objetivo) {
        await db.query('UPDATE chat_groups SET owner_id = $1 WHERE id = $2', [quedan[0], id]);
        await aviso(db, id, quedan[0], 'owner');
      }
      await purgar(db, id);
      return { left: salgoYo, group_deleted: false };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, 'removeMember', err);
  }
}

// POST /chat/g/:id/clear — vaciar el grupo solo para mí (no salgo de él)
async function clearGroup(req, res) {
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });
  try {
    const vaciado = await enTransaccion(async (db) => {
      const result = await db.query(
        `UPDATE chat_group_members
            SET cleared_id = (SELECT COALESCE(MAX(id), 0) FROM group_messages WHERE group_id = $1)
          WHERE group_id = $1 AND user_id = $2
          RETURNING cleared_id`,
        [id, req.user.id]
      );
      if (result.rows.length === 0) throw new ErrorHttp(404, NO_EXISTE);
      await purgar(db, id);
      return result.rows[0].cleared_id;
    });
    res.json({ cleared_id: vaciado });
  } catch (err) {
    responderError(res, 'clearGroup', err);
  }
}

// POST /chat/g/:id/typing { active? } — estoy escribiendo (o he dejado de hacerlo). Ver
// services/escribiendo.js
async function groupTyping(req, res) {
  const id = entero(req.params.id);
  if (id === null) return res.status(404).json({ error: NO_EXISTE });
  try {
    const result = await pool.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: NO_EXISTE });
    escribiendo.marcar(escribiendo.claveGrupo(id), req.user.id, sigueEscribiendo(req.body));
    res.status(204).end();
  } catch (err) {
    errorInterno(res, 'groupTyping', err);
  }
}

module.exports = {
  createGroup, getGroup, sendGroupMessage, markGroupRead, deleteGroupMessage, renameGroup,
  addMembers, removeMember, clearGroup, groupTyping,
  gruposDe, sinLeerEnGrupos, alBorrarCuenta, leerNombres,
};

const pool = require('../config/db');
const { asegurarFrescas } = require('../services/noticias');
const R = require('../services/recomendador');
const { amigosDe } = require('../services/amistades');

// Las noticias: el catálogo de portales, "Siguiendo" (tus portales, por fecha), "Para ti"
// (recomendadas, ver services/recomendador.js) y el registro de lo que pasa con cada noticia que
// se enseña (news_events), que es con lo que la 1.7 entrenará el recomendador.

const POR_PAGINA = 20;
const DIAS_CANDIDATAS = 7;
const CANDIDATAS_MAX = 1500;
// Cuánto dura la clasificación de "Para ti" de una persona: así, al bajar y cargar más, el orden no
// cambia por debajo (y se sabe con qué señales se enseñó cada noticia)
const MINUTOS_CLASIFICACION = 10;
const EVENTOS_MAX = 50;
const TIPOS_EVENTO = new Set(['impression', 'click']);
const PESTANAS = new Set(['para_ti', 'siguiendo']);

function errorInterno(res, nombre, err) {
  console.error(`Error en ${nombre}:`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

const idiomaDe = (q) => (q === 'en' ? 'en' : 'es');

// Una noticia tal como la ve la interfaz
function aNoticia(fila, extra = {}) {
  return {
    id: fila.id,
    url: fila.url,
    title: fila.title,
    excerpt: fila.excerpt,
    image: fila.image_url,
    published_at: fila.published_at,
    lang: fila.lang,
    source: { slug: fila.slug, name: fila.name, tono: fila.tono, site: fila.site_url },
    ...extra,
  };
}

const COLUMNAS = `a.id, a.source_id, a.url, a.title, a.excerpt, a.image_url, a.published_at,
       s.slug, s.name, s.tono, s.site_url, s.lang`;

// ---- Lo que el recomendador necesita saber de una persona --------------------------------

async function contextoDe(yo) {
  const [biblioteca, amigos, seguidos, usuario] = await Promise.all([
    pool.query(
      `SELECT igdb_id, name, cover_url, status, rating, playtime_minutes, genres, developers, publishers, platform
         FROM user_games WHERE user_id = $1`,
      [yo]
    ),
    // Juegos de mis amigos que juegan ahora o adoran (nota 8+), contando solo a quien deja ver su
    // biblioteca a sus amigos (visibility_library 'amigos' o 'todos')
    pool.query(
      `SELECT g.igdb_id, MIN(g.name) AS name, MIN(g.cover_url) AS cover_url, COUNT(DISTINCT g.user_id)::int AS cuantos
         FROM user_games g JOIN users u ON u.id = g.user_id
        WHERE g.user_id IN (${amigosDe('$1')})
          AND u.visibility_library IN ('amigos', 'todos')
          AND (g.status = 'jugando' OR g.rating >= 8)
        GROUP BY g.igdb_id`,
      [yo]
    ),
    pool.query('SELECT source_id FROM news_follows WHERE user_id = $1', [yo]),
    pool.query('SELECT news_personalization FROM users WHERE id = $1', [yo]),
  ]);
  return {
    biblioteca: biblioteca.rows,
    catalogoAmigos: amigos.rows,
    juegosAmigos: new Map(amigos.rows.map((f) => [f.igdb_id, f.cuantos])),
    seguidos: new Set(seguidos.rows.map((f) => f.source_id)),
    personalizar: usuario.rows[0]?.news_personalization !== false,
  };
}

// Las noticias candidatas: las de los últimos días de portales activos que no he ocultado
async function candidatasDe(yo) {
  const r = await pool.query(
    `SELECT ${COLUMNAS}
       FROM news_articles a JOIN news_sources s ON s.id = a.source_id AND s.active
      WHERE a.published_at > NOW() - make_interval(days => $2)
        AND NOT EXISTS (SELECT 1 FROM news_hidden h WHERE h.user_id = $1 AND h.article_id = a.id)
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT ${CANDIDATAS_MAX}`,
    [yo, DIAS_CANDIDATAS]
  );
  return r.rows;
}

// Preparar una noticia (palabras, texto normalizado) cuesta; se guarda en memoria por id
const preparadas = new Map();
function preparar(fila) {
  const guardada = preparadas.get(fila.id);
  if (guardada && guardada.title === fila.title && guardada.excerpt === fila.excerpt) return guardada;
  if (preparadas.size > 6000) preparadas.clear();
  const p = R.prepararNoticia(fila);
  preparadas.set(fila.id, p);
  return p;
}

// La clasificación de "Para ti" de cada persona: usuario -> { hasta, idioma, lista, porId, idf, contexto }
const clasificaciones = new Map();

async function clasificacionDe(yo, idioma, { nueva = false } = {}) {
  const guardada = clasificaciones.get(yo);
  if (!nueva && guardada && guardada.idioma === idioma && guardada.hasta > Date.now()) return guardada;

  const [contexto, filas] = await Promise.all([contextoDe(yo), candidatasDe(yo)]);
  const noticias = filas.map(preparar);
  const idf = R.idfDe(noticias);
  const hoy = new Date().toISOString().slice(0, 10);
  const puntuadas = R.puntuar(noticias, { ...contexto, idioma, idf });
  const lista = R.ordenar(puntuadas, { clave: `${yo}:${hoy}` });
  const porId = new Map(puntuadas.map((r) => [r.noticia.id, r]));
  for (const r of lista) porId.set(r.noticia.id, r);

  if (clasificaciones.size > 500) clasificaciones.clear();
  const nuevaClasificacion = {
    hasta: Date.now() + MINUTOS_CLASIFICACION * 60_000, idioma, lista, porId, idf, contexto, ocultas: new Set(),
  };
  clasificaciones.set(yo, nuevaClasificacion);
  return nuevaClasificacion;
}

function olvidarClasificacion(yo) {
  clasificaciones.delete(yo);
}

// El motivo, tal como lo ve la interfaz (el juego, sin datos que no hagan falta)
function aMotivo(m) {
  if (!m) return null;
  return m.game
    ? { kind: m.kind, game: { igdb_id: m.game.igdb_id, name: m.game.name, cover_url: m.game.cover_url ?? null } }
    : { kind: m.kind };
}

// ---- Rutas -----------------------------------------------------------------------------

// GET /news/sources — el catálogo de portales, si sigo cada uno y su último titular
async function listSources(req, res) {
  try {
    const r = await pool.query(
      `SELECT s.slug, s.name, s.site_url, s.lang, s.tono,
              EXISTS (SELECT 1 FROM news_follows f WHERE f.user_id = $1 AND f.source_id = s.id) AS following,
              u.title AS last_title, u.published_at AS last_at
         FROM news_sources s
         LEFT JOIN LATERAL (
           SELECT a.title, a.published_at FROM news_articles a
            WHERE a.source_id = s.id ORDER BY a.published_at DESC LIMIT 1
         ) u ON TRUE
        WHERE s.active
        ORDER BY s.lang, s.name`,
      [req.user.id]
    );
    res.json({
      sources: r.rows.map((f) => ({
        slug: f.slug, name: f.name, site: f.site_url, lang: f.lang, tono: f.tono, following: f.following,
        latest: f.last_title ? { title: f.last_title, published_at: f.last_at } : null,
      })),
    });
  } catch (err) {
    errorInterno(res, 'listSources', err);
  }
}

// PUT /news/follows { slugs: [...] } — los portales que sigo (sustituye la lista entera: es lo que
// hacen la primera elección y la ventana de "Tus portales")
async function setFollows(req, res) {
  const slugs = req.body?.slugs;
  if (!Array.isArray(slugs) || slugs.length > 60 || !slugs.every((s) => typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s))) {
    return res.status(400).json({ error: 'La lista de portales no es válida' });
  }
  const yo = req.user.id;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const fuentes = await db.query('SELECT id FROM news_sources WHERE active AND slug = ANY($1::text[])', [slugs]);
    if (fuentes.rows.length !== new Set(slugs).size) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'La lista de portales no es válida' });
    }
    await db.query('DELETE FROM news_follows WHERE user_id = $1', [yo]);
    if (fuentes.rows.length > 0) {
      await db.query(
        'INSERT INTO news_follows (user_id, source_id) SELECT $1, unnest($2::int[])',
        [yo, fuentes.rows.map((f) => f.id)]
      );
    }
    await db.query('COMMIT');
    olvidarClasificacion(yo);
    res.json({ following: fuentes.rows.length });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    errorInterno(res, 'setFollows', err);
  } finally {
    db.release();
  }
}

// GET /news/following?before=<fecha ISO>&before_id=<id> — lo último de mis portales, por fecha
// (20 por página; para la siguiente, la fecha y el id de la última recibida)
async function listFollowing(req, res) {
  const { before, before_id: antesId } = req.query;
  const fecha = before === undefined ? null : new Date(before);
  const id = antesId === undefined ? null : Number(antesId);
  if ((fecha && Number.isNaN(fecha.getTime())) || (antesId !== undefined && !Number.isInteger(id))) {
    return res.status(400).json({ error: 'Parámetro no válido' });
  }
  const yo = req.user.id;
  try {
    const refrescando = await asegurarFrescas();
    const r = await pool.query(
      `SELECT ${COLUMNAS}
         FROM news_articles a
         JOIN news_sources s ON s.id = a.source_id AND s.active
         JOIN news_follows f ON f.source_id = s.id AND f.user_id = $1
        WHERE NOT EXISTS (SELECT 1 FROM news_hidden h WHERE h.user_id = $1 AND h.article_id = a.id)
          AND ($2::timestamptz IS NULL OR (a.published_at, a.id) < ($2::timestamptz, $3::int))
        ORDER BY a.published_at DESC, a.id DESC
        LIMIT ${POR_PAGINA + 1}`,
      [yo, fecha ? fecha.toISOString() : null, id ?? 2147483647]
    );
    const seguidos = await pool.query('SELECT COUNT(*)::int AS n FROM news_follows WHERE user_id = $1', [yo]);
    const filas = r.rows.slice(0, POR_PAGINA);
    res.json({
      articles: filas.map((f) => aNoticia(f)),
      has_more: r.rows.length > POR_PAGINA,
      following: seguidos.rows[0].n,
      refreshing: refrescando,
    });
  } catch (err) {
    errorInterno(res, 'listFollowing', err);
  }
}

// GET /news/for-you?offset=0&lang=es — "Para ti": la clasificación del recomendador, 20 por página,
// cada una con su motivo. `fresh=1` rehace la clasificación (al recargar a propósito); `game=<id>`
// da solo las de un juego de mi biblioteca.
// Trae también los juegos de mi biblioteca de los que más se habla estos dos días (`mentioned`).
async function listForYou(req, res) {
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000) return res.status(400).json({ error: 'Parámetro no válido' });
  const idioma = idiomaDe(req.query.lang);
  const yo = req.user.id;
  try {
    const refrescando = await asegurarFrescas();
    const c = await clasificacionDe(yo, idioma, { nueva: offset === 0 && req.query.fresh === '1' });

    // ?game=<igdb_id>: solo las noticias que mencionan ese juego de mi biblioteca (lo usa "Se
    // habla de tus juegos"), de la más nueva a la más antigua, sin paginar
    if (req.query.game !== undefined) {
      const juego = Number(req.query.game);
      if (!Number.isInteger(juego)) return res.status(400).json({ error: 'Parámetro no válido' });
      const delJuego = [...c.porId.values()]
        .filter((r) => r.juego?.igdb_id === juego && !c.ocultas.has(r.noticia.id))
        .sort((a, b) => new Date(b.noticia.published_at) - new Date(a.noticia.published_at))
        .slice(0, 40);
      return res.json({
        articles: delJuego.map((r, i) => aNoticia(r.noticia, { reason: aMotivo({ kind: 'juego', game: r.juego }), position: i })),
        // Sin `mentioned`: la lista de "Se habla de tus juegos" no cambia por filtrar
        has_more: false, library_size: c.contexto.biblioteca.length, refreshing: refrescando,
      });
    }
    // Las que ocultes mientras tanto no se envían, pero la lista no se toca: si se quitaran, las de
    // detrás se correrían un puesto y al pedir la página siguiente se saltaría una
    const pagina = c.lista
      .map((r, i) => ({ r, posicion: i }))
      .slice(offset, offset + POR_PAGINA)
      .filter(({ r }) => !c.ocultas.has(r.noticia.id));

    // Mis juegos de los que se habla: los mencionados en las noticias de las últimas 48 horas
    let mencionados = [];
    if (offset === 0) {
      const desde = Date.now() - 48 * 3_600_000;
      const cuenta = new Map();
      for (const r of c.porId.values()) {
        if (r.juego && new Date(r.noticia.published_at).getTime() >= desde) {
          const previo = cuenta.get(r.juego.igdb_id) ?? { juego: r.juego, n: 0 };
          previo.n += 1;
          cuenta.set(r.juego.igdb_id, previo);
        }
      }
      mencionados = [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, 6)
        .map(({ juego, n }) => ({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url ?? null, count: n }));
    }

    res.json({
      articles: pagina.map(({ r, posicion }) => aNoticia(r.noticia, { reason: aMotivo(r.motivo), position: posicion })),
      has_more: offset + POR_PAGINA < c.lista.length,
      mentioned: mencionados,
      library_size: c.contexto.biblioteca.length,
      refreshing: refrescando,
    });
  } catch (err) {
    errorInterno(res, 'listForYou', err);
  }
}

// Las señales con las que se enseñó una noticia (de la clasificación en memoria; si ya no está,
// se calculan ahora y se marcan con `tarde: 1`)
async function senalesDe(yo, articuloId, idioma) {
  let c = clasificaciones.get(yo);
  let r = c?.porId.get(articuloId);
  if (r) return R.caracteristicas(r);
  c = c ?? await clasificacionDe(yo, idioma);
  const fila = await pool.query(`SELECT ${COLUMNAS} FROM news_articles a JOIN news_sources s ON s.id = a.source_id WHERE a.id = $1`, [articuloId]);
  if (!fila.rows[0]) return null;
  [r] = R.puntuar([preparar(fila.rows[0])], { ...c.contexto, idioma: c.idioma, idf: c.idf });
  return { ...R.caracteristicas(r), tarde: 1 };
}

// POST /news/events { events: [{ article_id, kind: 'impression'|'click', feed, position }] }
// Lo manda la interfaz por tandas. Con la personalización apagada no se guarda nada (204 igual).
async function logEvents(req, res) {
  const eventos = req.body?.events;
  if (!Array.isArray(eventos) || eventos.length === 0 || eventos.length > EVENTOS_MAX) {
    return res.status(400).json({ error: 'Eventos no válidos' });
  }
  const validos = eventos.filter((e) => e && Number.isInteger(e.article_id) && e.article_id > 0
    && TIPOS_EVENTO.has(e.kind) && PESTANAS.has(e.feed)
    && (e.position == null || (Number.isInteger(e.position) && e.position >= 0 && e.position <= 1000)));
  if (validos.length !== eventos.length) return res.status(400).json({ error: 'Eventos no válidos' });

  const yo = req.user.id;
  try {
    const u = await pool.query('SELECT news_personalization FROM users WHERE id = $1', [yo]);
    if (u.rows[0]?.news_personalization === false) return res.status(204).end();

    const idioma = idiomaDe(req.body?.lang);
    const filas = [];
    for (const e of validos) {
      filas.push({ ...e, features: await senalesDe(yo, e.article_id, idioma) });
    }
    // Solo las de noticias que existen (una noticia borrada entre medias se ignora)
    await pool.query(
      `INSERT INTO news_events (user_id, article_id, kind, feed, position, features)
       SELECT $1, x.a, x.k, x.f, x.p, x.c::jsonb
         FROM unnest($2::int[], $3::text[], $4::text[], $5::int[], $6::text[]) AS x(a, k, f, p, c)
        WHERE EXISTS (SELECT 1 FROM news_articles n WHERE n.id = x.a)`,
      [
        yo, filas.map((f) => f.article_id), filas.map((f) => f.kind), filas.map((f) => f.feed),
        filas.map((f) => f.position ?? null), filas.map((f) => (f.features ? JSON.stringify(f.features) : null)),
      ]
    );
    res.status(204).end();
  } catch (err) {
    errorInterno(res, 'logEvents', err);
  }
}

// POST /news/articles/:id/hide { feed?, position? } — "No me interesa": no me la vuelvas a enseñar.
// También queda registrado como evento 'hide' (con la personalización activa).
async function hideArticle(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Noticia no encontrada' });
  const yo = req.user.id;
  const feed = PESTANAS.has(req.body?.feed) ? req.body.feed : 'para_ti';
  const posicion = Number.isInteger(req.body?.position) && req.body.position >= 0 && req.body.position <= 1000 ? req.body.position : null;
  try {
    const r = await pool.query(
      `INSERT INTO news_hidden (user_id, article_id)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM news_articles WHERE id = $2)
       ON CONFLICT DO NOTHING RETURNING article_id`,
      [yo, id]
    );
    const existe = r.rows.length > 0 || (await pool.query('SELECT 1 FROM news_hidden WHERE user_id = $1 AND article_id = $2', [yo, id])).rows.length > 0;
    if (!existe) return res.status(404).json({ error: 'Noticia no encontrada' });

    const u = await pool.query('SELECT news_personalization FROM users WHERE id = $1', [yo]);
    if (r.rows.length > 0 && u.rows[0]?.news_personalization !== false) {
      const features = await senalesDe(yo, id, idiomaDe(req.body?.lang));
      await pool.query(
        `INSERT INTO news_events (user_id, article_id, kind, feed, position, features) VALUES ($1, $2, 'hide', $3, $4, $5::jsonb)`,
        [yo, id, feed, posicion, features ? JSON.stringify(features) : null]
      );
    }
    // La clasificación guardada ya no vale (esa noticia no debe volver a salir)
    clasificaciones.get(yo)?.ocultas.add(id);
    res.json({ hidden: true });
  } catch (err) {
    errorInterno(res, 'hideArticle', err);
  }
}

// DELETE /news/articles/:id/hide — deshacer "No me interesa"
async function unhideArticle(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Noticia no encontrada' });
  try {
    await pool.query('DELETE FROM news_hidden WHERE user_id = $1 AND article_id = $2', [req.user.id, id]);
    // Si sigue en la clasificación guardada, vuelve a enviarse; si no (se ocultó antes de hacerla),
    // aparecerá en la próxima
    clasificaciones.get(req.user.id)?.ocultas.delete(id);
    res.json({ hidden: false });
  } catch (err) {
    errorInterno(res, 'unhideArticle', err);
  }
}

module.exports = {
  listSources, setFollows, listFollowing, listForYou, logEvents, hideArticle, unhideArticle, olvidarClasificacion,
};

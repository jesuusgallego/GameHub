// Las noticias por dentro: el catálogo de portales, leerlos y guardar lo nuevo.
//
// Cuándo se leen los portales: NO hay un temporizador. En el plan gratuito, Render se duerme a los
// 15 minutos sin peticiones y Neon a los 5; un temporizador los mantendría despiertos (y gastaría
// las horas de cómputo de Neon) aunque nadie mirara las noticias. En su lugar, cada vez que
// alguien abre las noticias se llama a `asegurarFrescas()`:
//  - si hace menos de MINUTOS_FRESCAS que se leyeron, no hace nada;
//  - si hace más, las vuelve a leer EN SEGUNDO PLANO y la respuesta sale ya con lo que había (la
//    interfaz pregunta otra vez al poco, ver Noticias.jsx);
//  - si no hay ninguna noticia todavía (base de datos nueva), espera a la lectura para no
//    responder con una página vacía.
// Una sola lectura a la vez: si llegan dos peticiones, la segunda se suma a la que ya está en curso.
const pool = require('../config/db');
const PORTALES = require('../config/portales');
const { descargarFeed, leerFeed } = require('./rss');

const MINUTOS_FRESCAS = 20;
// Cuántos portales se leen a la vez (no saturar la conexión ni el servidor gratuito)
const A_LA_VEZ = 4;
// Noticias más antiguas que esto ni se guardan; las guardadas se borran a esta edad, salvo las que
// tienen interacciones registradas (ver news_articles en schema.sql)
const DIAS_NOTICIAS = 30;
const DIAS_EVENTOS = 180;
// La primera lectura (sin noticias) espera como mucho esto antes de responder
const ESPERA_PRIMERA_MS = 25_000;

let enCurso = null;
let ultimaLectura = 0;

// Copia el catálogo (config/portales.js) a news_sources: inserta los nuevos, actualiza los que
// cambian y desactiva los que ya no están. Se llama al arrancar el servidor.
async function sincronizarPortales(db = pool) {
  for (const p of PORTALES) {
    await db.query(
      `INSERT INTO news_sources (slug, name, site_url, feed_url, lang, tono, active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, site_url = EXCLUDED.site_url, lang = EXCLUDED.lang,
             tono = EXCLUDED.tono, active = TRUE,
             -- Si cambia la dirección del feed, lo que se sabía del anterior ya no vale
             etag = CASE WHEN news_sources.feed_url = EXCLUDED.feed_url THEN news_sources.etag END,
             last_modified = CASE WHEN news_sources.feed_url = EXCLUDED.feed_url THEN news_sources.last_modified END,
             feed_url = EXCLUDED.feed_url`,
      [p.slug, p.name, p.site, p.feed, p.lang, p.tono]
    );
  }
  await db.query('UPDATE news_sources SET active = FALSE WHERE NOT (slug = ANY($1::text[]))', [PORTALES.map((p) => p.slug)]);
  const ultima = await db.query('SELECT MAX(fetched_at) AS ultima FROM news_sources WHERE active');
  ultimaLectura = ultima.rows[0]?.ultima ? new Date(ultima.rows[0].ultima).getTime() : 0;
}

// Guarda las noticias de un portal. Las que ya estaban (mismo guid) se actualizan por si el portal
// corrigió el titular o puso la imagen después; su fecha no se toca.
async function guardarNoticias(fuenteId, noticias, ahora = Date.now()) {
  const limite = ahora - DIAS_NOTICIAS * 86_400_000;
  const validas = noticias.filter((n) => n.published_at.getTime() >= limite);
  if (validas.length === 0) return 0;
  await pool.query(
    `INSERT INTO news_articles (source_id, guid, url, title, excerpt, image_url, published_at)
     SELECT $1, g, u, t, e, i, p
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[]) AS x(g, u, t, e, i, p)
     ON CONFLICT (source_id, guid) DO UPDATE
       SET title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, url = EXCLUDED.url,
           image_url = COALESCE(EXCLUDED.image_url, news_articles.image_url)`,
    [
      fuenteId,
      validas.map((n) => n.guid), validas.map((n) => n.url), validas.map((n) => n.title),
      validas.map((n) => n.excerpt), validas.map((n) => n.image), validas.map((n) => n.published_at.toISOString()),
    ]
  );
  return validas.length;
}

// Lee un portal y guarda lo nuevo. Un fallo (portal caído, feed roto) se apunta y no para al resto.
async function leerPortal(fuente) {
  try {
    const r = await descargarFeed(fuente.feed_url, fuente);
    if (r.estado === 200) {
      const guardadas = await guardarNoticias(fuente.id, leerFeed(r.xml));
      await pool.query(
        `UPDATE news_sources SET fetched_at = NOW(), fetch_error = NULL, etag = $2, last_modified = $3 WHERE id = $1`,
        [fuente.id, r.etag, r.last_modified]
      );
      return guardadas;
    }
    await pool.query('UPDATE news_sources SET fetched_at = NOW(), fetch_error = NULL WHERE id = $1', [fuente.id]);
    return 0;
  } catch (err) {
    await pool.query(
      'UPDATE news_sources SET fetched_at = NOW(), fetch_error = $2 WHERE id = $1',
      [fuente.id, String(err.message).slice(0, 300)]
    ).catch(() => {});
    return 0;
  }
}

// Borra lo caducado: noticias de más de DIAS_NOTICIAS sin interacciones e interacciones de más de
// DIAS_EVENTOS (con ellas se van también las noticias que solo seguían por ellas, en la siguiente)
async function purgar() {
  await pool.query(`DELETE FROM news_events WHERE created_at < NOW() - make_interval(days => $1)`, [DIAS_EVENTOS]);
  await pool.query(
    `DELETE FROM news_articles a
      WHERE a.published_at < NOW() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM news_events e WHERE e.article_id = a.id)`,
    [DIAS_NOTICIAS]
  );
}

// Lee todos los portales activos (A_LA_VEZ en paralelo). Devuelve cuántas noticias se guardaron.
async function leerTodos() {
  const fuentes = (await pool.query('SELECT * FROM news_sources WHERE active ORDER BY id')).rows;
  let total = 0;
  for (let i = 0; i < fuentes.length; i += A_LA_VEZ) {
    const tanda = await Promise.all(fuentes.slice(i, i + A_LA_VEZ).map(leerPortal));
    total += tanda.reduce((a, b) => a + b, 0);
  }
  await purgar();
  return total;
}

// Lanza una lectura si no hay ninguna en curso; devuelve su promesa
function refrescar() {
  if (!enCurso) {
    enCurso = leerTodos()
      .catch((err) => { console.error('No se pudieron leer las noticias:', err.message); return 0; })
      .finally(() => { ultimaLectura = Date.now(); enCurso = null; });
  }
  return enCurso;
}

// Lo que llaman los controladores antes de responder. Devuelve true si hay una lectura en marcha
// (la interfaz volverá a preguntar al poco para enseñar lo nuevo).
async function asegurarFrescas() {
  if (Date.now() - ultimaLectura < MINUTOS_FRESCAS * 60_000 && !enCurso) return false;
  const lectura = refrescar();
  const hay = await pool.query('SELECT 1 FROM news_articles LIMIT 1');
  if (hay.rows.length === 0) {
    // Base de datos sin noticias: espero a la lectura (con un tope) para no responder vacío
    await Promise.race([lectura, new Promise((r) => { setTimeout(r, ESPERA_PRIMERA_MS).unref?.(); })]);
    return Boolean(enCurso);
  }
  return true;
}

// Solo para las pruebas
function _reiniciar(valor = 0) {
  ultimaLectura = valor;
  enCurso = null;
}

module.exports = {
  sincronizarPortales, asegurarFrescas, refrescar, guardarNoticias, purgar, _reiniciar,
  MINUTOS_FRESCAS, DIAS_NOTICIAS, DIAS_EVENTOS,
};

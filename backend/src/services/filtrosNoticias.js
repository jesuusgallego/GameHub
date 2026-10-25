// El orden y los filtros de las listas de noticias ("Para ti" y "Siguiendo"), sin base de datos
// para poder probarlos (test/noticias.test.js). Los usa controllers/newsController.js.
//
// Parámetros de la petición (todos opcionales):
//  - sort: 'recent' (de la más nueva a la más antigua; lo normal), 'oldest' (al revés) o
//    'relevance' (el orden del recomendador; solo en "Para ti")
//  - period: 'all' (sin límite), '24h', '3d' o '7d': solo las publicadas en ese tiempo
//  - source: el slug de un portal (solo las suyas)
//  - mine: '1' = solo las que hablan de un juego de mi biblioteca (solo en "Para ti")

const ORDENES = new Set(['recent', 'oldest', 'relevance']);
// Horas de cada periodo (null = sin límite)
const PERIODOS = { all: null, '24h': 24, '3d': 72, '7d': 168 };
const SLUG = /^[a-z0-9-]{1,40}$/;

// Lee y valida los parámetros. Devuelve { sort, horas, source, mine } o null si alguno no vale.
function leerOpciones(query = {}) {
  const sort = query.sort ?? 'recent';
  const period = query.period ?? 'all';
  const source = query.source ?? null;
  if (!ORDENES.has(sort)) return null;
  if (!Object.hasOwn(PERIODOS, period)) return null;
  if (source !== null && !SLUG.test(source)) return null;
  if (query.mine !== undefined && query.mine !== '1' && query.mine !== '0') return null;
  return { sort, horas: PERIODOS[period], source, mine: query.mine === '1' };
}

const fecha = (r) => new Date(r.noticia.published_at).getTime();

// Filtra y ordena una lista del recomendador ([{ noticia, juego?, ... }], ya en el orden de la
// recomendación). Con 'relevance' conserva ese orden; si no, por fecha (y por id cuando dos noticias
// tienen la misma, para que el orden sea siempre el mismo y la paginación no repita ni salte).
// No cambia la lista que recibe.
function filtrarYOrdenar(lista, opciones, ahora = Date.now()) {
  const desde = opciones.horas ? ahora - opciones.horas * 3_600_000 : null;
  const filtrada = lista.filter((r) => (
    (desde === null || fecha(r) >= desde)
    && (!opciones.source || r.noticia.slug === opciones.source)
    && (!opciones.mine || Boolean(r.juego))
  ));
  if (opciones.sort === 'relevance') return filtrada;
  const signo = opciones.sort === 'oldest' ? 1 : -1;
  return filtrada.sort((a, b) => signo * (fecha(a) - fecha(b) || a.noticia.id - b.noticia.id));
}

module.exports = { leerOpciones, filtrarYOrdenar, PERIODOS };

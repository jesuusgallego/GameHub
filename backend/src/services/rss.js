// Leer los RSS (y Atom) de los portales de noticias.
//
// Dos partes:
//  - descargarFeed(portal, cache): pide el feed por HTTP. Manda If-None-Match / If-Modified-Since
//    con lo que dijo la última vez el portal: si no hay nada nuevo responde 304 y no se descarga
//    nada. Decodifica los bytes con la codificación que declara el feed (casi todos UTF-8;
//    Vandal, ISO-8859-1: leído como UTF-8 saldría "deber�as").
//  - leerFeed(xml): convierte el XML en una lista de noticias limpias (sin HTML), lista para
//    guardar. No toca la red: así se prueba con feeds de ejemplo (test/rss.test.js).
//
// Lo que se guarda de cada noticia es lo mínimo para enseñar una tarjeta y enlazar al original:
// titular, un extracto corto, imagen, fecha y enlace. El artículo entero NO se guarda aunque el
// feed lo traiga (algunos lo traen): GameHub enlaza a los portales, no copia su trabajo.
const { XMLParser } = require('fast-xml-parser');

// Longitudes máximas (las mismas que las columnas de news_articles en schema.sql)
const TITULO_MAX = 300;
const EXTRACTO_MAX = 280;
const URL_MAX = 1000;
// Un feed de más de esto se descarta: ninguno normal se acerca (el mayor pesa ~1,5 MB)
const BYTES_MAX = 6 * 1024 * 1024;
const TIEMPO_MAX_MS = 10_000;
const AGENTE = 'GameHubBot/1.5 (+https://github.com/jesuusgallego/GameHub)';

// Las etiquetas que pueden repetirse: el lector las da siempre como lista, aunque haya una sola
const REPETIBLES = new Set(['item', 'entry', 'link', 'enclosure', 'media:content', 'media:thumbnail', 'category']);

const lector = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false, // todo como texto: "007" no debe acabar siendo el número 7
  trimValues: true,
  isArray: (nombre) => REPETIBLES.has(nombre),
});

// ---- Texto -----------------------------------------------------------------------------

// Las entidades de HTML más comunes que dejan los portales dentro de sus textos. Las de XML
// (&amp; &lt;...) ya las resuelve el lector; estas llegan dentro de CDATA o escapadas dos veces.
const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  ccedil: 'ç', euro: '€', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•',
};

function decodificarEntidades(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entera, cuerpo) => {
    if (cuerpo[0] === '#') {
      const codigo = cuerpo[1] === 'x' || cuerpo[1] === 'X' ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
      // Fuera de rango o un carácter de control: lo quito
      return codigo > 31 && codigo <= 0x10ffff && !(codigo >= 0xd800 && codigo <= 0xdfff) ? String.fromCodePoint(codigo) : ' ';
    }
    return ENTIDADES[cuerpo] ?? entera;
  });
}

// El texto de un nodo del lector: puede venir como texto, como { '#text': ... } (si la etiqueta
// tenía atributos) o no venir
function texto(nodo) {
  if (nodo == null) return '';
  if (typeof nodo === 'string') return nodo;
  if (typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return texto(nodo[0]);
  return typeof nodo['#text'] === 'string' ? nodo['#text'] : '';
}

// HTML a texto plano: sin etiquetas (ni el contenido de <script>, <style> y comentarios), con las
// entidades resueltas y los espacios juntados. Lo que queda se pinta siempre como TEXTO en la
// interfaz (React no interpreta HTML), así que aunque se colara una etiqueta no se ejecutaría.
function textoPlano(html) {
  return decodificarEntidades(
    decodificarEntidades(html) // algunos portales escapan el HTML dos veces
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Recorta en el último espacio antes del tope y añade "…" (nunca a mitad de palabra)
function recortar(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s.,;:¡!¿?(-]+$/, '')}…`;
}

// Una dirección web válida (http/https), pasada a https si venía en http (en la app, una imagen
// por http se bloquea), o null
function urlValida(texto) {
  if (typeof texto !== 'string') return null;
  try {
    const url = new URL(decodificarEntidades(texto.trim()));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.protocol = 'https:';
    const final = url.toString();
    return final.length <= URL_MAX ? final : null;
  } catch {
    return null;
  }
}

// ---- Imagen ----------------------------------------------------------------------------

function esImagen(nodo) {
  const tipo = (nodo['@_type'] ?? '').toLowerCase();
  const medio = (nodo['@_medium'] ?? '').toLowerCase();
  const url = nodo['@_url'] ?? '';
  if (medio === 'image' || tipo.startsWith('image/')) return true;
  if (medio || tipo) return false; // vídeo, audio...
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

// La mejor imagen de una noticia: la de enclosure o media:content (la más ancha si hay varias),
// la miniatura de media:thumbnail o, si no, la primera <img> del contenido
function imagenDe(item, html) {
  const candidatas = [
    ...(item.enclosure ?? []),
    ...(item['media:content'] ?? []),
    ...(item['media:group']?.['media:content'] ?? []),
  ].filter((n) => n && typeof n === 'object' && esImagen(n));
  candidatas.sort((a, b) => Number(b['@_width'] ?? 0) - Number(a['@_width'] ?? 0));
  for (const c of candidatas) {
    const url = urlValida(c['@_url']);
    if (url) return url;
  }
  for (const m of [...(item['media:thumbnail'] ?? []), ...(item['media:group']?.['media:thumbnail'] ?? [])]) {
    const url = urlValida(m?.['@_url']);
    if (url) return url;
  }
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(decodificarEntidades(html));
  return img ? urlValida(img[1]) : null;
}

// ---- Noticias --------------------------------------------------------------------------

// El enlace de una entrada: en RSS es el texto de <link>; en Atom, <link href> (el "alternate")
function enlaceDe(item) {
  for (const l of item.link ?? []) {
    if (typeof l === 'string') return urlValida(l);
    const rel = l['@_rel'] ?? 'alternate';
    if (rel === 'alternate' && l['@_href']) return urlValida(l['@_href']);
    if (!l['@_href'] && texto(l)) return urlValida(texto(l));
  }
  return null;
}

// La fecha de publicación; sin fecha o con una futura (pasa), se toma la de ahora
function fechaDe(item, ahora) {
  for (const campo of ['pubDate', 'published', 'updated', 'dc:date']) {
    const ms = Date.parse(texto(item[campo]));
    if (Number.isFinite(ms)) return new Date(Math.min(ms, ahora));
  }
  return new Date(ahora);
}

// XML de un feed -> [{ guid, url, title, excerpt, image, published_at }]. Lo que no tiene
// titular o enlace válido se descarta. Si el XML no es un feed, error.
function leerFeed(xml, ahora = Date.now()) {
  const raiz = lector.parse(xml);
  const items = raiz?.rss?.channel?.item ?? raiz?.feed?.entry ?? raiz?.['rdf:RDF']?.item;
  if (!Array.isArray(items)) throw new Error('No es un RSS ni un Atom');

  const vistas = new Set();
  const noticias = [];
  for (const item of items) {
    const url = enlaceDe(item);
    const titulo = recortar(textoPlano(texto(item.title)), TITULO_MAX);
    if (!url || !titulo) continue;

    // El cuerpo: el resumen si lo hay; si no, el contenido completo (del que solo se queda un extracto)
    const html = texto(item.description) || texto(item.summary) || texto(item['content:encoded']) || texto(item.content);
    const guid = (texto(item.guid) || texto(item.id) || url).slice(0, URL_MAX);
    if (vistas.has(guid)) continue;
    vistas.add(guid);

    noticias.push({
      guid,
      url,
      title: titulo,
      excerpt: recortar(textoPlano(html), EXTRACTO_MAX),
      // La imagen se busca en el resumen y también en el contenido completo (algunos portales
      // solo la ponen ahí)
      image: imagenDe(item, `${html} ${texto(item['content:encoded'])} ${texto(item.content)}`),
      published_at: fechaDe(item, ahora),
    });
  }
  return noticias;
}

// ---- Descarga --------------------------------------------------------------------------

// La codificación del feed: la de la cabecera Content-Type o, si no, la de la declaración XML
function codificacionDe(cabecera, inicio) {
  const enCabecera = /charset=["']?([\w-]+)/i.exec(cabecera ?? '');
  const enXml = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(inicio);
  return (enCabecera?.[1] ?? enXml?.[1] ?? 'utf-8').toLowerCase();
}

// Descarga un feed. `cache` es { etag, last_modified } de la última vez. Devuelve
// { estado: 304 } si no hay nada nuevo, o { estado: 200, xml, etag, last_modified }.
async function descargarFeed(feedUrl, cache = {}) {
  const cabeceras = { 'User-Agent': AGENTE, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5' };
  if (cache.etag) cabeceras['If-None-Match'] = cache.etag;
  if (cache.last_modified) cabeceras['If-Modified-Since'] = cache.last_modified;

  const respuesta = await fetch(feedUrl, { headers: cabeceras, redirect: 'follow', signal: AbortSignal.timeout(TIEMPO_MAX_MS) });
  if (respuesta.status === 304) return { estado: 304 };
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

  const largo = Number(respuesta.headers.get('content-length') ?? 0);
  if (largo > BYTES_MAX) throw new Error('Feed demasiado grande');
  const bytes = new Uint8Array(await respuesta.arrayBuffer());
  if (bytes.length > BYTES_MAX) throw new Error('Feed demasiado grande');

  const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 200));
  let decodificador;
  try {
    decodificador = new TextDecoder(codificacionDe(respuesta.headers.get('content-type'), inicio));
  } catch {
    decodificador = new TextDecoder('utf-8');
  }
  return {
    estado: 200,
    xml: decodificador.decode(bytes),
    etag: respuesta.headers.get('etag'),
    last_modified: respuesta.headers.get('last-modified'),
  };
}

module.exports = {
  leerFeed, descargarFeed, textoPlano, recortar, urlValida, codificacionDe, decodificarEntidades,
  TITULO_MAX, EXTRACTO_MAX,
};

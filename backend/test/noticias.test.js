// Pruebas de las noticias sin red ni base de datos: leer RSS y Atom (con sus rarezas reales) y el
// recomendador de "Para ti" (señales, nombres de juegos, orden, variedad y exploración). La lectura
// de los 24 portales de verdad y la API se probaron contra el backend real sobre PGlite; ver
// docs/DESARROLLO.md, sección Noticias.
// npm test
const { test } = require('node:test');
const assert = require('node:assert');

const { leerFeed, textoPlano, recortar, urlValida, codificacionDe, EXTRACTO_MAX } = require('../src/services/rss');
const R = require('../src/services/recomendador');
const PORTALES = require('../src/config/portales');

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Portal</title>
  <item>
    <title><![CDATA[Análisis de <b>Hades II</b> &amp; más]]></title>
    <link>http://portal.example.com/hades-2</link>
    <guid isPermaLink="false">abc-1</guid>
    <pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Supergiant vuelve&nbsp;con fuerza.</p><script>alert(1)</script>]]></description>
    <media:content url="https://img.example.com/peq.jpg" medium="image" width="300"/>
    <media:content url="https://img.example.com/grande.jpg" medium="image" width="1200"/>
  </item>
  <item>
    <title>Tráiler nuevo</title>
    <link>https://portal.example.com/trailer</link>
    <pubDate>Fri, 23 Oct 2026 09:00:00 GMT</pubDate>
    <description>&lt;img src="https://img.example.com/en-el-texto.jpg"&gt;Un vídeo de &amp;#8220;GTA 6&amp;#8221;</description>
    <enclosure url="https://video.example.com/a.mp4" type="video/mp4"/>
  </item>
  <item><title></title><link>https://portal.example.com/sin-titulo</link></item>
  <item><title>Sin enlace</title></item>
  <item><title>Del futuro</title><link>https://portal.example.com/futuro</link><pubDate>Mon, 01 Jan 2099 00:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="html">Xbox &amp;amp; PlayStation</title>
    <link rel="alternate" type="text/html" href="https://atom.example.com/a"/>
    <link rel="enclosure" href="https://atom.example.com/a.mp3"/>
    <id>tag:atom.example.com,2026:1</id>
    <published>2026-10-22T08:00:00Z</published>
    <content type="html">&lt;figure&gt;&lt;img src="https://img.example.com/atom.jpg"&gt;&lt;/figure&gt;&lt;p&gt;Texto largo del artículo&lt;/p&gt;</content>
  </entry>
</feed>`;

const AHORA = Date.parse('2026-10-24T12:00:00Z');

test('leerFeed: RSS con CDATA, HTML, entidades, imágenes y entradas malas', () => {
  const n = leerFeed(RSS, AHORA);
  assert.strictEqual(n.length, 3, 'sin las que no tienen titular o enlace');
  assert.strictEqual(n[0].title, 'Análisis de Hades II & más');
  assert.strictEqual(n[0].excerpt, 'Supergiant vuelve con fuerza.', 'sin etiquetas ni <script>');
  assert.strictEqual(n[0].url, 'https://portal.example.com/hades-2', 'http pasa a https');
  assert.strictEqual(n[0].guid, 'abc-1');
  assert.strictEqual(n[0].image, 'https://img.example.com/grande.jpg', 'la imagen más ancha');
  assert.strictEqual(n[1].image, 'https://img.example.com/en-el-texto.jpg', 'un vídeo no es imagen: la del texto');
  assert.strictEqual(n[1].excerpt, 'Un vídeo de “GTA 6”', 'entidades escapadas dos veces');
  assert.strictEqual(n[1].guid, 'https://portal.example.com/trailer', 'sin guid, el enlace');
  assert.strictEqual(n[2].published_at.getTime(), AHORA, 'una fecha futura pasa a ahora');
});

test('leerFeed: Atom con enlace alternate, contenido escapado y su imagen', () => {
  const [a] = leerFeed(ATOM, AHORA);
  assert.strictEqual(a.title, 'Xbox & PlayStation');
  assert.strictEqual(a.url, 'https://atom.example.com/a');
  assert.strictEqual(a.image, 'https://img.example.com/atom.jpg');
  assert.strictEqual(a.excerpt, 'Texto largo del artículo');
  assert.strictEqual(a.published_at.toISOString(), '2026-10-22T08:00:00.000Z');
});

test('leerFeed: lo que no es un feed es un error', () => {
  assert.throws(() => leerFeed('<html><body>hola</body></html>'));
});

test('extracto: nunca el artículo entero, cortado en una palabra', () => {
  const largo = `<p>${'palabra '.repeat(200)}</p>`;
  const [n] = leerFeed(RSS.replace('<p>Supergiant vuelve&nbsp;con fuerza.</p>', largo), AHORA);
  assert.ok(n.excerpt.length <= EXTRACTO_MAX);
  assert.ok(n.excerpt.endsWith('palabra…'));
  assert.strictEqual(recortar('corto', 10), 'corto');
  assert.strictEqual(textoPlano('a<br>b<!-- x -->c'), 'a b c');
});

test('urlValida y codificación del feed', () => {
  assert.strictEqual(urlValida('javascript:alert(1)'), null);
  assert.strictEqual(urlValida('ftp://x.com/a'), null);
  assert.strictEqual(urlValida('no es una url'), null);
  assert.strictEqual(urlValida('http://x.com/a?b=1&amp;c=2'), 'https://x.com/a?b=1&c=2');
  assert.strictEqual(codificacionDe('text/xml; charset=ISO-8859-1', ''), 'iso-8859-1');
  assert.strictEqual(codificacionDe('text/xml', '<?xml version="1.0" encoding="iso-8859-1"?>'), 'iso-8859-1');
  assert.strictEqual(codificacionDe(null, '<rss>'), 'utf-8');
  // Vandal llega en ISO-8859-1: con su codificación, las tildes salen bien
  const bytes = Buffer.from('<?xml version="1.0" encoding="iso-8859-1"?><rss><channel><item><title>Deberías</title><link>https://v.com/a</link></item></channel></rss>', 'latin1');
  const xml = new TextDecoder(codificacionDe(null, bytes.toString('latin1'))).decode(bytes);
  assert.strictEqual(leerFeed(xml, AHORA)[0].title, 'Deberías');
});

test('catálogo de portales: slugs únicos, idiomas y direcciones https', () => {
  assert.strictEqual(new Set(PORTALES.map((p) => p.slug)).size, PORTALES.length);
  for (const p of PORTALES) {
    assert.match(p.slug, /^[a-z0-9-]{1,40}$/, p.slug);
    assert.ok(['es', 'en'].includes(p.lang), p.slug);
    assert.ok(p.feed.startsWith('https://') && p.site.startsWith('https://'), p.slug);
    assert.ok(Number.isInteger(p.tono) && p.tono >= 0 && p.tono < 360, p.slug);
  }
});

// ---- Recomendador ----------------------------------------------------------------------

const noticia = (id, title, extra = {}) => R.prepararNoticia({
  id, title, excerpt: '', source_id: id % 5, lang: 'es', published_at: new Date(AHORA - id * 3_600_000), ...extra,
});

test('nombres de juegos: partes del nombre y nombres cortos con mayúscula', () => {
  const zelda = R.aliasDeJuego('The Legend of Zelda: Tears of the Kingdom');
  assert.deepStrictEqual(zelda.map((a) => a.alias), ['legend of zelda tears of the kingdom', 'legend of zelda', 'tears of the kingdom']);
  assert.ok(R.menciona(noticia(1, 'Nuevo parche de Tears of the Kingdom'), zelda));
  const hades = R.aliasDeJuego('Hades');
  assert.ok(R.menciona(noticia(1, 'Hades II sale de acceso anticipado'), hades));
  assert.ok(R.menciona(noticia(1, 'HADES ya tiene fecha'), hades));
  assert.ok(!R.menciona(noticia(1, 'el dios hades en la mitología'), hades), 'en minúscula es una palabra corriente');
  assert.ok(!R.menciona(noticia(1, 'Hadestown llega a Madrid'), hades), 'palabra entera');
  const control = R.aliasDeJuego('Control');
  assert.ok(!R.menciona(noticia(1, 'Toma el control de tu equipo'), control));
  assert.deepStrictEqual(R.aliasDeJuego('Ico'), [], 'tres letras: no se busca');
  assert.ok(R.menciona(noticia(1, 'Pokémon Escarlata recibe DLC'), R.aliasDeJuego('Pokemon Escarlata')), 'sin tildes');
});

test('interes: estado, nota y horas', () => {
  assert.strictEqual(R.interes({ status: 'jugando' }), 1);
  assert.strictEqual(R.interes({ status: 'completado' }), 0.6);
  assert.strictEqual(R.interes({ status: 'completado', rating: 9 }), 0.9);
  assert.strictEqual(R.interes({ status: 'abandonado', rating: 3 }), 0.1);
  const conHoras = R.interes({ status: 'pendiente', playtime_minutes: 6000 });
  assert.ok(conHoras > 0.5 && conHoras <= 0.7, String(conHoras));
});

test('TF-IDF: las palabras raras pesan más y el coseno va de 0 a 1', () => {
  const ns = [noticia(1, 'Silksong tráiler nuevo'), noticia(2, 'Tráiler de Halo'), noticia(3, 'Tráiler de Zelda')];
  const idf = R.idfDe(ns);
  assert.ok(idf.get('silksong') > idf.get('trailer'));
  const a = R.vectorTfIdf(ns[0].tf, idf);
  assert.ok(Math.abs(R.coseno(a, a) - 1) < 1e-9);
  assert.strictEqual(R.coseno(a, R.vectorTfIdf(new Map([['nada', 1]]), idf)), 0);
});

test('puntuar: señales entre 0 y 1, sus pesos y el motivo', () => {
  const biblioteca = [{ igdb_id: 7, name: 'Elden Ring', status: 'jugando', developers: ['FromSoftware'], genres: ['Role-playing (RPG)'] }];
  const ns = [noticia(1, 'Elden Ring recibe un parche'), noticia(2, 'FromSoftware prepara un RPG'), noticia(30, 'Una noticia cualquiera', { lang: 'en' })];
  const [a, b, c] = R.puntuar(ns, { biblioteca, idioma: 'es', ahora: AHORA, seguidos: new Set([2]) });
  for (const r of [a, b, c]) for (const v of Object.values(r.senales)) assert.ok(v >= 0 && v <= 1);
  assert.strictEqual(a.senales.juego, 1);
  assert.strictEqual(a.juego.igdb_id, 7);
  assert.strictEqual(b.senales.juego, 0);
  assert.ok(b.senales.similitud > 0, 'el estudio y el género cuentan');
  assert.strictEqual(c.senales.idioma, 0);
  assert.strictEqual(b.senales.portal, 1);
  const esperada = Object.entries(R.PESOS).reduce((s, [k, w]) => s + w * a.senales[k], 0);
  assert.ok(Math.abs(a.puntuacion - esperada) < 0.01);
  assert.deepStrictEqual(R.motivoDe(a), { kind: 'juego', game: biblioteca[0] });
  assert.strictEqual(R.motivoDe(c).kind, 'reciente');
  assert.deepStrictEqual(Object.keys(R.caracteristicas(a)).sort(), ['amigos', 'explorar', 'idioma', 'juego', 'portal', 'puntuacion', 'reciente', 'similitud']);
});

test('ordenar: exploración cada 6, variedad y sin perder noticias', () => {
  const biblioteca = [{ igdb_id: 1, name: 'Call of Duty', status: 'jugando' }];
  const ns = [];
  for (let i = 1; i <= 30; i++) ns.push(noticia(i, `Call of Duty novedad ${i}`, { source_id: 1 }));
  for (let i = 31; i <= 90; i++) ns.push(noticia(i, `Otra cosa distinta ${i}`, { source_id: i % 7 + 2 }));
  const lista = R.ordenar(R.puntuar(ns, { biblioteca, idioma: 'es', ahora: AHORA }), { clave: 'x', cuantas: 60 });
  assert.strictEqual(lista.length, 60);
  assert.strictEqual(new Set(lista.map((r) => r.noticia.id)).size, 60, 'sin repetidas');
  lista.forEach((r, i) => assert.strictEqual(r.explorar, (i + 1) % 6 === 0, `puesto ${i}`));
  for (let i = 2; i < lista.length; i++) {
    const tres = [lista[i], lista[i - 1], lista[i - 2]].map((r) => r.noticia.source_id);
    assert.ok(!(tres[0] === tres[1] && tres[1] === tres[2]), `tres seguidas del mismo portal en ${i}`);
  }
  // Con rendimientos decrecientes, el juego que más sale no lo ocupa todo arriba
  const arriba = lista.slice(0, 12).filter((r) => r.juego).length;
  assert.ok(arriba >= 4 && arriba <= 10, String(arriba));
  // Mismo día y persona: mismo orden; otra clave: la exploración cambia
  const otra = R.ordenar(R.puntuar(ns, { biblioteca, idioma: 'es', ahora: AHORA }), { clave: 'x', cuantas: 60 });
  assert.deepStrictEqual(otra.map((r) => r.noticia.id), lista.map((r) => r.noticia.id));
  // Pocas noticias: salen todas
  const pocas = R.ordenar(R.puntuar(ns.slice(30, 34), { biblioteca: [], idioma: 'es', ahora: AHORA }), { clave: 'x' });
  assert.strictEqual(pocas.length, 4);
});

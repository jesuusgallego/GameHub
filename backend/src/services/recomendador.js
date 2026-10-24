// El recomendador de "Para ti" (1.6): basado en contenido, SIN aprendizaje automático todavía.
//
// Para cada pareja (persona, noticia) calcula unas SEÑALES, cada una entre 0 y 1:
//  - juego:     la noticia menciona un juego de tu biblioteca, ponderado por lo que te importa
//  - similitud: el texto de la noticia se parece a tu "perfil" (nombres, estudios, géneros y
//               plataformas de tus juegos), medido con TF-IDF y similitud del coseno
//  - amigos:    menciona un juego al que juegan (o que adoran) tus amigos
//  - reciente:  cuánto hace que se publicó (1 recién salida; ~0,37 al día; casi 0 a la semana)
//  - idioma:    está en el idioma de tu interfaz
//  - portal:    es de un portal que sigues
// y las combina con unos PESOS fijos (PESOS, abajo) en una puntuación. Esos pesos están puestos a
// mano: en la 1.7 se aprenderán de los clics (regresión logística, "learning to rank"), y por eso
// las señales de cada noticia enseñada se guardan tal cual (news_events.features).
//
// Después de puntuar: se reordena para que haya variedad (no más de dos seguidas del mismo portal
// o del mismo juego) y uno de cada CADA_EXPLORAR huecos es para "descubrir": una noticia reciente
// que no coincide contigo. Sirve para que no te encierre en tus gustos y, sobre todo, para tener
// datos de lo que el sistema NO habría elegido: sin ellos, un modelo solo aprende de sus propias
// elecciones.
//
// Todo son funciones puras (sin base de datos ni red): se prueban en test/recomendador.test.js.

const PESOS = { juego: 3, similitud: 1.5, amigos: 1, reciente: 1, idioma: 0.5, portal: 0.5 };
const CADA_EXPLORAR = 6;
const FACTOR_JUEGO = 0.85;
const FACTOR_PORTAL = 0.9;
// La similitud del coseno entre textos cortos rara vez pasa de 0,25: la escalo para que una
// coincidencia clara llegue a 1 (ver "similitud" en docs/DESARROLLO.md)
const ESCALA_SIMILITUD = 4;
const HORAS_RECIENTE = 24;

// ---- Texto -----------------------------------------------------------------------------

// Palabras vacías: tan frecuentes que no dicen nada del tema ("el", "de", "the"...)
const VACIAS = new Set(`
a al algo ante antes asi aun aunque bajo bien cada como con contra cual cuando de del desde donde
dos durante e el ella ellas ellos en entre era es esa ese eso esta este esto estos fue gran ha han
hasta hay la las le les lo los mas me mi mientras muy nada ni no nos nuevo nueva o otra otro para
pero poco por porque que quien se sea segun ser si sin sobre son su sus tambien tan te tiene tienen
todo todos tras tu un una uno unos ya ahora hace hoy ser va van ver vez
about after all also an and any are as at be been before being but by can could did do does for
from get had has have he her his how if in into is it its just like more most new not now of on one
only or other our out over says so some than that the their them then there these they this to up
us was we were what when which who will with would you your yes no
juego juegos game games video videojuego videojuegos
`.split(/\s+/).filter(Boolean));

// Minúsculas, sin tildes y sin signos: "¡Pokémon Rojo!" -> "pokemon rojo"
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Las palabras con contenido de un texto (de 2 letras o más y no vacías)
function palabras(texto) {
  return normalizar(texto).split(' ').filter((p) => p.length >= 2 && !VACIAS.has(p));
}

// ---- Juegos mencionados ------------------------------------------------------------------

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Las formas en que una noticia puede nombrar un juego. "The Legend of Zelda: Tears of the Kingdom"
// -> "legend of zelda tears of the kingdom", "legend of zelda", "tears of the kingdom".
//  - Un nombre de una sola palabra corta (hasta 7 letras: "Hades", "Control", "Inside") es
//    peligroso: puede ser una palabra corriente. A esos se les exige salir con mayúscula inicial
//    en el texto original (`estricto`). Aun así habrá falsos positivos ("Control" al principio de
//    una frase): es el clásico equilibrio entre precisión (no acertar de más) y exhaustividad (no
//    perderse menciones).
//  - Los de 1 a 3 letras ("Ico", "Rez") no se buscan: casi todo serían falsos positivos.
function aliasDeJuego(nombre) {
  const partes = String(nombre ?? '').split(/\s*[:–—]\s*|\s+-\s+/).filter(Boolean);
  const candidatos = [String(nombre ?? ''), ...(partes.length > 1 ? partes : [])];
  const alias = [];
  for (const original of candidatos) {
    const norm = normalizar(original).replace(/^the /, '');
    const n = norm.split(' ').filter(Boolean);
    if (n.length === 0) continue;
    if (n.length === 1) {
      if (norm.length <= 3 || VACIAS.has(norm)) continue;
      // Las partes sueltas de un nombre ("Zelda", "Elden") solo valen si son largas
      if (original !== nombre && norm.length < 6) continue;
      const estricto = norm.length <= 7;
      // Para los estrictos: la palabra tal cual (con sus tildes), entera y sin mirar mayúsculas; luego
      // se comprueba a mano que la aparición empiece por mayúscula
      const palabra = escapar(original.trim().replace(/^the /i, ''));
      alias.push({ alias: norm, estricto, re: estricto ? new RegExp(`(?<![\\p{L}\\p{N}])${palabra}(?![\\p{L}\\p{N}])`, 'giu') : null });
    } else if (!alias.some((a) => a.alias === norm)) {
      alias.push({ alias: norm, estricto: false, re: null });
    }
  }
  return alias;
}

// ¿Menciona la noticia ese juego? `noticia` lleva `norm` (texto normalizado, con espacios a los
// lados) y `crudo` (titular y extracto tal cual, para los nombres estrictos).
function menciona(noticia, aliasJuego) {
  return aliasJuego.some(({ alias, estricto, re }) => {
    if (!noticia.norm.includes(` ${alias} `)) return false;
    if (!estricto) return true;
    // Alguna aparición en el texto original tiene que empezar por mayúscula ("Hades", "HADES")
    for (const m of noticia.crudo.matchAll(re)) {
      if (m[0][0] !== m[0][0].toLowerCase()) return true;
    }
    return false;
  });
}

// ---- Cuánto te importa un juego ----------------------------------------------------------

const PESO_ESTADO = { jugando: 1, completado: 0.6, pendiente: 0.5, abandonado: 0.2 };

// De 0 a 1: el estado manda (jugando 1, completado 0,6, pendiente 0,5, abandonado 0,2); una nota
// de 8 o más lo sube al menos a 0,9 y una de 4 o menos lo baja a la mitad; las horas de juego
// suman un poco (hasta 0,2, de forma logarítmica: de 1 a 10 horas cuenta más que de 100 a 110).
function interes(juego) {
  let peso = PESO_ESTADO[juego.status] ?? 0.4;
  if (juego.rating != null && juego.rating >= 8) peso = Math.max(peso, 0.9);
  if (juego.rating != null && juego.rating <= 4) peso *= 0.5;
  const horas = (juego.playtime_minutes ?? 0) / 60;
  if (horas > 0) peso += Math.min(0.2, Math.log10(1 + horas) / 10);
  return Math.min(1, peso);
}

// ---- Perfil y TF-IDF ------------------------------------------------------------------

// Las palabras con las que un género de IGDB (en inglés) sale en las noticias, en los dos idiomas
const GENEROS = {
  'role-playing (rpg)': ['rpg', 'rol'], shooter: ['shooter', 'disparos', 'fps'], platform: ['plataformas', 'platformer'],
  racing: ['carreras', 'racing'], fighting: ['lucha', 'fighting'], strategy: ['estrategia', 'strategy'],
  'real time strategy (rts)': ['estrategia', 'rts'], 'turn-based strategy (tbs)': ['estrategia', 'tactico', 'turnos'],
  tactical: ['tactico', 'tactics'], sport: ['deportes', 'sports', 'futbol'], adventure: ['aventura', 'adventure'],
  puzzle: ['puzle', 'puzzle'], simulator: ['simulador', 'simulacion', 'simulation'], indie: ['indie'],
  "hack and slash/beat 'em up": ['hack', 'slash'], arcade: ['arcade'], 'point-and-click': ['aventura', 'grafica'],
  'visual novel': ['novela', 'visual'], moba: ['moba'], 'card & board game': ['cartas', 'card'], music: ['ritmo', 'rhythm'],
};

// Las palabras de una plataforma tal como salen en las noticias
function palabrasPlataforma(plataforma) {
  const p = normalizar(plataforma);
  const res = [];
  if (/playstation|ps\d/.test(p)) res.push('playstation', ...(p.match(/ps\d|playstation \d/g) ?? []).map((x) => x.replace('playstation ', 'ps')));
  if (/switch/.test(p)) res.push('switch', 'nintendo');
  if (/xbox/.test(p)) res.push('xbox');
  if (/pc|windows|steam/.test(p)) res.push('pc', 'steam');
  return res;
}

// El perfil de una persona: palabra -> peso, con lo que le importa cada juego. El nombre cuenta
// el doble que el estudio o el género (es lo más específico).
function perfilDe(biblioteca) {
  const perfil = new Map();
  const sumar = (palabra, peso) => perfil.set(palabra, (perfil.get(palabra) ?? 0) + peso);
  for (const juego of biblioteca) {
    const w = interes(juego);
    for (const p of palabras(juego.name)) sumar(p, 2 * w);
    for (const estudio of [...(juego.developers ?? []), ...(juego.publishers ?? [])]) {
      for (const p of palabras(estudio)) sumar(p, w);
    }
    for (const genero of juego.genres ?? []) {
      for (const p of GENEROS[String(genero).toLowerCase()] ?? []) sumar(p, 0.7 * w);
    }
    for (const p of palabrasPlataforma(juego.platform)) sumar(p, 0.5 * w);
  }
  return perfil;
}

// Prepara una noticia para puntuarla: su texto normalizado y su bolsa de palabras (el titular
// cuenta el doble que el extracto)
function prepararNoticia(noticia) {
  const crudo = `${noticia.title} ${noticia.excerpt ?? ''}`;
  const tf = new Map();
  for (const p of palabras(noticia.title)) tf.set(p, (tf.get(p) ?? 0) + 2);
  for (const p of palabras(noticia.excerpt)) tf.set(p, (tf.get(p) ?? 0) + 1);
  return { ...noticia, crudo, norm: ` ${normalizar(crudo)} `, tf };
}

// IDF ("frecuencia inversa en documentos"): una palabra que sale en muchas noticias ("trailer",
// "ps5") pesa poco; una rara ("silksong") pesa mucho. idf = ln((N + 1) / (df + 1)) + 1.
function idfDe(noticias) {
  const df = new Map();
  for (const n of noticias) for (const p of n.tf.keys()) df.set(p, (df.get(p) ?? 0) + 1);
  const N = noticias.length;
  const idf = new Map();
  for (const [p, d] of df) idf.set(p, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

// Vector TF-IDF normalizado (largo 1): así el coseno es solo el producto escalar
function vectorTfIdf(pesos, idf) {
  const v = new Map();
  let norma = 0;
  for (const [p, w] of pesos) {
    const x = w * (idf.get(p) ?? 0);
    if (x > 0) { v.set(p, x); norma += x * x; }
  }
  norma = Math.sqrt(norma);
  if (norma > 0) for (const [p, x] of v) v.set(p, x / norma);
  return v;
}

function coseno(a, b) {
  const [menor, mayor] = a.size < b.size ? [a, b] : [b, a];
  let suma = 0;
  for (const [p, x] of menor) suma += x * (mayor.get(p) ?? 0);
  return suma;
}

// ---- Puntuar ---------------------------------------------------------------------------

const redondear = (x) => Math.round(x * 1000) / 1000;

// Las señales de cada noticia para una persona.
//  - noticias: preparadas con prepararNoticia ({ id, source_id, lang, published_at, ... })
//  - contexto: { biblioteca, juegosAmigos: Map(igdb_id -> cuántos amigos), seguidos: Set(source_id),
//    idioma, ahora, idf }
// Devuelve [{ noticia, senales, puntuacion, juego (el mencionado que más pesa), juegoAmigos }]
function puntuar(noticias, contexto) {
  const { biblioteca, juegosAmigos = new Map(), seguidos = new Set(), idioma, ahora = Date.now() } = contexto;
  const idf = contexto.idf ?? idfDe(noticias);
  const perfil = vectorTfIdf(perfilDe(biblioteca), idf);
  const juegos = biblioteca.map((j) => ({ juego: j, alias: aliasDeJuego(j.name), interes: interes(j) }));
  const deAmigos = contexto.catalogoAmigos ?? [];
  const aliasAmigos = deAmigos.map((j) => ({ juego: j, alias: aliasDeJuego(j.name) }));

  return noticias.map((noticia) => {
    let juego = null;
    let fJuego = 0;
    for (const j of juegos) {
      if (j.interes > fJuego && menciona(noticia, j.alias)) { fJuego = j.interes; juego = j.juego; }
    }
    let fAmigos = 0;
    let juegoAmigos = null;
    for (const j of aliasAmigos) {
      const cuantos = juegosAmigos.get(j.juego.igdb_id) ?? 0;
      const f = cuantos > 0 ? Math.min(1, 0.6 + 0.2 * (cuantos - 1)) : 0;
      if (f > fAmigos && menciona(noticia, j.alias)) { fAmigos = f; juegoAmigos = j.juego; }
    }
    const horas = Math.max(0, (ahora - new Date(noticia.published_at).getTime()) / 3_600_000);
    const senales = {
      juego: redondear(fJuego),
      similitud: redondear(Math.min(1, coseno(perfil, vectorTfIdf(noticia.tf, idf)) * ESCALA_SIMILITUD)),
      amigos: redondear(fAmigos),
      reciente: redondear(Math.exp(-horas / HORAS_RECIENTE)),
      idioma: noticia.lang === idioma ? 1 : 0,
      portal: seguidos.has(noticia.source_id) ? 1 : 0,
    };
    const puntuacion = Object.entries(PESOS).reduce((s, [k, w]) => s + w * senales[k], 0);
    return { noticia, senales, puntuacion: redondear(puntuacion), juego, juegoAmigos };
  });
}

// El motivo que se enseña: la señal que más ha aportado a la puntuación (peso × valor), si aporta
// lo bastante; si no, es simplemente de lo último
function motivoDe(r) {
  if (r.explorar) return { kind: 'descubrir' };
  const aportes = [
    ['juego', PESOS.juego * r.senales.juego],
    ['amigos', PESOS.amigos * r.senales.amigos],
    ['similar', PESOS.similitud * r.senales.similitud],
    ['portal', PESOS.portal * r.senales.portal],
  ].sort((a, b) => b[1] - a[1]);
  const [tipo, aporte] = aportes[0];
  if (aporte < 0.45) return { kind: 'reciente' };
  if (tipo === 'juego') return { kind: 'juego', game: r.juego };
  if (tipo === 'amigos') return { kind: 'amigos', game: r.juegoAmigos };
  return { kind: tipo };
}

// Un número pseudoaleatorio estable a partir de un texto (para que "descubrir" no cambie cada vez
// que recargas en el mismo día, pero sí de un día a otro)
function semilla(texto) {
  let h = 2166136261;
  for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

// Ordena y reparte. Devuelve la lista final (hasta `cuantas`), cada una con su `motivo` y su
// `explorar`.
//  - Variedad: rendimientos decrecientes. Cada noticia más del mismo juego vale un 15 % menos
//    (× FACTOR_JUEGO^k, con k las que ya se pusieron) y cada una más del mismo portal un 10 % menos
//    (× FACTOR_PORTAL^k). Así, una semana en la que todos hablan de un juego, sus noticias no se
//    comen la portada. Además, nunca tres seguidas del mismo portal o juego si hay alternativa.
//  - Exploración: cada CADA_EXPLORAR puestos, una noticia "para descubrir": de las recientes que
//    no coinciden contigo (juego, amigos y similitud bajos). Las 15 más recientes van barajadas
//    (al azar, pero igual todo el día) y detrás, por fecha, hasta 120 de reserva.
function ordenar(puntuadas, { cuantas = 150, clave = '' } = {}) {
  const azar = semilla(clave);
  const explorables = puntuadas
    .filter((r) => r.senales.juego === 0 && r.senales.amigos === 0 && r.senales.similitud < 0.2)
    .sort((a, b) => b.senales.reciente - a.senales.reciente || b.senales.idioma - a.senales.idioma)
    .slice(0, 120);
  // Barajado estable de las 15 primeras (Fisher-Yates con la semilla del día)
  for (let i = Math.min(explorables.length, 15) - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [explorables[i], explorables[j]] = [explorables[j], explorables[i]];
  }

  // Las de descubrir se apartan ANTES de clasificar el resto: si no, la clasificación principal se
  // come las recientes (sobre todo de portales que sigues) y los huecos de descubrir se quedan sin nada
  const reservadas = explorables.slice(0, Math.floor(Math.min(cuantas, puntuadas.length) / CADA_EXPLORAR));
  const apartadas = new Set(reservadas.map((r) => r.noticia.id));
  const restantes = [...puntuadas]
    .filter((r) => !apartadas.has(r.noticia.id))
    .sort((a, b) => b.puntuacion - a.puntuacion || b.senales.reciente - a.senales.reciente);
  const usadas = new Set();
  const salida = [];
  const repite = (r, campo) => {
    const n = salida.length;
    if (n < 2) return false;
    const valor = campo(r);
    return valor != null && campo(salida[n - 1]) === valor && campo(salida[n - 2]) === valor;
  };
  const portalDe = (r) => r.noticia.source_id;
  const juegoDe = (r) => r.juego?.igdb_id ?? null;
  // Cuántas se han puesto ya de cada portal y de cada juego
  const porPortal = new Map();
  const porJuego = new Map();

  while (salida.length < cuantas && usadas.size < puntuadas.length) {
    let elegida = null;
    if ((salida.length + 1) % CADA_EXPLORAR === 0) {
      const e = reservadas.find((r) => !usadas.has(r.noticia.id));
      if (e) elegida = { ...e, explorar: true };
    }
    if (!elegida) {
      // La de mejor puntuación "efectiva" (con los rendimientos decrecientes), sin repetir tres
      // seguidas; si no queda ninguna así, la mejor sin más
      let mejor = null;
      let mejorValor = -Infinity;
      let reserva = null;
      for (const r of restantes) {
        if (usadas.has(r.noticia.id)) continue;
        if (!reserva) reserva = r;
        if (repite(r, portalDe) || repite(r, juegoDe)) continue;
        const kJuego = juegoDe(r) == null ? 0 : (porJuego.get(juegoDe(r)) ?? 0);
        const valor = r.puntuacion * FACTOR_JUEGO ** kJuego * FACTOR_PORTAL ** (porPortal.get(portalDe(r)) ?? 0);
        if (valor > mejorValor) { mejor = r; mejorValor = valor; }
      }
      if (!mejor) mejor = reserva;
      if (mejor) elegida = { ...mejor, explorar: false };
      else {
        // No quedan normales: siguen las apartadas para descubrir
        const e = reservadas.find((r) => !usadas.has(r.noticia.id));
        if (!e) break;
        elegida = { ...e, explorar: true };
      }
    }
    usadas.add(elegida.noticia.id);
    salida.push(elegida);
    porPortal.set(portalDe(elegida), (porPortal.get(portalDe(elegida)) ?? 0) + 1);
    if (juegoDe(elegida) != null) porJuego.set(juegoDe(elegida), (porJuego.get(juegoDe(elegida)) ?? 0) + 1);
  }
  return salida.map((r) => ({ ...r, motivo: motivoDe(r) }));
}

// Lo que se guarda en news_events.features: las señales, la puntuación y si era de exploración
function caracteristicas(r) {
  return { ...r.senales, explorar: r.explorar ? 1 : 0, puntuacion: r.puntuacion };
}

module.exports = {
  PESOS, CADA_EXPLORAR, normalizar, palabras, aliasDeJuego, menciona, interes, perfilDe,
  prepararNoticia, idfDe, vectorTfIdf, coseno, puntuar, ordenar, motivoDe, caracteristicas,
};

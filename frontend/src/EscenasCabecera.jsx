// Las escenas ilustradas del fondo de las cabeceras grandes (las pinta FondoCabecera). Cada una
// cuenta de qué va su apartado y lleva dentro imágenes de verdad:
//  - EscenaNoticias: periódicos y una revista de videojuegos, con las fotos de las últimas noticias
//  - EscenaBiblioteca: una estantería con tus juegos: cajas de frente con tus portadas y lomos de
//    colores entre ellas, como una colección
//  - EscenaSala: tres amigos de espaldas en el sofá, con mandos, delante de una tele que enseña lo
//    que juegan tus amigos
//  - EscenaBuscar: portadas en abanico, como un catálogo, y una lupa de cristal encima de la del centro
// Están dibujadas con HTML, CSS y SVG (sin ilustraciones descargadas): así siguen los colores de
// cada tema y pesan casi nada. Son decoración: aria-hidden, sin nada que pulsar. Los estilos están
// en estilos/escenas-cabecera.css.

// Una foto de la escena. Si falta (o no carga), un hueco de color con un mando dibujado.
function Foto({ url, className }) {
  if (!url) return <span className={`${className} escena__sin-foto`}><IconoMando /></span>
  return (
    <img
      className={className}
      src={url}
      alt=""
      loading="lazy"
      // Algunos portales no sirven sus imágenes a otras webs si saben de dónde viene la petición
      referrerPolicy="no-referrer"
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}

function IconoMando() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1 4.6a3 3 0 0 0 5.2 2.6L8.8 13h6.4l1.8 2.3a3 3 0 0 0 5.2-2.6l-1-4.6A4 4 0 0 0 17.3 5Z" />
    </svg>
  )
}

// ---- Noticias: periódicos y una revista de videojuegos -----------------------------------------
// Un periódico detrás, otro delante y una revista encima, un poco girados, como dejados sobre la
// mesa. Cabecera, fecha, titulares (barras), foto y columnas de texto (líneas).
export function EscenaNoticias({ imagenes }) {
  const [a, b, c] = imagenes
  return (
    <div className="escena escena--noticias" aria-hidden="true">
      <div className="periodico periodico--atras">
        <span className="periodico__cabecera">LEVEL UP</span>
        <span className="periodico__fecha" />
        <span className="periodico__titular" />
        <Foto url={c} className="periodico__foto periodico__foto--pequena" />
        <span className="periodico__texto" />
      </div>
      <div className="periodico">
        <span className="periodico__cabecera">PRESS START</span>
        <span className="periodico__fecha" />
        <span className="periodico__titular" />
        <span className="periodico__titular periodico__titular--corto" />
        <Foto url={a} className="periodico__foto" />
        <span className="periodico__texto" />
      </div>
      <div className="revista">
        <Foto url={b} className="revista__foto" />
        <span className="revista__cabecera">PLAY</span>
        <span className="revista__numero">#42</span>
        <span className="revista__lineas" />
      </div>
    </div>
  )
}

// ---- Mi biblioteca: la estantería ---------------------------------------------------------------
// Dos baldas. En cada una, lomos de colores ('l') y cajas de frente ('c') con tus portadas, en un
// orden fijo para que la estantería no cambie en cada visita. Sin portadas, todo son lomos.
const BALDAS = [
  ['l', 'l', 'c', 'l', 'l', 'c', 'l', 'c', 'l', 'l', 'c', 'l'],
  ['c', 'l', 'l', 'c', 'l', 'l', 'l', 'c', 'l', 'c', 'l', 'l'],
]
// El color de cada lomo (tono del círculo cromático), su ancho y su alto: variados, como en una
// colección de verdad
const LOMOS = [
  [205, 1.0, 96], [150, 0.85, 90], [270, 1.1, 100], [12, 0.9, 93], [340, 1.0, 97], [45, 0.8, 88],
  [185, 1.05, 99], [110, 0.9, 92], [230, 0.95, 95], [300, 0.85, 89], [25, 1.1, 98], [165, 0.9, 94],
]
// La franja de arriba de las cajas, como la de las cajas de cada consola
const FRANJAS = ['azul', 'roja', 'verde']

// Qué va en cada hueco de las baldas: { tipo: 'caja', url, franja } o { tipo: 'lomo', tono, ancho,
// alto }. Las portadas se reparten por orden (y se repiten si hay pocas); los lomos, igual.
function montarBaldas(imagenes) {
  let portada = 0
  let lomo = 0
  return BALDAS.map((balda) => balda.map((tipo) => {
    if (tipo === 'c' && imagenes.length > 0) {
      const hueco = { tipo: 'caja', url: imagenes[portada % imagenes.length], franja: FRANJAS[portada % FRANJAS.length] }
      portada += 1
      return hueco
    }
    const [tono, ancho, alto] = LOMOS[lomo % LOMOS.length]
    lomo += 1
    return { tipo: 'lomo', tono, ancho, alto }
  }))
}

export function EscenaBiblioteca({ imagenes }) {
  return (
    <div className="escena escena--biblioteca" aria-hidden="true">
      {montarBaldas(imagenes).map((balda, b) => (
        <div key={b} className="balda">
          {balda.map((h, i) => (h.tipo === 'caja'
            ? (
              <span key={i} className={`caja caja--${h.franja}`}>
                <Foto url={h.url} className="caja__portada" />
              </span>
            )
            : <span key={i} className="lomo" style={{ '--tono': h.tono, '--ancho': h.ancho, '--alto': h.alto }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ---- Buscar: el catálogo y la lupa ---------------------------------------------------------------
// Cinco cajas en abanico (con las portadas de lo que buscas o, sin búsqueda, las de tu biblioteca) y
// una lupa grande que flota despacio sobre la del centro, con unos destellos alrededor
export function EscenaBuscar({ imagenes }) {
  return (
    <div className="escena escena--buscar" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`ficha ficha--${i}`}>
          <Foto url={imagenes[i]} className="ficha__portada" />
        </span>
      ))}
      <span className="lupa">
        <span className="lupa__cristal" />
        <span className="lupa__mango" />
      </span>
      <span className="destello destello--1" />
      <span className="destello destello--2" />
      <span className="destello destello--3" />
    </div>
  )
}

// ---- Social: amigos jugando juntos --------------------------------------------------------------
// Dibujo SVG: una tele grande con su brillo (en la pantalla, lo que juegan tus amigos), tres amigos
// de espaldas con mandos (uno con cascos) y el respaldo del sofá delante. Encima, un bocadillo
// de "GG". Los colores salen de variables CSS (--escena-...), que cambian con el tema.
export function EscenaSala({ imagenes }) {
  const pantalla = imagenes[0]
  return (
    <svg className="escena escena--sala" viewBox="0 0 560 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <radialGradient id="sala-brillo" cx="50%" cy="45%" r="55%">
          {/* En un atributo SVG no vale var(--...); dentro de style, sí */}
          <stop offset="0" style={{ stopColor: 'var(--escena-luz)', stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: 'var(--escena-luz)', stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id="sala-sin-juego" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b3df5" />
          <stop offset="1" stopColor="#1b74c8" />
        </linearGradient>
        <clipPath id="sala-pantalla"><rect x="160" y="22" width="240" height="132" rx="6" /></clipPath>
      </defs>

      {/* El brillo de la tele sobre la pared */}
      <ellipse cx="280" cy="100" rx="250" ry="120" fill="url(#sala-brillo)" />

      {/* La tele */}
      <rect x="150" y="12" width="260" height="152" rx="10" className="escena__tele" />
      <rect x="160" y="22" width="240" height="132" rx="6" fill="url(#sala-sin-juego)" />
      {pantalla && (
        <image href={pantalla} x="160" y="22" width="240" height="132" preserveAspectRatio="xMidYMid slice" clipPath="url(#sala-pantalla)" />
      )}
      <rect x="160" y="22" width="240" height="132" rx="6" className="escena__reflejo" />
      <rect x="262" y="164" width="36" height="10" rx="3" className="escena__tele" />

      {/* Tres amigos de espaldas: cabeza, hombros y el mando en alto */}
      <g className="escena__amigo">
        <circle cx="190" cy="186" r="23" />
        <rect x="142" y="206" width="96" height="70" rx="34" />
        <rect x="128" y="196" width="30" height="15" rx="7" transform="rotate(-24 143 203)" className="escena__mando" />
      </g>
      <g className="escena__amigo">
        <circle cx="282" cy="180" r="25" />
        <rect x="230" y="202" width="104" height="76" rx="36" />
        {/* Los cascos */}
        <path d="M255 178a27 27 0 0 1 54 0" className="escena__cascos" />
        <rect x="250" y="174" width="9" height="18" rx="4" className="escena__mando" />
        <rect x="305" y="174" width="9" height="18" rx="4" className="escena__mando" />
        <rect x="318" y="190" width="32" height="15" rx="7" transform="rotate(18 334 197)" className="escena__mando" />
      </g>
      <g className="escena__amigo">
        <circle cx="372" cy="188" r="22" />
        <rect x="326" y="208" width="92" height="68" rx="33" />
        <rect x="402" y="200" width="30" height="15" rx="7" transform="rotate(26 417 207)" className="escena__mando" />
      </g>

      {/* El respaldo del sofá, delante */}
      <rect x="104" y="232" width="356" height="60" rx="24" className="escena__sofa" />

      {/* "GG" en un bocadillo, como en un chat */}
      <g className="escena__bocadillo">
        <path d="M430 128h58a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-34l-12 11v-11h-12a10 10 0 0 1-10-10v-22a10 10 0 0 1 10-10Z" />
        <text x="459" y="156" textAnchor="middle">GG</text>
      </g>
      {/* Y un corazón */}
      <path className="escena__corazon" d="M118 150c-7-6-14-10-14-17a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 7-7 11-14 17Z" />
    </svg>
  )
}

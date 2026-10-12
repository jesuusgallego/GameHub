// Géneros y modos de juego de IGDB, que solo da en inglés ("Role-playing (RPG)",
// "Single player"...). En la base de datos se guardan tal cual vienen (son la
// "clave": con ellas se filtra y se compara), y aquí solo se traducen para MOSTRARLOS.
// Las compañías y las plataformas no se traducen: son nombres propios.
//
// Cada nombre de IGDB apunta a un identificador corto; el texto en cada idioma está en
// es.js y en en.js (claves "genero.<id>" y "modo.<id>"). Un nombre que no esté en la
// tabla (IGDB añade alguno nuevo) se muestra tal cual, en inglés: nunca se pierde.
//
// Importa es.js y en.js directamente (y no idioma.js) para poder usarse en las pruebas,
// que corren en Node, sin navegador.
import es from './textos/es.js'
import en from './textos/en.js'

const TEXTOS = { es, en }

export const GENEROS = {
  'Point-and-click': 'puntearYClic',
  'Fighting': 'lucha',
  'Shooter': 'shooter',
  'Music': 'musica',
  'Platform': 'plataformas',
  'Puzzle': 'puzle',
  'Racing': 'carreras',
  'Real Time Strategy (RTS)': 'rts',
  'Role-playing (RPG)': 'rpg',
  'Simulator': 'simulacion',
  'Sport': 'deportes',
  'Strategy': 'estrategia',
  'Turn-based strategy (TBS)': 'tbs',
  'Tactical': 'tactico',
  "Hack and slash/Beat 'em up": 'hackAndSlash',
  'Quiz/Trivia': 'quiz',
  'Pinball': 'pinball',
  'Adventure': 'aventura',
  'Indie': 'indie',
  'Arcade': 'arcade',
  'Visual Novel': 'novelaVisual',
  'Card & Board Game': 'cartasYTablero',
  'MOBA': 'moba',
}

export const MODOS = {
  'Single player': 'unJugador',
  'Multiplayer': 'multijugador',
  'Co-operative': 'cooperativo',
  'Split screen': 'pantallaDividida',
  'Massively Multiplayer Online (MMO)': 'mmo',
  'Battle Royale': 'battleRoyale',
}

function traducir(tabla, prefijo, nombre, idioma) {
  const id = tabla[nombre]
  return (id && TEXTOS[idioma]?.[`${prefijo}.${id}`]) || nombre
}

// El género tal como se enseña en `idioma` ('es' o 'en')
export function nombreGenero(nombre, idioma) {
  return traducir(GENEROS, 'genero', nombre, idioma)
}

export function nombreModo(nombre, idioma) {
  return traducir(MODOS, 'modo', nombre, idioma)
}

// El género en TODOS los idiomas (sin repetir): lo usa el buscador para que "rol" y
// "rpg" encuentren el mismo juego se vea la interfaz en el idioma que se vea.
export function nombresDeGenero(nombre) {
  return [...new Set(Object.keys(TEXTOS).map((idioma) => nombreGenero(nombre, idioma)))]
}

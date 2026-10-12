// Orden y filtros de Mi biblioteca. Son funciones puras: reciben la lista de juegos
// y devuelven otra, sin tocar el estado de React, así Biblioteca.jsx solo decide
// QUÉ aplicar y aquí está CÓMO.
import { nombreGenero, nombresDeGenero } from './terminosIgdb.js'

// Criterios de ordenación. "tipo" decide cómo se redactan los dos sentidos
// ("A → Z", "Menor a mayor"...) y "porDefecto" el sentido con el que empieza cada
// uno: lo normal en un nombre es A → Z, y en un tiempo o una nota, de mayor a menor.
// El texto de cada uno está en es.js y en.js (clave "orden.<id>").
// El género y la compañía NO están: un juego puede tener varios y ordenar por el
// primero no significa nada. Para eso están los filtros y la búsqueda.

export const CRITERIOS = [
  { id: 'anadido', tipo: 'fecha', porDefecto: 'desc' },
  { id: 'nombre', tipo: 'texto', porDefecto: 'asc' },
  { id: 'tiempo', tipo: 'numero', porDefecto: 'desc' },
  { id: 'logros', tipo: 'numero', porDefecto: 'desc' },
  { id: 'nota', tipo: 'numero', porDefecto: 'desc' },
  { id: 'notaIgdb', tipo: 'numero', porDefecto: 'desc' },
  { id: 'lanzamiento', tipo: 'fecha', porDefecto: 'desc' },
]

// Las compañías de un juego: desarrolladoras y publishers juntas, sin repetir (muchas
// veces son la misma). Así "Nintendo" encuentra tanto lo que desarrolla como lo que
// solo publica.
export function companiasDe(juego) {
  return [...new Set([...(juego.developers ?? []), ...(juego.publishers ?? [])])]
}

// El dato por el que se ordena un juego: un número, un texto o null si no lo tiene
function valorDe(juego, criterio) {
  switch (criterio) {
    case 'anadido': return Date.parse(juego.created_at)
    case 'nombre': return juego.name
    case 'tiempo': return juego.playtime_minutes ?? null
    // Proporción de logros conseguidos (0 a 1); sin logros, nada que comparar
    case 'logros':
      return juego.achievements_total > 0 ? juego.achievements_unlocked / juego.achievements_total : null
    case 'nota': return juego.rating ?? null
    case 'notaIgdb': return juego.igdb_rating ?? null
    case 'lanzamiento': return juego.release_date ? Date.parse(juego.release_date) : null
    default: return null
  }
}

// Devuelve una lista nueva ordenada (sort() cambiaría la original).
//  - direccion: 'asc' o 'desc'
// Los juegos que no tienen el dato (sin horas porque no son de Steam, sin nota...)
// van SIEMPRE al final, ordenes como ordenes: arriba solo quiero ver lo que tiene
// valor. Si dos empatan, desempata el nombre para que el orden sea estable.
export function ordenar(juegos, criterio, direccion, locale) {
  const signo = direccion === 'asc' ? 1 : -1
  const comparar = (a, b) => a.localeCompare(b, locale, { sensitivity: 'base' })

  return [...juegos].sort((a, b) => {
    const va = valorDe(a, criterio)
    const vb = valorDe(b, criterio)

    if (va === null && vb === null) return comparar(a.name, b.name)
    if (va === null) return 1
    if (vb === null) return -1

    const orden = typeof va === 'string' ? comparar(va, vb) : va - vb
    return orden !== 0 ? orden * signo : comparar(a.name, b.name)
  })
}

// Filtros que van en un desplegable: id -> cómo saber qué valores tiene un juego
const EXTRACTORES = {
  genero: (juego) => juego.genres ?? [],
  compania: companiasDe,
  plataforma: (juego) => (juego.platform ? [juego.platform] : []),
}

export const TODOS = 'todos'

// Los valores que existen en la biblioteca para cada filtro, con cuántos juegos tiene
// cada uno: { genero: [{ valor, etiqueta, cuenta }, ...], compania: [...], plataforma: [...] }.
//  - valor: el dato tal como está guardado (con él se filtra)
//  - etiqueta: lo que se enseña. Solo el género se traduce ("Role-playing (RPG)" →
//    "Rol (RPG)"); el resto es igual que `valor`.
// Ordenados alfabéticamente por la etiqueta, que es lo que ve quien los lee. Un juego
// con varios géneros cuenta en cada uno.
export function opcionesDeFiltros(juegos, locale) {
  const resultado = {}
  // El idioma son las dos primeras letras del locale ('es-ES' → 'es')
  const idioma = locale.slice(0, 2)

  for (const [clave, extraer] of Object.entries(EXTRACTORES)) {
    const cuentas = new Map()
    for (const juego of juegos) {
      // Set: si una lista repite un valor, el juego cuenta una sola vez
      for (const valor of new Set(extraer(juego))) {
        cuentas.set(valor, (cuentas.get(valor) ?? 0) + 1)
      }
    }
    resultado[clave] = [...cuentas]
      .map(([valor, cuenta]) => ({
        valor,
        etiqueta: clave === 'genero' ? nombreGenero(valor, idioma) : valor,
        cuenta,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, locale, { sensitivity: 'base' }))
  }

  return resultado
}

// Si el valor elegido en un filtro ya no existe (borré el último juego de ese género,
// por ejemplo), lo trato como "todos" en vez de dejar la lista vacía sin explicación.
export function filtrosVigentes(filtros, opciones) {
  const vigentes = { ...filtros }
  for (const clave of Object.keys(EXTRACTORES)) {
    if (!opciones[clave].some((o) => o.valor === filtros[clave])) vigentes[clave] = TODOS
  }
  return vigentes
}

// Minúsculas y sin acentos: al buscar, "pokémon", "Pokemon" y "POKÉMON" son lo mismo.
// normalize('NFD') separa cada letra de su acento y \p{M} (marca) los quita.
function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

// Todo lo que el buscador mira de un juego, en un solo texto: nombre, compañías,
// géneros y plataforma. Los géneros van en todos los idiomas: buscar "rol" encuentra lo
// mismo que "rpg", y da igual en qué idioma esté la interfaz.
function textoBuscable(juego) {
  const generos = (juego.genres ?? []).flatMap(nombresDeGenero)
  return normalizar(
    [juego.name, ...companiasDe(juego), ...generos, juego.platform ?? ''].join(' | ')
  )
}

// Los juegos que cumplen TODOS los filtros a la vez (estado, género, compañía,
// plataforma) y la búsqueda. La búsqueda separa lo escrito en palabras y exige que
// cada una aparezca en ALGÚN sitio del juego: "nintendo zelda" encuentra Zelda por la
// compañía y por el nombre, y "rockstar rpg" no encuentra nada que no sea de las dos.
export function filtrar(juegos, filtros, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)

  return juegos.filter((juego) => {
    if (filtros.estado !== TODOS && juego.status !== filtros.estado) return false
    for (const [clave, extraer] of Object.entries(EXTRACTORES)) {
      if (filtros[clave] !== TODOS && !extraer(juego).includes(filtros[clave])) return false
    }
    if (palabras.length === 0) return true

    const buscable = textoBuscable(juego)
    return palabras.every((palabra) => buscable.includes(palabra))
  })
}

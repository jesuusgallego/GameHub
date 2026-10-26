// Los resultados de las últimas búsquedas en IGDB, en memoria mientras la app está abierta. Si
// vuelves a escribir un término que ya buscaste (al borrar letras, por ejemplo) los resultados salen
// al instante, sin esperar los 400 ms de la pausa al escribir ni la respuesta del servidor.
// Solo guarda los últimos MAX: es una comodidad, no un archivo.
const MAX = 40
const guardadas = new Map() // término normalizado -> resultados
const escritos = new Map() // término normalizado -> como lo escribiste (para "Búsquedas recientes")

const clave = (termino) => termino.trim().toLowerCase()

export function leerBusqueda(termino) {
  return guardadas.get(clave(termino))
}

export function guardarBusqueda(termino, resultados) {
  const k = clave(termino)
  guardadas.delete(k) // para que la más reciente quede al final
  guardadas.set(k, resultados)
  escritos.set(k, termino.trim())
  if (guardadas.size > MAX) {
    const vieja = guardadas.keys().next().value
    guardadas.delete(vieja)
    escritos.delete(vieja)
  }
}

// Las últimas búsquedas que encontraron algo, de la más reciente a la más antigua, tal como las
// escribiste. Las que son el principio de otra más reciente ("zel" antes de "zelda", al ir
// escribiendo) no salen: solo cuenta lo que llegaste a buscar.
//  - cuantas: cuántas como mucho
export function busquedasRecientes(cuantas = 6) {
  const claves = [...guardadas.keys()].reverse().filter((k) => guardadas.get(k).length > 0)
  const finales = claves.filter((k, i) => !claves.slice(0, i).some((nueva) => nueva !== k && nueva.startsWith(k)))
  return finales.slice(0, cuantas).map((k) => ({ termino: escritos.get(k), portada: guardadas.get(k).find((j) => j.cover_url)?.cover_url ?? null }))
}

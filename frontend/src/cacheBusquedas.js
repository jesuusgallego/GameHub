// Los resultados de las últimas búsquedas en IGDB, en memoria mientras la app está abierta. Si
// vuelves a escribir un término que ya buscaste (al borrar letras, por ejemplo) los resultados salen
// al instante, sin esperar los 400 ms de la pausa al escribir ni la respuesta del servidor.
// Solo guarda los últimos MAX: es una comodidad, no un archivo.
const MAX = 40
const guardadas = new Map() // término normalizado -> resultados

const clave = (termino) => termino.trim().toLowerCase()

export function leerBusqueda(termino) {
  return guardadas.get(clave(termino))
}

export function guardarBusqueda(termino, resultados) {
  const k = clave(termino)
  guardadas.delete(k) // para que la más reciente quede al final
  guardadas.set(k, resultados)
  if (guardadas.size > MAX) guardadas.delete(guardadas.keys().next().value)
}

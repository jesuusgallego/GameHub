import { leerToken } from './sesion'

// La última lista de juegos que se pidió al servidor, guardada en memoria mientras la app está
// abierta. Al volver a Mi biblioteca se enseña al instante y se refresca por detrás (en vez de un
// spinner y toda la página apareciendo de golpe). Va ligada al token de sesión: si cambia la cuenta
// (o se cierra sesión) la copia deja de valer y no se enseña la biblioteca de otra persona.
let guardada = null // { token, juegos }

// La copia de esta sesión, o null si no hay (o es de otra cuenta)
export function leerCacheJuegos() {
  const token = leerToken()
  return token && guardada && guardada.token === token ? guardada.juegos : null
}

export function guardarCacheJuegos(juegos) {
  guardada = { token: leerToken(), juegos }
}

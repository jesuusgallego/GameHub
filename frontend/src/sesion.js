// El token de sesión (JWT) vive en localStorage. Todo el acceso pasa por aquí, para
// que el nombre de la clave esté en un solo sitio.
const CLAVE = 'token'

// El token guardado, o "" si no hay sesión
export function leerToken() {
  return localStorage.getItem(CLAVE) || ""
}

export function escribirToken(token) {
  localStorage.setItem(CLAVE, token)
}

// Cierra la sesión en este navegador
export function borrarToken() {
  localStorage.removeItem(CLAVE)
}

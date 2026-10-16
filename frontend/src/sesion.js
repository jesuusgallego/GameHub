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

// Avisa cuando OTRA pestaña o ventana de este navegador inicia o cierra sesión (o cambia de
// cuenta). El token se comparte entre todas las pestañas, y cada petición usa el que haya en
// ese momento: sin este aviso, una pestaña abierta como "ana" seguiría enseñando su avatar y
// su pantalla mientras pide los datos de "beto". El evento `storage` solo salta en las demás
// pestañas, nunca en la que escribió. Devuelve la función para darse de baja.
export function alCambiarSesionEnOtraPestana(funcion) {
  const oyente = (e) => {
    // e.key es null cuando se vacía todo el almacenamiento
    if (e.key === null || e.key === CLAVE) funcion()
  }
  window.addEventListener('storage', oyente)
  return () => window.removeEventListener('storage', oyente)
}

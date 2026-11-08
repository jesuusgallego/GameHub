import { leerToken } from './sesion'

// Lo que hace falta para usar GameHub sin cuenta (como invitado) fuera de los componentes.

// ¿Se está usando sin cuenta?
export function esInvitado() {
  return !leerToken()
}

// A dónde volver después de entrar o registrarse: la página de la app de la que se venía
// (state.desde), o las noticias. Solo rutas internas ("/algo"): nada de "//otro-sitio.com" ni de
// volver otra vez al login o al registro.
export function rutaDeVuelta(desde) {
  if (typeof desde !== 'string' || !desde.startsWith('/') || desde.startsWith('//')) return '/noticias'
  if (/^\/(login|registro|recuperar)\b/.test(desde)) return '/noticias'
  return desde
}

// Los portales de noticias que sigue el invitado. Sin cuenta no se pueden guardar en el servidor:
// viven en este navegador y se mandan en cada petición (?sources=, ver newsController.js).
const CLAVE_PORTALES = 'noticias.portalesInvitado'
// Copia en memoria por si el navegador no deja usar localStorage (así, al menos, valen hasta que se
// cierre la página)
let enMemoria = []

export function leerPortalesInvitado() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_PORTALES))
    if (lista === null) return enMemoria
    return Array.isArray(lista) ? lista.filter((s) => typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s)).slice(0, 60) : []
  } catch {
    // Sin localStorage o con algo roto dentro: la copia en memoria
    return enMemoria
  }
}

export function guardarPortalesInvitado(slugs) {
  enMemoria = [...slugs]
  try {
    localStorage.setItem(CLAVE_PORTALES, JSON.stringify(slugs))
  } catch {
    // Sin localStorage: queda la copia en memoria
  }
}

// El catálogo de portales (GET /news/sources) con `following` según la lista del invitado: el
// servidor no sabe cuáles sigue y los manda todos a false
export function marcarPortalesInvitado(portales, seguidos = leerPortalesInvitado()) {
  const elegidos = new Set(seguidos)
  return portales.map((p) => ({ ...p, following: elegidos.has(p.slug) }))
}

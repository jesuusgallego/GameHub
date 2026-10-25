// La app instalada (PWA), la parte sin React para poder probarla (test/pwa.test.js): saber si
// estamos en un iPhone o iPad, si GameHub ya está instalada en la pantalla de inicio y si se ha
// publicado una versión nueva mientras la app estaba abierta.

const CLAVE_INSTALAR = 'instalarIOS'

// ¿Es un iPhone, iPad o iPod? El iPad con iPadOS 13 o posterior dice ser un Mac ("Macintosh"),
// pero un Mac no tiene pantalla táctil: así se distinguen.
export function esIOS(nav = globalThis.navigator) {
  if (!nav) return false
  if (/iPhone|iPad|iPod/.test(nav.userAgent ?? '')) return true
  return /Macintosh/.test(nav.userAgent ?? '') && (nav.maxTouchPoints ?? 0) > 1
}

// ¿Está abierta como app instalada (desde el icono de la pantalla de inicio) y no en el navegador?
// Safari de iOS lo dice con navigator.standalone; el resto, con la media query display-mode.
export function esAppInstalada(ventana = globalThis) {
  if (ventana?.navigator?.standalone === true) return true
  return Boolean(ventana?.matchMedia?.('(display-mode: standalone)').matches)
}

// ¿Tiene sentido explicar cómo instalarla? En iOS no hay botón de "Instalar": hay que hacerlo a
// mano desde Compartir. Solo en iOS, solo si aún no está instalada.
export function puedeInstalarseEnIOS(ventana = globalThis) {
  return esIOS(ventana?.navigator) && !esAppInstalada(ventana)
}

// Si la persona ya cerró la explicación (no se le vuelve a enseñar sola; sigue en Ajustes)
export function instalarDescartado(almacen = globalThis.localStorage) {
  try {
    return almacen?.getItem(CLAVE_INSTALAR) === 'no'
  } catch {
    return false
  }
}

export function descartarInstalar(almacen = globalThis.localStorage) {
  try {
    almacen?.setItem(CLAVE_INSTALAR, 'no')
  } catch {
    // Sin localStorage (modo privado): se volverá a enseñar en la próxima visita
  }
}

// El script principal de una página publicada: Vite le pone una huella en el nombre
// (assets/index-3f9a1c.js) que cambia con cada versión. Comparando el de la página abierta con el
// del index.html que hay ahora en el servidor se sabe si hay una versión nueva.
export function scriptPrincipal(html) {
  const m = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html ?? '')
  return m ? m[1] : null
}

// Hay versión nueva si los dos scripts se conocen y son distintos
export function hayVersionNueva(actual, publicado) {
  return Boolean(actual && publicado && actual !== publicado)
}

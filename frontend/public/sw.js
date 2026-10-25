// El service worker de la app instalada (PWA). El navegador lo guarda junto a la app y le pasa
// las peticiones de esta web antes de que salgan a internet; aquí decido cuáles se sirven desde
// una copia guardada (la "caché"):
//  - La página (index.html): primero se pide a internet, para tener siempre la última versión;
//    si no hay conexión, sale la copia guardada. Así la app abre aunque no haya red (con el aviso
//    de que no llega al servidor) y nunca se queda en una versión vieja.
//  - Los archivos de la interfaz (assets/, iconos/, arranque/): llevan una huella en el nombre
//    (index-3f9a1c.js) que cambia cuando cambia el contenido, así que una copia nunca se queda
//    vieja: se sirven de la caché y solo se piden la primera vez.
//  - La API (tu biblioteca, los mensajes, las noticias...) y las imágenes de otras webs: NO
//    pasan por aquí. Son de otro dominio y siempre van a internet.
// Lo registra src/pwa.js, y solo en la web publicada (ni en desarrollo ni en el escritorio).

// Al cambiar la forma de guardar, se sube el número: las cachés de versiones anteriores se borran
const CACHE = 'gamehub-v1'
// Archivos de la interfaz que se guardan como mucho (los de versiones viejas se van quitando)
const MAX_ARCHIVOS = 120
// La carpeta de la app ("/GameHub/" en GitHub Pages, "/" si no): la saca de dónde se registró
const BASE = new URL(self.registration.scope).pathname
const PAGINA = BASE + 'index.html'

// Al instalarse: guarda la página y entra en funcionamiento sin esperar a que se cierren las
// pestañas viejas (como la página siempre se pide a internet primero, no hay mezcla de versiones)
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([PAGINA, BASE + 'manifest.webmanifest', BASE + 'iconos/apple-touch-icon.png']))
      .then(() => self.skipWaiting()),
  )
})

// Al activarse: borra las cachés de otras versiones y toma el control de las pestañas abiertas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  const url = new URL(peticion.url)
  // Otro dominio (la API en Render, imágenes de IGDB, de Steam o de los portales): no la toco
  if (url.origin !== self.location.origin) return

  // Abrir una página de la app (/GameHub/noticias, /GameHub/biblioteca...): siempre es el mismo
  // index.html, y el router de React decide qué enseñar. Primero internet; sin red, la copia.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(PAGINA, { cache: 'no-cache' })
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone()
            caches.open(CACHE).then((cache) => cache.put(PAGINA, copia))
          }
          return respuesta
        })
        .catch(() => caches.match(PAGINA)),
    )
    return
  }

  // Archivos de la interfaz: de la caché si están; si no, de internet, y se guardan
  if (/\/(assets|iconos|arranque)\//.test(url.pathname)) {
    evento.respondWith(
      caches.match(peticion).then((guardada) => guardada || fetch(peticion).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(peticion, copia)).then(recortar)
        }
        return respuesta
      })),
    )
  }
})

// Que la caché no crezca sin fin: con cada versión nueva llegan archivos nuevos y los viejos ya
// no se usan. Se quitan los más antiguos (keys() los da en el orden en que se guardaron).
function recortar() {
  return caches.open(CACHE).then((cache) => cache.keys().then((claves) => {
    const sobran = claves.filter((c) => !c.url.endsWith('index.html') && !c.url.endsWith('.webmanifest'))
    return Promise.all(sobran.slice(0, Math.max(0, sobran.length - MAX_ARCHIVOS)).map((c) => cache.delete(c)))
  }))
}

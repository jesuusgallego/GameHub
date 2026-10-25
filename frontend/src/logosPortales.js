// Los logos de los portales de noticias: un PNG de 128x128 por portal en logos-portales/, con el
// slug del catálogo como nombre (backend/src/config/portales.js). Se descargaron una vez del icono
// que publica cada web y van dentro de la app: así no se pide nada a otras webs al abrir Noticias.
// Salen en las noticias que no traen imagen (TarjetaNoticia).
//
// import.meta.glob lo resuelve Vite al compilar: encuentra todos los PNG de la carpeta y devuelve
// la URL final de cada uno, la buena tanto en la web ("/assets/...") como en el escritorio (rutas
// relativas). Para añadir el de un portal nuevo basta con dejar su PNG en la carpeta.
const archivos = import.meta.glob('./logos-portales/*.png', { eager: true, query: '?url', import: 'default' })

// La URL del logo de un portal, o null si no lo hay (entonces sale su nombre)
export function logoPortal(slug) {
  return archivos[`./logos-portales/${slug}.png`] ?? null
}

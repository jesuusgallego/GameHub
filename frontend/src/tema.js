// Tema claro/oscuro. Vive en el atributo data-tema de <html> y el CSS (estilos/base.css)
// cambia todos los colores según ese atributo. Guardo la preferencia en
// localStorage; el script de index.html la aplica antes de pintar.
const CLAVE = 'tema'

export function temaActual() {
  return document.documentElement.dataset.tema === 'claro' ? 'claro' : 'oscuro'
}

// La franja de la hora (y la barra del navegador en Android) se pinta del color de la etiqueta
// theme-color: la pongo igual que el fondo de GameHub (--bg en estilos/base.css) para que todo
// parezca una sola pieza. index.html hace lo mismo al arrancar.
function colorBarraEstado(tema) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = tema === 'claro' ? '#e8edf3' : '#111a27'
}

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema
  colorBarraEstado(tema)
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // Sin localStorage (modo privado, etc.) el tema solo vale para esta visita
  }
}

// Cambia al otro tema y devuelve cuál es el nuevo, para que quien lo llame
// actualice su estado.
export function alternarTema() {
  const nuevo = temaActual() === 'oscuro' ? 'claro' : 'oscuro'
  aplicarTema(nuevo)
  return nuevo
}

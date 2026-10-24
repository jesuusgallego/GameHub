import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Marca from './Marca'
import MenuUsuario from './MenuUsuario'
import MenuAjustes from './MenuAjustes'
import { useIdioma } from './IdiomaContext'

// Ancho base de la línea (el del CSS): se estira con scaleX para llegar al ancho del enlace. Así
// la línea solo cambia transform, que anima la tarjeta gráfica sin pasar por el hilo principal;
// animar `width` (como antes) iba por el hilo principal y se descompasaba del movimiento
// cuando la página que se cargaba debajo le robaba tiempo.
const ANCHO_BASE = 100

// Coloco la línea bajo el enlace activo: mido dónde está y cuánto ocupa (en
// píxeles, respecto a la barra de navegación) y se lo aplico a la línea.
// Con conAnimacion = false la línea salta de golpe (primer pintado, cambios de
// tamaño de ventana); con true se desliza gracias al "transition" del CSS.
function colocarLinea(nav, linea, conAnimacion) {
  const activo = nav.querySelector('a.active')

  if (!activo) {
    linea.style.transform = 'scaleX(0)'
    return
  }

  if (!conAnimacion) linea.style.transition = 'none'

  linea.style.transform = `translateX(${activo.offsetLeft}px) scaleX(${activo.offsetWidth / ANCHO_BASE})`

  if (!conAnimacion) {
    // Fuerzo al navegador a aplicar el cambio YA, antes de reactivar la
    // transición; si no, la juntaría con el cambio y se animaría igualmente
    linea.getBoundingClientRect()
    linea.style.transition = ''
  }
}

// Los enlaces de la barra: a dónde llevan, su nombre (clave de traducción) y su icono. Los iconos
// son trazos sobre una cuadrícula de 24x24 en el estilo de los demás de la app (líneas de 2 px
// con las puntas redondeadas); el color lo pone el CSS con currentColor.
const ENLACES = [
  {
    to: '/noticias',
    texto: 'menu.noticias',
    // Un periódico doblado
    icono: (
      <>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8M15 18h-5" />
        <path d="M10 6h8v4h-8z" />
      </>
    ),
  },
  {
    to: '/biblioteca',
    texto: 'menu.biblioteca',
    // Un libro de pie y otro inclinado, como en una estantería
    icono: (
      <>
        <rect x="3" y="3" width="8" height="18" rx="1" />
        <path d="M7 3v18" />
        <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
      </>
    ),
  },
  {
    to: '/buscar',
    texto: 'menu.buscar',
    // Una lupa
    icono: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.9-3.9" />
      </>
    ),
  },
  {
    to: '/social',
    texto: 'menu.social',
    // Dos personas
    icono: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
]

// Barra superior: el logo a la izquierda, los enlaces (solo iconos) en el centro y los menús a la
// derecha. NavLink añade la clase "active" al enlace de la página actual.
// Perfil y cerrar sesión viven en el desplegable de la foto (MenuUsuario); el
// idioma y el tema claro/oscuro, en el de las tres líneas (MenuAjustes).
//  - solicitudes: cuántas solicitudes de amistad esperan respuesta
//  - mensajes: cuántos mensajes del chat no he leído
//    Las dos se suman en una sola insignia de "Social", que es donde viven (el chat es una de sus
//    pestañas); dentro, cada pestaña enseña su propio número.
function Menu({ setToken, perfil, solicitudes = 0, mensajes = 0 }) {
  const { t } = useIdioma()
  const avisos = solicitudes + mensajes
  const navRef = useRef(null)
  const lineaRef = useRef(null)
  // useLocation hace que este componente se vuelva a pintar cada vez que cambia la ruta
  const { pathname } = useLocation()

  // Al cambiar de página la línea se desliza hasta el enlace nuevo. La primera
  // vez (aún sin anchura) la coloco sin animación para que no "crezca" desde el
  // borde al cargar la web.
  useEffect(() => {
    const linea = lineaRef.current
    // La primera vez la línea aún no tiene posición (el CSS la deja en scaleX(0))
    const yaColocada = linea.dataset.colocada === 'si'
    colocarLinea(navRef.current, linea, yaColocada)
    linea.dataset.colocada = 'si'
  }, [pathname])

  // Si un enlace cambia de tamaño (redimensiono la ventana, termina de cargar la
  // tipografía...) recoloco la línea al instante.
  useEffect(() => {
    const nav = navRef.current
    const linea = lineaRef.current
    const observador = new ResizeObserver(() => colocarLinea(nav, linea, false))
    nav.querySelectorAll('a').forEach((enlace) => observador.observe(enlace))
    return () => observador.disconnect()
  }, [])

  return (
    <header className="barra">
      <div className="barra__interior">
        <Marca to="/noticias" />

        <nav className="barra__nav" ref={navRef}>
          {ENLACES.map(({ to, texto, icono }) => (
            <NavLink key={to} to={to} aria-label={t(texto)}>
              <svg className="barra__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {icono}
              </svg>
              {/* El nombre de la página, que aparece debajo al pasar el ratón o al llegar con el
                  teclado. aria-hidden porque el lector de pantalla ya lo lee del aria-label. */}
              <span className="barra__pista" aria-hidden="true">{t(texto)}</span>
              {to === '/social' && avisos > 0 && (
                <span className="insignia insignia--icono" role="status" aria-label={t('menu.avisosSocial', { n: avisos })}>
                  {avisos > 9 ? '9+' : avisos}
                </span>
              )}
            </NavLink>
          ))}
          <span className="barra__linea" ref={lineaRef} aria-hidden="true" />
        </nav>

        <div className="barra__acciones">
          <MenuUsuario perfil={perfil} setToken={setToken} />
          <MenuAjustes conAvisos />
        </div>
      </div>
    </header>
  )
}

export default Menu

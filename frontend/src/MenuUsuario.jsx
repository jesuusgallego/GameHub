import { useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import { useIdioma } from './IdiomaContext'
import { useMenuDesplegable } from './useMenuDesplegable'
import { borrarToken } from './sesion'

// Menú del usuario en la barra: la foto de perfil y, debajo, un desplegable con
// "Ver perfil" y "Cerrar sesión". (El idioma y el tema claro/oscuro están en el
// menú de ajustes, MenuAjustes.)
//  - perfil: nombre y foto del usuario (null mientras carga)
//  - setToken: para cerrar sesión (borrar el token hace que RutaProtegida me lleve al login)
//
// Se abre de tres formas, para que funcione con cualquier dispositivo:
//  - ratón: al pasar por encima (y se cierra al salir). Un clic en la foto lleva
//    directo al perfil.
//  - táctil: al tocar la foto (un móvil no tiene "pasar por encima"); desde el
//    desplegable se llega al perfil con "Ver perfil"
//  - teclado: Enter o Espacio sobre la foto, ya que es un botón
// La apertura, el cierre y sus animaciones están en useMenuDesplegable.

function MenuUsuario({ perfil, setToken }) {
  const { t } = useIdioma()
  const { fase, abierto, abrir, cerrar, contenedorRef, botonRef, propsContenedor } = useMenuDesplegable()
  // Con qué tipo de puntero se pulsó la foto por última vez (ver alPulsarFoto)
  const punteroRef = useRef("")
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Ratón: el menú ya se abrió al pasar por encima, así que el clic en la foto
  // va directo al perfil. Dedo o teclado: alterna el menú (abrir/cerrar), porque
  // no hay otra forma de abrirlo.
  // El tipo de puntero lo leo en "pointerdown" (que siempre lo trae bien y llega
  // antes del clic). Un clic de teclado no tiene pointerdown: queda en "".
  function alPulsarFoto() {
    const puntero = punteroRef.current
    punteroRef.current = ""

    if (puntero === 'mouse') {
      cerrar()
      navigate('/perfil')
    } else if (abierto) {
      cerrar()
    } else {
      abrir()
    }
  }

  function cerrarSesion() {
    borrarToken()
    setToken("")
  }

  return (
    <div
      ref={contenedorRef}
      className="menu-usuario"
      {...propsContenedor}
    >
      <button
        ref={botonRef}
        type="button"
        className={pathname === '/perfil' ? "menu-usuario__boton menu-usuario__boton--activo" : "menu-usuario__boton"}
        aria-label={t('menu.usuario')}
        aria-expanded={abierto}
        aria-controls="menu-usuario-panel"
        onPointerDown={(e) => { punteroRef.current = e.pointerType }}
        onClick={alPulsarFoto}
      >
        <Avatar usuario={perfil} tamano="pequeno" />
      </button>

      {fase !== 'cerrado' && (
        // El panel pega con el botón (sin hueco) y el espacio visual lo da su
        // padding. Además tiene un "puente" invisible (ver .menu-usuario__panel::before
        // en el CSS) para que el ratón no salga del menú al ir en diagonal.
        <div
          id="menu-usuario-panel"
          className={fase === 'cerrando' ? "menu-usuario__panel menu-usuario__panel--saliendo" : "menu-usuario__panel"}
        >
          <div className="menu-usuario__lista">
            {perfil && <p className="menu-usuario__nombre">{perfil.username}</p>}
            <Link to="/perfil" className="menu-usuario__opcion" onClick={cerrar}>
              {t('menu.verPerfil')}
            </Link>
            <button type="button" className="menu-usuario__opcion menu-usuario__opcion--salir" onClick={cerrarSesion}>
              {t('menu.cerrarSesion')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MenuUsuario

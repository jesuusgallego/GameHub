import { useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useIdioma } from './IdiomaContext'
import { useMenuDesplegable } from './useMenuDesplegable'

// El botón "Entrar" de la barra, arriba a la derecha, cuando se usa GameHub sin cuenta (en el sitio
// de la foto de perfil). Abre un desplegable con las dos opciones: iniciar sesión o crear una
// cuenta. Se abre como los otros menús de la barra (useMenuDesplegable): al pasar el ratón por
// encima, o al tocarlo / pulsar Enter en el móvil y con el teclado.
// Al entrar o registrarse se vuelve a la página en la que estabas (state.desde, ver Login.jsx).
function BotonAcceder() {
  const { t } = useIdioma()
  const { fase, abierto, abrir, cerrar, contenedorRef, botonRef, propsContenedor } = useMenuDesplegable()
  const punteroRef = useRef('')
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const estado = { desde: pathname + search }

  // Ratón: el menú ya se abrió al pasar por encima, así que el clic va directo a iniciar sesión (lo
  // más habitual). Dedo o teclado: abre y cierra el desplegable, que no tiene otra forma de abrirse.
  function alPulsar() {
    const puntero = punteroRef.current
    punteroRef.current = ''
    if (puntero === 'mouse') {
      cerrar()
      navigate('/login', { state: estado })
    } else if (abierto) {
      cerrar()
    } else {
      abrir()
    }
  }

  return (
    <div ref={contenedorRef} className="menu-usuario acceder" {...propsContenedor}>
      <button
        ref={botonRef}
        type="button"
        className="acceder__boton"
        aria-expanded={abierto}
        aria-controls="acceder-panel"
        onPointerDown={(e) => { punteroRef.current = e.pointerType }}
        onClick={alPulsar}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
        </svg>
        {t('invitado.entrar')}
        <svg className="acceder__flecha" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {fase !== 'cerrado' && (
        <div
          id="acceder-panel"
          className={fase === 'cerrando' ? 'menu-usuario__panel menu-usuario__panel--saliendo' : 'menu-usuario__panel'}
        >
          <div className="menu-usuario__lista">
            <p className="acceder__frase">
              <strong>{t('invitado.fraseTitulo')}</strong>
              {t('invitado.frase')}
            </p>
            <Link to="/login" state={estado} className="menu-usuario__opcion" onClick={cerrar}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="m10 17 5-5-5-5M15 12H3" />
              </svg>
              {t('invitado.iniciarSesion')}
            </Link>
            <Link to="/registro" state={estado} className="menu-usuario__opcion acceder__opcion--registro" onClick={cerrar}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="4" />
                <path d="M2 21v-1a6 6 0 0 1 6-6h2M19 14v6M16 17h6" />
              </svg>
              {t('invitado.crearCuenta')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default BotonAcceder

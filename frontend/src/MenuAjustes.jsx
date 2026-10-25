import { useState, useRef } from 'react'
import IconoTema from './IconoTema'
import BanderaIdioma from './BanderaIdioma'
import { temaActual, alternarTema } from './tema'
import { useIdioma } from './IdiomaContext'
import { IDIOMAS } from './idioma'
import { useMenuDesplegable } from './useMenuDesplegable'
import Interruptor from './Interruptor'
import { useAvisos, activarAvisos, desactivarAvisos } from './useAvisos'
import { puedeInstalarseEnIOS } from './pwa'
import { EVENTO_INSTALAR } from './InstalarIOS'

// Menú de ajustes: un botón de tres líneas con un desplegable para elegir el
// idioma de la interfaz y el tema claro/oscuro. Está en la barra, a la derecha de
// la foto de perfil, y también en el login y el registro (donde aún no hay barra).
//
// Se abre igual que el menú de la foto (ver useMenuDesplegable): al pasar el
// ratón por encima, o al tocarlo / pulsar Enter en móvil y teclado.
// Elegir un idioma o cambiar el tema NO cierra el menú: así se ve el cambio y se
// puede volver a pulsar.
// Con `conAvisos` (dentro de la app, con sesión) también está el interruptor de los avisos del
// sistema de los mensajes del chat (ver avisos.js).
function MenuAjustes({ conAvisos = false }) {
  const { t, idioma, setIdioma } = useIdioma()
  const avisos = useAvisos()
  const [tema, setTema] = useState(temaActual)
  const { fase, abierto, abrir, cerrar, contenedorRef, botonRef, propsContenedor } = useMenuDesplegable()
  // Con qué tipo de puntero se pulsó el botón por última vez (ver alPulsarBoton)
  const punteroRef = useRef("")

  // Ratón: el menú ya se abrió al pasar por encima, y cerrarlo con el clic sería
  // contraproducente (se cerraría estando el cursor encima), así que solo abre.
  // Dedo o teclado: alterna, porque no hay otra forma de abrirlo ni de cerrarlo.
  function alPulsarBoton() {
    const puntero = punteroRef.current
    punteroRef.current = ""

    if (puntero === 'mouse' || !abierto) abrir()
    else cerrar()
  }

  return (
    <div ref={contenedorRef} className="menu-usuario menu-ajustes" {...propsContenedor}>
      <button
        ref={botonRef}
        type="button"
        className="btn-icono menu-ajustes__boton"
        aria-label={t('ajustes.menu')}
        aria-expanded={abierto}
        aria-controls="menu-ajustes-panel"
        onPointerDown={(e) => { punteroRef.current = e.pointerType }}
        onClick={alPulsarBoton}
      >
        {/* Las tres líneas se convierten en una X mientras el menú está abierto */}
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path className="menu-ajustes__linea menu-ajustes__linea--arriba" d="M4 6h16" />
          <path className="menu-ajustes__linea menu-ajustes__linea--medio" d="M4 12h16" />
          <path className="menu-ajustes__linea menu-ajustes__linea--abajo" d="M4 18h16" />
        </svg>
      </button>

      {fase !== 'cerrado' && (
        <div
          id="menu-ajustes-panel"
          className={fase === 'cerrando' ? "menu-usuario__panel menu-usuario__panel--saliendo" : "menu-usuario__panel"}
        >
          <div className="menu-usuario__lista">
            <p className="menu-ajustes__titulo">{t('ajustes.idioma')}</p>
            <div role="group" aria-label={t('ajustes.idioma')}>
              {IDIOMAS.map(({ codigo, nombre }) => (
                <button
                  key={codigo}
                  type="button"
                  lang={codigo}
                  className={codigo === idioma ? "menu-usuario__opcion menu-usuario__opcion--activa" : "menu-usuario__opcion"}
                  aria-pressed={codigo === idioma}
                  onClick={() => setIdioma(codigo)}
                >
                  <span className="menu-ajustes__idioma">
                    <BanderaIdioma codigo={codigo} />
                    {nombre}
                  </span>
                  <svg className="menu-ajustes__check" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </button>
              ))}
            </div>

            <p className="menu-ajustes__titulo menu-ajustes__titulo--separado">{t('ajustes.tema')}</p>
            <button type="button" className="menu-usuario__opcion" onClick={() => setTema(alternarTema())}>
              {tema === "oscuro" ? t('ajustes.temaClaro') : t('ajustes.temaOscuro')}
              <IconoTema tema={tema} />
            </button>

            {/* Solo en el iPhone o el iPad sin la app instalada: vuelve a enseñar cómo instalarla */}
            {puedeInstalarseEnIOS() && (
              <>
                <p className="menu-ajustes__titulo menu-ajustes__titulo--separado">{t('instalar.app')}</p>
                <button type="button" className="menu-usuario__opcion" onClick={() => { cerrar(); window.dispatchEvent(new Event(EVENTO_INSTALAR)) }}>
                  {t('instalar.enIphone')}
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                    <path d="M12 7v7M9.5 11.5 12 14l2.5-2.5" />
                  </svg>
                </button>
              </>
            )}

            {conAvisos && avisos.disponible && (
              <>
                <p className="menu-ajustes__titulo menu-ajustes__titulo--separado">{t('ajustes.avisos')}</p>
                <div className="menu-ajustes__avisos">
                  <span id="ajustes-avisos-texto">{t('ajustes.avisosMensajes')}</span>
                  <Interruptor
                    activado={avisos.activos}
                    etiqueta={t('ajustes.avisosMensajes')}
                    disabled={avisos.permiso === 'denied'}
                    onChange={(activar) => (activar ? activarAvisos() : desactivarAvisos())}
                  />
                </div>
                {avisos.permiso === 'denied' && (
                  <p className="menu-ajustes__nota">{t('ajustes.avisosBloqueados')}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MenuAjustes

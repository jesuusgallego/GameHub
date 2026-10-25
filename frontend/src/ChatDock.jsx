import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Chat from './Chat'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'

// El chat: un botón abajo a la derecha, en todas las páginas con sesión, que despliega un panel
// con la lista de conversaciones y la que tengas abierta (una al lado de la otra si hay sitio, y
// una sola columna en el móvil). Lo monta Layout.
//
// El panel NO aparece encima del botón: ocupa su sitio. Al abrirse crece desde la esquina con el
// tamaño exacto del botón (un recorte con clip-path que se agranda) y el botón se esconde debajo;
// al cerrarse se encoge hasta el botón, que reaparece. Por eso parece que el botón se despliega.
//
//  - abierto: si el panel está desplegado
//  - sinLeer: mensajes sin leer; es el número del botón
//  - clave: la conversación abierta: un nombre de usuario o "g:<id>" (o null para ver la lista)
//  - yo: mi nombre de usuario (para los avisos de los grupos: "ana te añadió")
//  - borradores / setToken / ponerMensajes: se pasan al chat (ver Chat.jsx)
//  - onAbrir() / onCerrar(): el botón abre; la flecha del panel y Esc cierran
//  - onElegir(clave): abre una conversación (null = la lista)
// El chat de dentro solo existe mientras el panel está abierto (sondea el servidor cada pocos
// segundos: no tiene sentido hacerlo sin que nadie lo mire). Se pinta en el <body> (createPortal)
// para que ninguna transformación de la página lo descoloque (un `position: fixed` dentro de un
// elemento con `transform` deja de ser fijo a la ventana).
function ChatDock({ abierto, sinLeer, clave, yo, borradores, setToken, ponerMensajes, onAbrir, onCerrar, onElegir }) {
  const { t } = useIdioma()
  const { montado, saliendo } = usePresencia(abierto, 340)
  const panelRef = useRef(null)
  const lanzadorRef = useRef(null)

  // Al abrir, el foco entra en el panel (si no lo ha tomado ya el cuadro de escribir): así Esc
  // funciona de inmediato y el teclado sigue por dentro
  useEffect(() => {
    const panel = panelRef.current
    if (abierto && panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
  }, [abierto, montado])

  function cerrar() {
    onCerrar()
    // El foco vuelve al botón, que es de donde se abrió
    lanzadorRef.current?.focus({ preventScroll: true })
  }

  function alTeclear(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrar()
    }
  }

  return createPortal(
    <>
      {montado && (
        <div
          id="chat-dock"
          ref={panelRef}
          tabIndex={-1}
          role="region"
          className={saliendo ? 'chat-dock chat-dock--saliendo' : 'chat-dock'}
          aria-label={t('chat.titulo')}
          onKeyDown={alTeclear}
        >
          <div className="chat-dock__marco">
            <header className="chat-dock__barra">
              <h2>{t('chat.titulo')}</h2>
              <button type="button" className="chat-dock__cerrar" aria-label={t('chat.cerrar')} title={t('chat.cerrar')} onClick={cerrar}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </header>
            <div className="chat-dock__cuerpo">
              <Chat
                setToken={setToken}
                clave={clave}
                yo={yo}
                borradores={borradores}
                ponerMensajes={ponerMensajes}
                onElegir={onElegir}
              />
            </div>
          </div>
        </div>
      )}

      <button
        ref={lanzadorRef}
        type="button"
        className={[
          'chat-lanzador',
          abierto && 'chat-lanzador--oculto',
          sinLeer > 0 && 'chat-lanzador--avisos',
        ].filter(Boolean).join(' ')}
        aria-label={abierto ? t('chat.cerrar') : t('chat.abrir')}
        title={abierto ? t('chat.cerrar') : t('chat.abrir')}
        aria-expanded={abierto}
        aria-controls="chat-dock"
        tabIndex={abierto ? -1 : 0}
        // Abre y cierra: en el ordenador, con el panel abierto, el botón queda escondido debajo
        // (se cierra con la flecha del panel o con Esc); en el iPhone con la app instalada sigue a
        // la vista, convertido en una X, y el mismo botón lo cierra (ver cristal-ios.css)
        onClick={abierto ? cerrar : onAbrir}
      >
        <svg className="chat-lanzador__icono" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.8 7L3 20.5l1.6-5.2A8 8 0 1 1 21 12Z" />
          <circle className="chat-lanzador__punto" cx="8.5" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle className="chat-lanzador__punto" cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle className="chat-lanzador__punto" cx="15.5" cy="12" r="1.15" fill="currentColor" stroke="none" />
        </svg>
        {/* La X en la que se convierte el botón con el panel abierto (solo se ve en el iPhone) */}
        <svg className="chat-lanzador__x" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
        <span aria-hidden="true">{t('chat.titulo')}</span>
        {sinLeer > 0 && (
          <span className="chat-lanzador__cuenta" role="status" aria-label={t('chat.sinLeer', { n: sinLeer })}>
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>
    </>,
    document.body
  )
}

export default ChatDock

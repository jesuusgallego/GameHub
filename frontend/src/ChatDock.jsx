import { createPortal } from 'react-dom'
import Chat from './Chat'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'

// El chat de Social: un botón discreto abajo a la derecha que despliega hacia arriba un panel con
// la lista de conversaciones y la que tengas abierta. No ocupa sitio en la página ni es una pestaña
// más: está ahí cuando lo quieres.
//  - abierto: si el panel está desplegado (lo decide Social, desde la dirección)
//  - sinLeer: mensajes sin leer; es el número del botón
//  - username: la conversación abierta (o null para la lista)
//  - borradores / setToken: se pasan al chat (ver Chat.jsx)
//  - onAbrir() / onCerrar(): el botón alterna; la × y Esc cierran
// El chat de dentro solo existe mientras el panel está abierto (sondea el servidor cada pocos
// segundos: no tiene sentido hacerlo sin que nadie lo mire). Al cerrarse se pliega con animación.
// Se pinta en el <body> (createPortal) para que ninguna transformación de la página lo descoloque
// (un `position: fixed` dentro de un elemento con `transform` deja de ser fijo a la ventana).
function ChatDock({ abierto, sinLeer, username, borradores, setToken, onAbrir, onCerrar }) {
  const { t } = useIdioma()
  const { montado, saliendo } = usePresencia(abierto, 220)

  function alTeclear(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar()
    }
  }

  return createPortal(
    <>
      {montado && (
        <section
          id="chat-dock"
          className={saliendo ? 'chat-dock chat-dock--saliendo' : 'chat-dock'}
          aria-label={t('chat.titulo')}
          onKeyDown={alTeclear}
        >
          <header className="chat-dock__barra">
            <h2>{t('chat.titulo')}</h2>
            <button type="button" className="chat-dock__cerrar" aria-label={t('chat.cerrar')} title={t('chat.cerrar')} onClick={onCerrar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </header>
          <div className="chat-dock__cuerpo">
            <Chat setToken={setToken} username={username} borradores={borradores} />
          </div>
        </section>
      )}

      <button
        type="button"
        className={abierto ? 'chat-lanzador chat-lanzador--abierto' : 'chat-lanzador'}
        aria-label={abierto ? t('chat.cerrar') : t('chat.abrir')}
        title={abierto ? t('chat.cerrar') : t('chat.abrir')}
        aria-expanded={abierto}
        aria-controls="chat-dock"
        onClick={abierto ? onCerrar : onAbrir}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.8 7L3 20.5l1.6-5.2A8 8 0 1 1 21 12Z" />
          <path d="M8.5 11h7M8.5 14h4" />
        </svg>
        {sinLeer > 0 && !abierto && (
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

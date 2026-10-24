import { partirEnlaces } from './logicaChat'
import { useIdioma } from './IdiomaContext'

// Un mensaje del chat. Con el texto, los enlaces como enlaces y, debajo, la hora y el "Visto".
//  - mensaje: { id, mine, body, created_at, deleted, hidden?, nuevo?, estado? }; `estado` solo
//    lo llevan los que aún no han llegado al servidor: 'enviando' o 'error'; `hidden`, los de
//    un grupo escritos por alguien a quien has bloqueado (llegan sin texto)
//  - ultimo: es el último de su bloque (el que lleva la hora)
//  - visto: el texto del "Visto" ("Visto a las 18:04", "Visto por ana") si va debajo de este
//  - onEliminar(mensaje): abre la confirmación de borrado (solo en los míos ya enviados)
//  - onReintentar() / onDescartar(): para los que fallaron
function Burbuja({ mensaje, ultimo = false, visto = null, onEliminar, onReintentar, onDescartar }) {
  const { t, locale } = useIdioma()
  const { mine, deleted, estado, hidden } = mensaje
  const formatoHora = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })
  const hora = formatoHora.format(new Date(mensaje.created_at))
  const completa = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' })
    .format(new Date(mensaje.created_at))

  const clases = [
    'chat-burbuja',
    mine ? 'chat-burbuja--mia' : 'chat-burbuja--suya',
    (deleted || hidden) && 'chat-burbuja--borrada',
    estado === 'enviando' && 'chat-burbuja--enviando',
    estado === 'error' && 'chat-burbuja--error',
    mensaje.nuevo && 'chat-burbuja--nueva',
  ].filter(Boolean).join(' ')

  // Pie: la hora (solo en el último de cada bloque) y "Visto"
  const pie = []
  if (estado === 'enviando') pie.push(t('chat.enviando'))
  else if (ultimo && !estado) pie.push(hora)
  if (visto) pie.push(visto)

  return (
    <div className={clases}>
      <div className="chat-burbuja__fila">
        {mine && onEliminar && !deleted && !estado && (
          <button
            type="button"
            className="chat-burbuja__borrar"
            aria-label={t('chat.eliminarMensaje')}
            title={t('chat.eliminarMensaje')}
            onClick={() => onEliminar(mensaje)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        )}

        <p className="chat-burbuja__texto" title={completa}>
          {deleted || hidden ? (
            <span className="chat-burbuja__eliminado">{deleted ? t('chat.mensajeEliminado') : t('chat.mensajeOculto')}</span>
          ) : (
            partirEnlaces(mensaje.body).map((trozo, i) => (
              trozo.enlace
                ? <a key={i} href={trozo.enlace} target="_blank" rel="noopener noreferrer">{trozo.texto}</a>
                : <span key={i}>{trozo.texto}</span>
            ))
          )}
        </p>
      </div>

      {estado === 'error' && (
        <p className="chat-burbuja__fallo" role="alert">
          <span>{t('chat.noEnviado')}</span>
          <button type="button" onClick={onReintentar}>{t('chat.reintentar')}</button>
          <button type="button" onClick={onDescartar}>{t('chat.descartar')}</button>
        </p>
      )}

      {pie.length > 0 && <small className="chat-burbuja__pie">{pie.join(' · ')}</small>}
    </div>
  )
}

export default Burbuja

import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { estiloTono } from './tono'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { tramoLista, vistaPrevia } from './chat'

// La hora de la última actividad en la lista: la hora si fue hoy, "Ayer", el día de la semana
// si fue esta semana y la fecha corta si fue antes
function useEtiquetaFecha() {
  const { t, locale } = useIdioma()
  const hora = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })
  const dia = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const fecha = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })

  return (iso) => {
    const d = new Date(iso)
    switch (tramoLista(iso)) {
      case 'hoy': return hora.format(d)
      case 'ayer': return t('chat.dia.ayer')
      case 'semana': return dia.format(d)
      default: return fecha.format(d)
    }
  }
}

// El panel para empezar una conversación nueva: tus amigos, con un filtro por nombre.
function ElegirAmigo({ amigos, saliendo, onElegir }) {
  const { t } = useIdioma()
  const [filtro, setFiltro] = useState('')
  const texto = filtro.trim().toLowerCase()
  const visibles = (amigos ?? []).filter((a) => a.username.includes(texto))

  return (
    <div className={saliendo ? 'chat-nuevo chat-nuevo--saliendo' : 'chat-nuevo'}>
      <p className="chat-nuevo__titulo">{t('chat.nuevoTitulo')}</p>

      {amigos === null && <Cargando texto={t('social.cargando')} />}

      {amigos !== null && amigos.length === 0 && (
        <div className="chat-nuevo__vacio">
          <p>{t('chat.sinAmigos')}</p>
          <Link to="/social?tab=descubrir" className="btn btn--primario">{t('chat.irDescubrir')}</Link>
        </div>
      )}

      {amigos !== null && amigos.length > 0 && (
        <>
          <input
            type="search"
            value={filtro}
            placeholder={t('chat.buscarAmigoPlaceholder')}
            aria-label={t('chat.buscarAmigo')}
            autoComplete="off"
            onChange={(e) => setFiltro(e.target.value)}
          />
          {visibles.length === 0 ? (
            <p className="chat-nuevo__vacio">{t('chat.sinAmigosFiltro', { q: filtro.trim() })}</p>
          ) : (
            <ul className="chat-nuevo__lista">
              {visibles.map((amigo) => (
                <li key={amigo.username} style={estiloTono(amigo.username)}>
                  <Link to={`/chat/${amigo.username}`} onClick={onElegir}>
                    <AvatarTono usuario={amigo} tamano="pequeno" vivo={Boolean(amigo.playing)} />
                    <span className="chat-nuevo__texto">
                      <strong>{amigo.username}</strong>
                      {amigo.playing && <small>{t('chat.jugando', { juego: amigo.playing.name })}</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// La columna de la izquierda del chat: tus conversaciones, la más reciente primero, con lo
// último que se dijo y cuántos mensajes tienes sin leer, y el botón para escribir a otro amigo.
//  - conversaciones: la lista del servidor, o null mientras carga
//  - amigos: tus amigos (para el panel de "Nuevo mensaje" y para saber quién está jugando)
//  - error: texto si no se pudo cargar
function ListaChats({ conversaciones, amigos, error }) {
  const { t } = useIdioma()
  const etiquetaFecha = useEtiquetaFecha()
  const [eligiendo, setEligiendo] = useState(false)
  const { montado, saliendo } = usePresencia(eligiendo)

  const jugando = new Map((amigos ?? []).map((a) => [a.username, a.playing]))

  return (
    <div className="chat-lista">
      <div className="chat-lista__cabecera">
        <h1 className="chat-lista__titulo">{t('chat.titulo')}</h1>
        <button
          type="button"
          className={eligiendo ? 'btn btn--secundario chat-lista__nuevo' : 'btn btn--primario chat-lista__nuevo'}
          aria-expanded={eligiendo}
          onClick={() => setEligiendo((v) => !v)}
        >
          {eligiendo ? (
            t('chat.nuevoCerrar')
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('chat.nuevo')}
            </>
          )}
        </button>
      </div>

      {montado && <ElegirAmigo amigos={amigos} saliendo={saliendo} onElegir={() => setEligiendo(false)} />}

      <Mensaje texto={error} />

      {conversaciones === null && !error && <Cargando texto={t('social.cargando')} centrado />}

      {conversaciones !== null && conversaciones.length === 0 && !eligiendo && (
        <div className="chat-lista__vacio">
          <h2>{t('chat.vacio.titulo')}</h2>
          <p>{t('chat.vacio.texto')}</p>
        </div>
      )}

      {conversaciones !== null && conversaciones.length > 0 && (
        <ul className="chat-lista__filas" aria-label={t('chat.lista')}>
          {conversaciones.map((c, i) => {
            const juego = jugando.get(c.username)
            const sinLeer = c.unread > 0
            return (
              <li key={c.username} style={{ ...estiloTono(c.username), '--orden': Math.min(i, 10) }}>
                <NavLink
                  to={`/chat/${c.username}`}
                  className={({ isActive }) => [
                    'chat-fila',
                    isActive && 'chat-fila--activa',
                    sinLeer && 'chat-fila--sin-leer',
                  ].filter(Boolean).join(' ')}
                >
                  <AvatarTono usuario={c} tamano="normal" vivo={Boolean(juego)} />
                  <span className="chat-fila__texto">
                    <span className="chat-fila__arriba">
                      <strong>{c.username}</strong>
                      <time dateTime={c.last.created_at}>{etiquetaFecha(c.last.created_at)}</time>
                    </span>
                    <span className="chat-fila__abajo">
                      <span className="chat-fila__previa">{vistaPrevia(c.last, t)}</span>
                      {sinLeer && (
                        <span className="chat-fila__cuenta" aria-label={t('chat.sinLeer', { n: c.unread })}>
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default ListaChats

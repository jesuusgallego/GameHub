import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
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

// "¿A quién escribes?": una hoja que sube sobre la lista con tus amigos como círculos de colores,
// los que están jugando primero y con su punto verde, igual que en la cabecera de Social. Un filtro
// por nombre arriba. Elegir a alguien abre su conversación.
//  - amigos: GET /friends (null mientras carga)
//  - saliendo: la hoja se está cerrando (para la animación de salida)
//  - onElegir(usuario) / onCerrar()
function ElegirAmigo({ amigos, saliendo, onElegir, onCerrar }) {
  const { t } = useIdioma()
  const [filtro, setFiltro] = useState('')
  const campoRef = useRef(null)
  const texto = filtro.trim().toLowerCase()

  // Los que juegan, primero; luego por orden alfabético (el servidor ya los da así)
  const ordenados = [...(amigos ?? [])].sort((a, b) => Number(Boolean(b.playing)) - Number(Boolean(a.playing)))
  const visibles = ordenados.filter((a) => a.username.includes(texto))

  // En pantallas con ratón, el cursor ya está en el filtro (en las táctiles abriría el teclado)
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) campoRef.current?.focus()
  }, [amigos])

  // Esc cierra solo la hoja, no el panel entero
  function alTeclear(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCerrar()
    }
  }

  return (
    <div
      className={saliendo ? 'chat-nuevo chat-nuevo--saliendo' : 'chat-nuevo'}
      role="dialog"
      aria-label={t('chat.nuevoTitulo')}
      onKeyDown={alTeclear}
    >
      <div className="chat-nuevo__cabecera">
        <div>
          <p className="chat-nuevo__sobre">{t('chat.nuevo')}</p>
          <h2 className="chat-nuevo__titulo">{t('chat.nuevoTitulo')}</h2>
        </div>
        <button type="button" className="chat-nuevo__cerrar" aria-label={t('chat.nuevoCerrar')} title={t('chat.nuevoCerrar')} onClick={onCerrar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {amigos === null && <Cargando texto={t('social.cargando')} centrado />}

      {amigos !== null && amigos.length === 0 && (
        <div className="chat-nuevo__vacio">
          <p>{t('chat.sinAmigos')}</p>
          <Link to="/social?tab=descubrir" className="btn btn--primario" onClick={onCerrar}>{t('chat.irDescubrir')}</Link>
        </div>
      )}

      {amigos !== null && amigos.length > 0 && (
        <>
          <div className="caja-busqueda chat-nuevo__buscar">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={campoRef}
              type="search"
              value={filtro}
              placeholder={t('chat.buscarAmigoPlaceholder')}
              aria-label={t('chat.buscarAmigo')}
              autoComplete="off"
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          {visibles.length === 0 ? (
            <p className="chat-nuevo__sinresultados">{t('chat.sinAmigosFiltro', { q: filtro.trim() })}</p>
          ) : (
            <ul className="chat-nuevo__rejilla">
              {visibles.map((amigo, i) => (
                <li key={amigo.username} style={{ ...estiloTono(amigo.username), '--orden': Math.min(i, 12) }}>
                  <button type="button" className="chat-nuevo__amigo" onClick={() => onElegir(amigo.username)}>
                    <AvatarTono usuario={amigo} tamano="grande" vivo={Boolean(amigo.playing)} />
                    <span className="chat-nuevo__nombre">{amigo.username}</span>
                    {amigo.playing && (
                      <span className="chat-nuevo__juego">
                        <span className="chat-nuevo__punto" aria-hidden="true" />
                        {amigo.playing.name}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// La columna de las conversaciones: la más reciente primero, con lo último que se dijo y cuántos
// mensajes tienes sin leer, y el botón para escribir a otro amigo.
//  - conversaciones: la lista del servidor, o null mientras carga
//  - amigos: tus amigos (para la hoja "Nuevo mensaje" y para saber quién está jugando)
//  - error: texto si no se pudo cargar
//  - activo: el usuario de la conversación abierta (o null)
//  - onElegir(usuario): abre una conversación
function ListaChats({ conversaciones, amigos, error, activo, onElegir }) {
  const { t } = useIdioma()
  const etiquetaFecha = useEtiquetaFecha()
  const [eligiendo, setEligiendo] = useState(false)
  const { montado, saliendo } = usePresencia(eligiendo, 260)

  const jugando = new Map((amigos ?? []).map((a) => [a.username, a.playing]))

  function elegir(usuario) {
    setEligiendo(false)
    onElegir(usuario)
  }

  return (
    <div className="chat-lista">
      <div className="chat-lista__cabecera">
        <h1 className="chat-lista__titulo">{t('chat.lista')}</h1>

        <button type="button" className="chat-componer" aria-haspopup="dialog" onClick={() => setEligiendo(true)}>
          {/* Una pluma sobre una hoja: al pasar el ratón, escribe */}
          <svg className="chat-componer__icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="chat-componer__hoja" d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
            <path className="chat-componer__pluma" d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
          <span>{t('chat.nuevo')}</span>
        </button>
      </div>

      <Mensaje texto={error} />

      {conversaciones === null && !error && <Cargando texto={t('social.cargando')} centrado />}

      {conversaciones !== null && conversaciones.length === 0 && (
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
                <button
                  type="button"
                  onClick={() => onElegir(c.username)}
                  aria-current={c.username === activo ? 'true' : undefined}
                  className={[
                    'chat-fila',
                    c.username === activo && 'chat-fila--activa',
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
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {montado && <ElegirAmigo amigos={amigos} saliendo={saliendo} onElegir={elegir} onCerrar={() => setEligiendo(false)} />}
    </div>
  )
}

export default ListaChats

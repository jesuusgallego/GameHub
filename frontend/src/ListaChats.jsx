import { useState } from 'react'
import { apiFetch } from './api'
import AvatarTono from './AvatarTono'
import AvatarGrupo from './AvatarGrupo'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import PuntosEscribiendo from './PuntosEscribiendo'
import SelectorAmigos from './SelectorAmigos'
import { estiloTono } from './tono'
import { usePresencia } from './usePresencia'
import { useIdioma } from './IdiomaContext'
import { useAvisos, activarAvisos, desactivarAvisos } from './useAvisos'
import { tramoLista, vistaPrevia, textoEscribiendo, nombreSugerido } from './logicaChat'
import { GRUPO_MAX_MIEMBROS, GRUPO_NOMBRE_MAX } from './validacion'

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

// La hoja "Nuevo mensaje", que sube sobre la lista, con dos modos:
//  - Mensaje: "¿A quién escribes?"; elegir a un amigo abre su conversación
//  - Grupo: eliges a varios amigos (de 2 a GRUPO_MAX_MIEMBROS - 1), le pones nombre (se propone
//    uno con sus nombres) y se crea
//  - amigos: GET /friends (null mientras carga)
//  - saliendo: la hoja se está cerrando (para la animación de salida)
//  - onElegir(usuario) / onCreado(clave del grupo) / onCerrar()
function HojaNuevo({ amigos, saliendo, onElegir, onCreado, onCerrar }) {
  const { t } = useIdioma()
  const [modo, setModo] = useState('mensaje')
  // Por orden de elección: así el nombre propuesto sigue el orden en que los eliges
  const [seleccion, setSeleccion] = useState([])
  const [nombre, setNombre] = useState('')
  const [tocado, setTocado] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')

  const maximo = GRUPO_MAX_MIEMBROS - 1
  const sugerido = nombreSugerido(seleccion, t, GRUPO_NOMBRE_MAX)
  // Mientras no escribas un nombre, se usa el propuesto (y se va poniendo al día al elegir)
  const nombreFinal = (tocado ? nombre : sugerido).trim()
  const puedeCrear = seleccion.length >= 2 && nombreFinal.length > 0 && !creando

  function alternar(usuario) {
    setError('')
    setSeleccion((previa) => (previa.includes(usuario)
      ? previa.filter((u) => u !== usuario)
      : previa.length < maximo ? [...previa, usuario] : previa))
  }

  async function crear(e) {
    e.preventDefault()
    if (!puedeCrear) return
    setCreando(true)
    setError('')
    try {
      const data = await apiFetch('/chat/g', { method: 'POST', body: { name: nombreFinal, members: seleccion } })
      onCreado(data.group.key)
    } catch (err) {
      setError(err.message)
      setCreando(false)
    }
  }

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
      aria-label={modo === 'grupo' ? t('chat.grupo.nuevoTitulo') : t('chat.nuevoTitulo')}
      onKeyDown={alTeclear}
    >
      <div className="chat-nuevo__cabecera">
        <div>
          <p className="chat-nuevo__sobre">{modo === 'grupo' ? t('chat.grupo.nuevo') : t('chat.nuevo')}</p>
          <h2 className="chat-nuevo__titulo">{modo === 'grupo' ? t('chat.grupo.nuevoTitulo') : t('chat.nuevoTitulo')}</h2>
        </div>
        <button type="button" className="chat-nuevo__cerrar" aria-label={t('chat.nuevoCerrar')} title={t('chat.nuevoCerrar')} onClick={onCerrar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* Dos modos con una pastilla que se desliza de uno a otro */}
      {amigos?.length > 0 && (
        <div className={`chat-modos chat-modos--${modo}`} role="radiogroup" aria-label={t('chat.modos')}>
          <span className="chat-modos__pastilla" aria-hidden="true" />
          <button type="button" role="radio" aria-checked={modo === 'mensaje'} onClick={() => setModo('mensaje')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a8 8 0 0 1-11.8 7L3 20.5l1.6-5.2A8 8 0 1 1 21 12Z" />
            </svg>
            {t('chat.modo.mensaje')}
          </button>
          <button type="button" role="radio" aria-checked={modo === 'grupo'} onClick={() => setModo('grupo')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3 19a6 6 0 0 1 12 0M16 4.6a3 3 0 0 1 0 5.8M18 14.2a5.5 5.5 0 0 1 3 4.8" />
            </svg>
            {t('chat.modo.grupo')}
          </button>
        </div>
      )}

      {modo === 'grupo' && amigos?.length > 0 && (
        <p className="chat-nuevo__ayuda" aria-live="polite">
          {seleccion.length === 0
            ? t('chat.grupo.ayuda', { n: maximo })
            : t('chat.grupo.elegidos', { n: seleccion.length, max: maximo })}
        </p>
      )}

      <div className="chat-nuevo__cuerpo">
        <SelectorAmigos
          key={modo}
          amigos={amigos}
          seleccion={modo === 'grupo' ? seleccion : null}
          lleno={seleccion.length >= maximo}
          onElegir={onElegir}
          onAlternar={alternar}
          onIrDescubrir={onCerrar}
        />
      </div>

      {modo === 'grupo' && amigos?.length > 0 && (
        <form className={seleccion.length >= 2 ? 'chat-crear chat-crear--listo' : 'chat-crear'} onSubmit={crear}>
          <Mensaje texto={error} />
          <label className="chat-crear__campo">
            <span>{t('chat.grupo.nombre')}</span>
            <input
              type="text"
              value={tocado ? nombre : sugerido}
              maxLength={GRUPO_NOMBRE_MAX}
              placeholder={t('chat.grupo.nombrePlaceholder')}
              onChange={(e) => { setTocado(true); setNombre(e.target.value) }}
            />
          </label>
          <button type="submit" className="btn btn--primario chat-crear__boton" disabled={!puedeCrear}>
            {creando ? <><Cargando tamano="pequeno" /> {t('chat.grupo.creando')}</> : t('chat.grupo.crear', { n: seleccion.length + 1 })}
          </button>
        </form>
      )}
    </div>
  )
}

// La tarjeta que ofrece activar los avisos del sistema. Sale en la lista hasta que eliges (sí o
// "ahora no"); después se cambia desde el menú de ajustes.
function TarjetaAvisos() {
  const { t } = useIdioma()
  const { disponible, permiso, preferencia } = useAvisos()
  const visible = disponible && preferencia === null && permiso !== 'denied'
  const { montado, saliendo } = usePresencia(visible, 260)
  if (!montado) return null

  return (
    <div className={saliendo ? 'chat-avisos chat-avisos--saliendo' : 'chat-avisos'} role="region" aria-label={t('avisos.tarjeta.titulo')}>
      <span className="chat-avisos__icono" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
          <path className="chat-avisos__badajo" d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
      </span>
      <div className="chat-avisos__texto">
        <strong>{t('avisos.tarjeta.titulo')}</strong>
        <p>{t('avisos.tarjeta.texto')}</p>
        <div className="chat-avisos__acciones">
          <button type="button" className="btn btn--primario" onClick={activarAvisos}>{t('avisos.activar')}</button>
          <button type="button" className="btn btn--secundario" onClick={desactivarAvisos}>{t('avisos.ahoraNo')}</button>
        </div>
      </div>
    </div>
  )
}

// Una fila de la lista: una persona o un grupo
function FilaConversacion({ c, activa, jugando, yo, etiquetaFecha, onElegir, orden }) {
  const { t } = useIdioma()
  const grupo = c.type === 'group'
  const sinLeer = c.unread > 0
  const quienesEscriben = grupo ? c.typing : (c.typing ? [c.username] : [])
  const nombre = grupo ? c.name : c.username

  return (
    <li style={{ ...estiloTono(nombre), '--orden': Math.min(orden, 10) }}>
      <button
        type="button"
        onClick={() => onElegir(c.key)}
        aria-current={activa ? 'true' : undefined}
        className={[
          'chat-fila',
          grupo && 'chat-fila--grupo',
          activa && 'chat-fila--activa',
          sinLeer && 'chat-fila--sin-leer',
        ].filter(Boolean).join(' ')}
      >
        {grupo
          ? <AvatarGrupo nombre={c.name} miembros={c.members} />
          : <AvatarTono usuario={c} tamano="normal" vivo={Boolean(jugando)} />}
        <span className="chat-fila__texto">
          <span className="chat-fila__arriba">
            <strong>
              {nombre}
              {grupo && <span className="chat-fila__cuantos" aria-label={t('chat.grupo.personas', { n: c.member_count })}>{c.member_count}</span>}
            </strong>
            {c.last && <time dateTime={c.last.created_at}>{etiquetaFecha(c.last.created_at)}</time>}
          </span>
          <span className="chat-fila__abajo">
            {quienesEscriben.length > 0 ? (
              <span className="chat-fila__previa chat-fila__previa--escribiendo">
                <PuntosEscribiendo />
                {textoEscribiendo(quienesEscriben, t, grupo)}
              </span>
            ) : (
              <span className="chat-fila__previa">{vistaPrevia(c.last, t, { grupo, yo })}</span>
            )}
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
}

// La columna de las conversaciones: la más reciente primero (personas y grupos mezclados), con
// lo último que se dijo y cuántos mensajes tienes sin leer, y el botón para escribir a otro
// amigo o crear un grupo.
//  - conversaciones: la lista del servidor, o null mientras carga
//  - amigos: tus amigos (para la hoja "Nuevo mensaje" y para saber quién está jugando)
//  - error: texto si no se pudo cargar
//  - activo: la clave de la conversación abierta (o null)
//  - yo: mi nombre de usuario
//  - onElegir(clave): abre una conversación
//  - onCreado(clave): se acaba de crear un grupo
function ListaChats({ conversaciones, amigos, error, activo, yo, onElegir, onCreado }) {
  const { t } = useIdioma()
  const etiquetaFecha = useEtiquetaFecha()
  const [eligiendo, setEligiendo] = useState(false)
  const { montado, saliendo } = usePresencia(eligiendo, 260)

  const jugando = new Map((amigos ?? []).map((a) => [a.username, a.playing]))

  function elegir(usuario) {
    setEligiendo(false)
    onElegir(usuario)
  }

  function creado(clave) {
    setEligiendo(false)
    onCreado(clave)
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

      <TarjetaAvisos />

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
          {conversaciones.map((c, i) => (
            <FilaConversacion
              key={c.key}
              c={c}
              orden={i}
              activa={c.key === activo}
              jugando={c.type === 'user' ? jugando.get(c.username) : null}
              yo={yo}
              etiquetaFecha={etiquetaFecha}
              onElegir={onElegir}
            />
          ))}
        </ul>
      )}

      {montado && (
        <HojaNuevo
          amigos={amigos}
          saliendo={saliendo}
          onElegir={elegir}
          onCreado={creado}
          onCerrar={() => setEligiendo(false)}
        />
      )}
    </div>
  )
}

export default ListaChats

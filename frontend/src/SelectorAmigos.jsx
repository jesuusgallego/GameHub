import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import Cargando from './Cargando'
import { estiloTono } from './tono'
import { useIdioma } from './IdiomaContext'

// Tus amigos como círculos de colores, con un filtro por nombre arriba. Los que están jugando
// van primero, con su punto verde y su juego, igual que en la cabecera de Social. Sirve para:
//  - elegir a UNO (nuevo mensaje): pulsar un amigo llama a onElegir(nombre)
//  - elegir a VARIOS (nuevo grupo, añadir a un grupo): con `seleccion` (los nombres elegidos),
//    pulsar alterna con onAlternar(nombre) y los elegidos llevan una marca
//  - amigos: GET /friends (null mientras carga)
//  - excluir: nombres que no se ofrecen (los que ya están en el grupo)
//  - lleno: ya no caben más; los no elegidos se ven apagados
//  - onIrDescubrir(): al pulsar "Descubrir personas" cuando no tienes amigos
function SelectorAmigos({ amigos, seleccion = null, excluir = null, lleno = false, onElegir, onAlternar, onIrDescubrir }) {
  const { t } = useIdioma()
  const [filtro, setFiltro] = useState('')
  const campoRef = useRef(null)
  const texto = filtro.trim().toLowerCase()
  const multiple = seleccion !== null

  const disponibles = (amigos ?? []).filter((a) => !excluir?.has(a.username))
  // Los que juegan, primero; luego por orden alfabético (el servidor ya los da así)
  const ordenados = [...disponibles].sort((a, b) => Number(Boolean(b.playing)) - Number(Boolean(a.playing)))
  const visibles = ordenados.filter((a) => a.username.includes(texto))

  // En pantallas con ratón, el cursor ya está en el filtro (en las táctiles abriría el teclado)
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) campoRef.current?.focus()
  }, [amigos])

  if (amigos === null) return <Cargando texto={t('social.cargando')} centrado />

  if (amigos.length === 0) {
    return (
      <div className="chat-nuevo__vacio">
        <p>{t('chat.sinAmigos')}</p>
        <Link to="/social?tab=descubrir" className="btn btn--primario" onClick={onIrDescubrir}>{t('chat.irDescubrir')}</Link>
      </div>
    )
  }

  if (disponibles.length === 0) {
    return <p className="chat-nuevo__sinresultados">{t('chat.grupo.todosDentro')}</p>
  }

  return (
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
        <ul className="chat-nuevo__rejilla" aria-label={multiple ? t('chat.grupo.elige') : undefined}>
          {visibles.map((amigo, i) => {
            const elegido = multiple && seleccion.includes(amigo.username)
            const apagado = multiple && lleno && !elegido
            return (
              <li key={amigo.username} style={{ ...estiloTono(amigo.username), '--orden': Math.min(i, 12) }}>
                <button
                  type="button"
                  className={[
                    'chat-nuevo__amigo',
                    elegido && 'chat-nuevo__amigo--elegido',
                    apagado && 'chat-nuevo__amigo--apagado',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={multiple ? elegido : undefined}
                  disabled={apagado}
                  onClick={() => (multiple ? onAlternar(amigo.username) : onElegir(amigo.username))}
                >
                  <span className="chat-nuevo__cara">
                    <AvatarTono usuario={amigo} tamano="grande" vivo={Boolean(amigo.playing)} />
                    {multiple && (
                      <span className="chat-nuevo__marca" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="chat-nuevo__nombre">{amigo.username}</span>
                  {amigo.playing && (
                    <span className="chat-nuevo__juego">
                      <span className="chat-nuevo__punto" aria-hidden="true" />
                      {amigo.playing.name}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default SelectorAmigos

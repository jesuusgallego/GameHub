import { useState, useEffect, useRef } from 'react'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { ESTADOS } from './estados'
import { useIdioma } from './IdiomaContext'

// La biblioteca de otra persona (solo la ve quien ella deja): una rejilla de portadas con su
// estado y su nota. Filtros por estado y por "en común" (los juegos que yo también tengo).
// Pulsar un juego abre su ficha con la partida de esa persona (y sus logros, si los deja ver).
//  - username: de quién es
//  - juegoInicial: igdb_id de un juego que abrir en cuanto cargue (viene de la actividad)
//  - onAbrir(fila, datos): el padre abre la ficha. `datos` trae reviews_visible y
//    achievements_visible
//  - cambios: sube cuando el padre cambió algo (añadí un juego a mi biblioteca): recargo para
//    que "en común" y mi nota estén al día
//  - cerrarSesion(): para un 401
function BibliotecaAjena({ username, juegoInicial, onAbrir, cambios = 0, cerrarSesion }) {
  const { t } = useIdioma()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [estado, setEstado] = useState("todos")
  const [soloComun, setSoloComun] = useState(false)
  // Para abrir el juego de la URL una sola vez (no cada vez que recargo la lista)
  const abiertoInicial = useRef(false)

  useEffect(() => {
    let cancelado = false

    apiFetch(`/users/${encodeURIComponent(username)}/games`)
      .then((data) => { if (!cancelado) setDatos(data) })
      .catch((err) => {
        if (cancelado) return
        if (err.status === 401) return cerrarSesion()
        setError(err.message)
      })

    return () => { cancelado = true }
  }, [username, cambios, cerrarSesion])

  // Si vengo de pulsar un juego en la actividad, abro su ficha en cuanto hay datos (una vez)
  useEffect(() => {
    if (!datos || !juegoInicial || abiertoInicial.current) return
    abiertoInicial.current = true
    const fila = datos.games.find((g) => g.igdb_id === Number(juegoInicial))
    if (fila) onAbrir(fila, datos)
  }, [datos, juegoInicial, onAbrir])

  if (error) return <Mensaje texto={error} />
  if (!datos) return <Cargando texto={t('ajena.cargando')} centrado />

  const { games, reviews_visible: verResenas } = datos
  const enComun = games.filter((g) => g.in_common).length
  const porEstado = (id) => games.filter((g) => g.status === id).length

  const visibles = games.filter(
    (g) => (estado === "todos" || g.status === estado) && (!soloComun || g.in_common)
  )

  if (games.length === 0) return <p className="sala-vacio">{t('stats.vacioOtro')}</p>

  return (
    <div className="biblioteca-ajena">
      <div className="filtros-chips" role="group" aria-label={t('ajena.filtrar')}>
        <button
          type="button"
          className={estado === "todos" ? "chip-filtro chip-filtro--activo" : "chip-filtro"}
          aria-pressed={estado === "todos"}
          onClick={() => setEstado("todos")}
        >
          {t('ajena.todos')} <span>{games.length}</span>
        </button>
        {ESTADOS.filter((id) => porEstado(id) > 0).map((id) => (
          <button
            key={id}
            type="button"
            className={estado === id ? "chip-filtro chip-filtro--activo" : "chip-filtro"}
            aria-pressed={estado === id}
            onClick={() => setEstado(id)}
          >
            <span className={`punto punto--${id}`} aria-hidden="true" />
            {t(`estado.${id}`)} <span>{porEstado(id)}</span>
          </button>
        ))}
        {enComun > 0 && (
          <button
            type="button"
            className={soloComun ? "chip-filtro chip-filtro--activo chip-filtro--comun" : "chip-filtro chip-filtro--comun"}
            aria-pressed={soloComun}
            onClick={() => setSoloComun((v) => !v)}
          >
            {t('ajena.enComun')} <span>{enComun}</span>
          </button>
        )}
      </div>

      {!verResenas && games.some((g) => g.has_review) && (
        <p className="privacidad__ayuda">{t('ajena.resenasOcultas', { usuario: username })}</p>
      )}

      {visibles.length === 0 ? (
        <p className="sala-vacio">{t('ajena.sinResultados')}</p>
      ) : (
        <ul className="estanteria">
          {visibles.map((g, i) => {
            const logros = g.achievements_total > 0 ? g.achievements_unlocked / g.achievements_total : null
            return (
              <li key={g.igdb_id} style={{ '--orden': Math.min(i, 14) }}>
                <button
                  type="button"
                  className={`cartucho cartucho--${g.status}`}
                  onClick={() => onAbrir(g, datos)}
                  aria-label={t('social.abrirFicha', { juego: g.name })}
                >
                  <span className="cartucho__portada">
                    {g.cover_url ? <img src={g.cover_url} alt="" loading="lazy" /> : <span>{t('comun.sinPortada')}</span>}
                    {g.rating != null && <span className="cartucho__nota">{g.rating}<small>/10</small></span>}
                    {g.in_common && <span className="cartucho__comun">{t('ajena.enComun')}</span>}
                    {logros !== null && (
                      <span className="cartucho__logros" aria-hidden="true">
                        <span style={{ '--p': logros }} />
                      </span>
                    )}
                  </span>
                  <span className="cartucho__cuerpo">
                    <span className="cartucho__nombre">{g.name}</span>
                    <span className="cartucho__estado">
                      <span className={`punto punto--${g.status}`} aria-hidden="true" />
                      {t(`estado.${g.status}`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default BibliotecaAjena

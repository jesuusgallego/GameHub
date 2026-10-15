import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { ESTADOS } from './estados'
import { useIdioma } from './IdiomaContext'

// La biblioteca de otra persona (solo la ve quien ella deja). Filtros por estado y por
// "en común" (los juegos que yo también tengo, con mi nota al lado para compararnos).
//  - username: de quién es
//  - cerrarSesion(): para un 401
function BibliotecaAjena({ username, cerrarSesion }) {
  const { t } = useIdioma()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [estado, setEstado] = useState("todos")
  const [soloComun, setSoloComun] = useState(false)

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
  }, [username, cerrarSesion])

  if (error) return <Mensaje texto={error} />
  if (!datos) return <Cargando texto={t('ajena.cargando')} centrado />

  const { games, reviews_visible: verResenas } = datos
  const enComun = games.filter((g) => g.in_common).length
  const porEstado = (id) => games.filter((g) => g.status === id).length

  const visibles = games.filter(
    (g) => (estado === "todos" || g.status === estado) && (!soloComun || g.in_common)
  )

  if (games.length === 0) return <p className="estado">{t('stats.vacioOtro')}</p>

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
        <p className="estado">{t('ajena.sinResultados')}</p>
      ) : (
        <ul className="juegos-ajenos">
          {visibles.map((g, i) => (
            <li key={g.igdb_id} className="juego-ajeno" style={{ '--orden': Math.min(i, 14) }}>
              <div className="juego-ajeno__portada">
                {g.cover_url ? <img src={g.cover_url} alt="" loading="lazy" /> : <span>{t('comun.sinPortada')}</span>}
                {g.rating != null && <span className="juego-ajeno__nota">{g.rating}<small>/10</small></span>}
              </div>
              <div className="juego-ajeno__cuerpo">
                <h4 className="juego-ajeno__nombre">{g.name}</h4>
                <span className="juego-ajeno__estado">
                  <span className={`punto punto--${g.status}`} aria-hidden="true" />
                  {t(`estado.${g.status}`)}
                </span>
                {g.in_common && (
                  <span className="juego-ajeno__comun">
                    {t('ajena.tu', { nota: g.my_rating ?? "–" })}
                  </span>
                )}
                {g.review && <p className="juego-ajeno__resena">{g.review}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BibliotecaAjena

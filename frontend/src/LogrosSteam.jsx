import { useState, useEffect, useId } from 'react'
import { apiFetch } from './api'
import { useIdioma } from './IdiomaContext'
import Cargando from './Cargando'
import Mensaje from './Mensaje'

// Lista de logros de Steam de un juego de mi biblioteca, recogida en un desplegable:
// un botón "Ver logros" la abre y la cierra con animación. Dentro, icono, nombre,
// descripción y, si ya lo tengo, el día en que lo conseguí. Primero salen los
// desbloqueados (el más reciente arriba) y luego los pendientes, con el icono en gris.
//  - juego: la fila de user_games (necesito su "id" para pedir los logros al backend)
//  - ruta: la dirección de la API de los logros, sin el idioma. Sin ella, los de MI juego
//    (/accounts/steam/games/:id/achievements); con ella, por ejemplo los de un amigo
//    (/users/:usuario/games/:igdbId/achievements)
//
// Los logros NO se piden a Steam hasta que se abre el desplegable por primera vez:
// la mayoría de las veces que se abre una ficha no se miran, y así nos ahorramos dos
// llamadas a Steam por ficha. Una vez abierto, el contenido se queda montado aunque se
// cierre: así el cierre puede animarse (si se desmontara de golpe no habría qué plegar).
function LogrosSteam({ juego, ruta }) {
  const { t } = useIdioma()
  const idPanel = useId()
  const [abierto, setAbierto] = useState(false)
  const [visto, setVisto] = useState(false)

  function alternar() {
    setAbierto(!abierto)
    setVisto(true)
  }

  return (
    <div className="logros-desplegable">
      <button
        type="button"
        className="btn btn--secundario logros-desplegable__boton"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={alternar}
      >
        {/* Copa de trofeo */}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8.5 20h7" />
        </svg>
        {abierto ? t('logros.ocultar') : t('logros.ver')}
        <svg className="btn__flecha" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Panel que se despliega: ver progreso-steam.css */}
      <div id={idPanel} className={abierto ? "logros-panel logros-panel--abierto" : "logros-panel"}>
        <div className="logros-panel__interior">
          {visto && <ListaLogros ruta={ruta ?? `/accounts/steam/games/${juego.id}/achievements`} />}
        </div>
      </div>
    </div>
  )
}

// La lista en sí: pide los logros al montarse y los pinta. Si cambio de idioma con la
// ficha abierta se vuelve a pedir, porque Steam traduce los nombres y las descripciones.
function ListaLogros({ ruta }) {
  const { t, idioma, locale } = useIdioma()
  const [logros, setLogros] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false

    apiFetch(`${ruta}?lang=${idioma}`)
      .then((data) => {
        if (!cancelado) setLogros(ordenar(data.achievements))
      })
      .catch((err) => {
        if (!cancelado) setError(err.message)
      })

    // Si se cierra la ficha antes de que llegue la respuesta, la ignoro
    return () => { cancelado = true }
  }, [ruta, idioma])

  function formatearFecha(segundos) {
    return new Date(segundos * 1000).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // El hueco mínimo reserva sitio para la lista: así, al llegar los datos, el panel
  // no pega un salto grande de golpe
  if (!logros && !error) {
    return (
      <div className="logros-cargando">
        <Cargando texto={t('logros.cargando')} />
      </div>
    )
  }

  return (
    <>
      <Mensaje texto={error} />

      {logros?.length === 0 && <p className="estado">{t('logros.vacio')}</p>}

      {logros?.length > 0 && (
        <ul className="logros">
          {logros.map((logro) => {
            // Un logro oculto no cuenta qué hay que hacer hasta que lo consigues
            const descripcion = logro.oculto && !logro.desbloqueado
              ? t('logros.oculto')
              : logro.descripcion

            return (
              <li
                key={logro.id}
                className={logro.desbloqueado ? "logro logro--desbloqueado" : "logro"}
              >
                {logro.icono
                  ? <img className="logro__icono" src={logro.icono} alt="" loading="lazy" />
                  : <span className="logro__icono" aria-hidden="true" />}

                <div className="logro__texto">
                  <p className="logro__nombre">{logro.nombre}</p>
                  {descripcion && <p className="logro__descripcion">{descripcion}</p>}
                </div>

                <span className="logro__estado">
                  {logro.desbloqueado
                    ? (logro.fecha ? formatearFecha(logro.fecha) : t('logros.desbloqueado'))
                    : t('logros.pendiente')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// Desbloqueados primero y, entre ellos, el más reciente arriba. Los pendientes
// conservan el orden que da Steam. sort() es estable: lo que "empata" no se mueve.
function ordenar(logros) {
  return [...logros].sort((a, b) => {
    if (a.desbloqueado !== b.desbloqueado) return a.desbloqueado ? -1 : 1
    return (b.fecha ?? 0) - (a.fecha ?? 0)
  })
}

export default LogrosSteam

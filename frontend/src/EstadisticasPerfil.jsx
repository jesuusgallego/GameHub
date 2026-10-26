import { Link } from 'react-router-dom'
import { ESTADOS } from './estados'
import { useIdioma } from './IdiomaContext'

// Resumen de la biblioteca del usuario (las tres cifras grandes viven en el banner,
// CabeceraPerfil). Recibe lo que calcula GET /profile/stats:
//  - stats: { total, jugando, completado, abandonado, pendiente, valorados, nota_media }
//  - mejores: sus juegos mejor valorados (hasta 5)
//  - soloLectura: es el perfil de otra persona; no ofrece añadir juegos
function EstadisticasPerfil({ stats, mejores, soloLectura = false }) {
  const { t } = useIdioma()

  if (stats.total === 0) {
    return (
      <div className="estado-vacio">
        <p>{soloLectura ? t('stats.vacioOtro') : t('stats.vacio')}</p>
        {!soloLectura && <Link to="/buscar" className="btn btn--primario">{t('biblioteca.anadirJuegos')}</Link>}
      </div>
    )
  }

  return (
    <div className="estadisticas">
      <div>
        <h3 className="estadisticas__subtitulo">{t('stats.porEstado')}</h3>
        {/* Barra dividida en tramos: cada uno crece según cuántos juegos tiene
            (flex-grow). Los estados con 0 juegos no se pintan. */}
        <div className="barra-estados" aria-hidden="true">
          {ESTADOS
            .filter((id) => stats[id] > 0)
            .map((id) => (
              <span
                key={id}
                className={`barra-estados__tramo punto--${id}`}
                style={{ flexGrow: stats[id] }}
              />
            ))}
        </div>
        <ul className="leyenda">
          {ESTADOS.map((id) => (
            <li key={id} className="leyenda__item">
              <span className={`punto punto--${id}`} aria-hidden="true" />
              {t(`estado.${id}`)}
              <strong>{stats[id]}</strong>
            </li>
          ))}
        </ul>
      </div>

      {mejores.length > 0 && (
        <div>
          <h3 className="estadisticas__subtitulo">{t('stats.mejores')}</h3>
          <ol className="mejores">
            {mejores.map((juego) => (
              <li key={juego.id} className="mejores__item">
                <span className="mejores__portada">
                  {juego.cover_url && <img src={juego.cover_url} alt="" loading="lazy" />}
                </span>
                <span className="mejores__nombre">{juego.name}</span>
                <span className="mejores__nota">{juego.rating}<small>/10</small></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default EstadisticasPerfil

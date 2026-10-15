import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import { useIdioma } from './IdiomaContext'
import { tiempoRelativo } from './tiempo'

// Lo que hacen tus amigos: arriba, quién está jugando ahora y a qué; debajo, sus últimos
// movimientos en la biblioteca (añadir un juego, empezarlo, completarlo...). Solo salen
// los amigos que dejan ver su biblioteca.
//  - amigos: GET /friends (cada uno trae `playing`)
//  - actividad: GET /friends/activity
//  - onIrADescubrir(): botón del estado vacío
function Actividad({ amigos, actividad, onIrADescubrir }) {
  const { t, idioma } = useIdioma()
  const jugando = amigos.filter((a) => a.playing)

  if (amigos.length === 0) {
    return (
      <div className="estado-vacio">
        <p>{t('social.actividad.sinAmigos')}</p>
        <button type="button" className="btn btn--primario" onClick={onIrADescubrir}>
          {t('social.irDescubrir')}
        </button>
      </div>
    )
  }

  return (
    <div className="actividad">
      <section>
        <h3 className="estadisticas__subtitulo">{t('social.actividad.jugandoAhora')}</h3>
        {jugando.length === 0 ? (
          <p className="estado">{t('social.actividad.nadieJuega')}</p>
        ) : (
          <ul className="jugando-ahora">
            {jugando.map((amigo, i) => (
              <li key={amigo.username} style={{ '--orden': Math.min(i, 10) }}>
                <Link to={`/usuarios/${amigo.username}`} className="jugando-ahora__tarjeta">
                  <span className="jugando-ahora__portada">
                    {amigo.playing.cover_url && <img src={amigo.playing.cover_url} alt="" loading="lazy" />}
                  </span>
                  <span className="jugando-ahora__texto">
                    <span className="jugando-ahora__juego">{amigo.playing.name}</span>
                    <span className="jugando-ahora__persona">
                      <Avatar usuario={amigo} tamano="pequeno" /> {amigo.username}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="estadisticas__subtitulo">{t('social.actividad.movimientos')}</h3>
        {actividad.length === 0 ? (
          <p className="estado">{t('social.actividad.sinMovimientos')}</p>
        ) : (
          <ol className="movimientos">
            {actividad.map((m, i) => (
              <li key={`${m.username}-${m.igdb_id}`} className="movimiento" style={{ '--orden': Math.min(i, 12) }}>
                <Link to={`/usuarios/${m.username}`} aria-hidden="true" tabIndex={-1}>
                  <Avatar usuario={m} />
                </Link>
                <div className="movimiento__texto">
                  <p>
                    <Link to={`/usuarios/${m.username}`} className="movimiento__persona">{m.username}</Link>
                    {' '}{t(`social.actividad.verbo.${m.status}`)}{' '}
                    <strong>{m.name}</strong>
                    {m.rating != null && <span className="movimiento__nota"> · {m.rating}/10</span>}
                  </p>
                  <small>{tiempoRelativo(m.updated_at, idioma)}</small>
                </div>
                {m.cover_url && <img className="movimiento__portada" src={m.cover_url} alt="" loading="lazy" />}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export default Actividad

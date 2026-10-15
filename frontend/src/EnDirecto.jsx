import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { tiempoRelativo } from './tiempo'

// "En directo": los amigos que tienen un juego en estado "jugando", cada uno en una
// tarjeta con la portada de ese juego de fondo. Pulsar lleva a su biblioteca, con la ficha
// de ese juego abierta.
//  - amigos: GET /friends (cada uno trae `playing` con igdb_id, name, cover_url y since)
function EnDirecto({ amigos }) {
  const { t, idioma } = useIdioma()
  const jugando = amigos.filter((a) => a.playing)

  return (
    <section className="directo" aria-labelledby="directo-titulo">
      <h3 id="directo-titulo" className="titulo-seccion sala-titulo">
        <span className="sala-titulo__punto" aria-hidden="true" />
        {t('social.actividad.jugandoAhora')}
        {jugando.length > 0 && <span className="sala-titulo__n">{jugando.length}</span>}
      </h3>

      {jugando.length === 0 ? (
        <p className="sala-vacio">{t('social.actividad.nadieJuega')}</p>
      ) : (
        <ul className="directo__lista">
          {jugando.map((amigo, i) => (
            <li key={amigo.username} style={{ ...estiloTono(amigo.username), '--orden': Math.min(i, 8) }}>
              <Link
                to={`/usuarios/${amigo.username}?tab=biblioteca&juego=${amigo.playing.igdb_id}`}
                className="directo__tarjeta"
              >
                <span className="directo__fondo" aria-hidden="true">
                  {amigo.playing.cover_url && <img src={amigo.playing.cover_url} alt="" loading="lazy" />}
                </span>
                <span className="directo__portada">
                  {amigo.playing.cover_url && <img src={amigo.playing.cover_url} alt="" loading="lazy" />}
                </span>
                <span className="directo__texto">
                  <span className="directo__juego">{amigo.playing.name}</span>
                  <span className="directo__persona">
                    <AvatarTono usuario={amigo} tamano="pequeno" vivo />
                    <span>
                      <strong>{amigo.username}</strong>
                      {amigo.playing.since && <small>{tiempoRelativo(amigo.playing.since, idioma)}</small>}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default EnDirecto

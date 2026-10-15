import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import EnDirecto from './EnDirecto'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { tiempoRelativo, tramoDia } from './tiempo'

const TRAMOS = ['hoy', 'ayer', 'semana', 'mes', 'antes']

// Lo que hacen tus amigos: arriba, quién está jugando ahora y a qué; debajo, una línea del
// tiempo con sus últimos movimientos en la biblioteca (añadir un juego, empezarlo,
// completarlo...) agrupados por día: hoy, ayer, esta semana... Solo salen los amigos que
// dejan ver su biblioteca.
//  - amigos: GET /friends (cada uno trae `playing`)
//  - actividad: GET /friends/activity (ya viene de lo más reciente a lo más antiguo)
//  - onIrADescubrir(): botón del estado vacío
function Actividad({ amigos, actividad, onIrADescubrir }) {
  const { t, idioma } = useIdioma()

  if (amigos.length === 0) {
    return (
      <div className="sala-vacia">
        <span className="sala-vacia__icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 7v6M14 10h6" />
          </svg>
        </span>
        <p>{t('social.actividad.sinAmigos')}</p>
        <button type="button" className="btn btn--primario" onClick={onIrADescubrir}>
          {t('social.irDescubrir')}
        </button>
      </div>
    )
  }

  // Los movimientos agrupados por tramo, conservando el orden
  const grupos = TRAMOS
    .map((tramo) => ({ tramo, items: actividad.filter((m) => tramoDia(m.updated_at) === tramo) }))
    .filter((g) => g.items.length > 0)

  let orden = 0

  return (
    <div className="actividad">
      <EnDirecto amigos={amigos} />

      <section aria-labelledby="movimientos-titulo">
        <h3 id="movimientos-titulo" className="sala-titulo">{t('social.actividad.movimientos')}</h3>

        {actividad.length === 0 ? (
          <p className="sala-vacio">{t('social.actividad.sinMovimientos')}</p>
        ) : (
          <div className="linea">
            {grupos.map(({ tramo, items }) => (
              <div key={tramo} className="linea__dia">
                <h4 className="linea__titulo">{t(`social.tramo.${tramo}`)}</h4>
                <ol className="movimientos">
                  {items.map((m) => (
                    <li
                      key={`${m.username}-${m.igdb_id}`}
                      className="movimiento"
                      style={{ ...estiloTono(m.username), '--orden': Math.min(orden++, 12) }}
                    >
                      <Link to={`/usuarios/${m.username}`} className="movimiento__avatar" aria-hidden="true" tabIndex={-1}>
                        <AvatarTono usuario={m} tamano="normal" vivo={m.status === 'jugando' && tramo === 'hoy'} />
                      </Link>

                      <div className="movimiento__texto">
                        <p>
                          <Link to={`/usuarios/${m.username}`} className="movimiento__persona">{m.username}</Link>
                          {' '}
                          <span className={`verbo verbo--${m.status}`}>{t(`social.actividad.verbo.${m.status}`)}</span>
                          {' '}
                          <strong>{m.name}</strong>
                        </p>
                        <small>
                          {tiempoRelativo(m.updated_at, idioma)}
                          {m.rating != null && <span className="movimiento__nota"> · ★ {m.rating}/10</span>}
                        </small>
                      </div>

                      {m.cover_url && (
                        <Link
                          to={`/usuarios/${m.username}?tab=biblioteca&juego=${m.igdb_id}`}
                          className="movimiento__portada"
                          aria-label={t('social.abrirFicha', { juego: m.name })}
                        >
                          <img src={m.cover_url} alt="" loading="lazy" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Actividad

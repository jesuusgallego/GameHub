import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'

// "Para jugar juntos": los juegos que tienen o están jugando varios de tus amigos, con cuántos
// y quiénes, y si tú ya lo tienes. Pulsar uno abre su ficha (desde ahí se puede añadir).
//  - juegos: GET /friends/games
//  - onAbrir(juego): abre la ficha
function ParaJugarJuntos({ juegos, onAbrir }) {
  const { t } = useIdioma()

  return (
    <section className="lateral__bloque" aria-labelledby="juntos-titulo">
      <h3 id="juntos-titulo" className="titulo-seccion lateral__titulo">{t('social.juntos')}</h3>
      <p className="lateral__ayuda">{t('social.juntosAyuda')}</p>

      {juegos.length === 0 ? (
        <p className="lateral__vacio">{t('social.juntosVacio')}</p>
      ) : (
        <ul className="juntos">
          {juegos.map((j) => (
            <li key={j.igdb_id}>
              <button type="button" className="juntos__fila" onClick={() => onAbrir(j)}
                aria-label={t('social.abrirFicha', { juego: j.name })}>
                <span className="juntos__portada">
                  {j.cover_url && <img src={j.cover_url} alt="" loading="lazy" />}
                </span>
                <span className="juntos__texto">
                  <strong>{j.name}</strong>
                  <small>
                    {j.friends_count === 1 ? t('social.juntosUno') : t('social.juntosN', { n: j.friends_count })}
                    {j.playing_count > 0 && ` · ${t('social.juntosJugando', { n: j.playing_count })}`}
                  </small>
                  <span className="juntos__pie">
                    <span className="avatares-apilados" aria-hidden="true">
                      {j.people.map((p) => <AvatarTono key={p.username} usuario={p} tamano="pequeno" />)}
                    </span>
                    {j.mine
                      ? <span className="juntos__tienes">✓ {t('social.loTienes')}</span>
                      : <span className="juntos__anadir">{t('social.noLoTienes')}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ParaJugarJuntos

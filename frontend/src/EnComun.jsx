import AvisoPrivado from './AvisoPrivado'
import RejillaPersonas from './RejillaPersonas'
import Cargando from './Cargando'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { juegoDeComun } from './juegoAjeno'

// Mejor que "completado / jugando": un resumen de cómo vais los dos en un juego
function veredicto(c) {
  if (c.my_status === 'completado' && c.their_status === 'completado') return 'ambosCompletado'
  if (c.my_status === 'jugando' && c.their_status === 'jugando') return 'ambosJugando'
  return null
}

// Pestaña "En común" del perfil de otra persona: los juegos que tenéis los dos (cada uno como
// un duelo: el estado y la nota de cada lado, y sus logros) y los amigos que compartís.
//  - nombre: el nombre de usuario de esa persona
//  - comun: GET /users/:u/common, o null mientras carga
//  - motivoPrivado: por qué no se ve su biblioteca (texto), si es el caso
//  - onAbrirJuego(fila): abre la ficha del juego (la fila ya con la forma de su biblioteca)
//  - onCambio(persona) / cerrarSesion(): para los botones de los amigos
function EnComun({ nombre, comun, motivoPrivado, onAbrirJuego, onCambio, cerrarSesion }) {
  const { t } = useIdioma()

  if (!comun) return <Cargando texto={t('comun.cargando')} centrado />

  const juegos = comun.games
  // Vuestro favorito: la mayor suma de notas entre los juegos que los dos habéis valorado.
  // Con un solo juego en común no tiene gracia: solo se destaca si hay donde elegir.
  let favorito = null
  if (juegos && juegos.length > 1) {
    const valorados = juegos.filter((c) => c.my_rating != null && c.their_rating != null)
    favorito = valorados.reduce(
      (mejor, c) => (!mejor || c.my_rating + c.their_rating > mejor.my_rating + mejor.their_rating ? c : mejor),
      null
    )?.igdb_id ?? null
  }

  return (
    <div className="en-comun">
      <section aria-labelledby="comun-juegos">
        <h3 id="comun-juegos" className="sala-titulo">
          {t('comun.juegosTitulo')}
          {juegos && juegos.length > 0 && <span className="sala-titulo__n">{juegos.length}</span>}
        </h3>

        {juegos === null ? (
          <AvisoPrivado texto={motivoPrivado} />
        ) : juegos.length === 0 ? (
          <p className="sala-vacio">{t('comun.sinJuegos', { usuario: nombre })}</p>
        ) : (
          <ul className="duelos">
            {juegos.map((c, i) => {
              const v = veredicto(c)
              const hayLogros = c.my_achievements_total > 0 && c.their_achievements_total > 0
              return (
                <li key={c.igdb_id} className="duelo" style={{ '--orden': Math.min(i, 10), ...estiloTono(nombre) }}>
                  <button type="button" className="duelo__abrir" onClick={() => onAbrirJuego(juegoDeComun(c))}
                    aria-label={t('social.abrirFicha', { juego: c.name })}>
                    <span className="duelo__portada">
                      {c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : <span>{t('comun.sinPortada')}</span>}
                    </span>

                    <span className="duelo__cuerpo">
                      <span className="duelo__nombre">
                        {c.name}
                        {favorito === c.igdb_id && <span className="duelo__favorito">★ {t('comun.favorito')}</span>}
                      </span>

                      <span className="duelo__lados">
                        <span className="duelo__lado duelo__lado--yo">
                          <small>{t('cara.tu')}</small>
                          <span className={`chip chip--${c.my_status}`}>{t(`estado.${c.my_status}`)}</span>
                          <b>{c.my_rating != null ? `${c.my_rating}/10` : '—'}</b>
                        </span>
                        <span className="duelo__lado duelo__lado--otro">
                          <small>{nombre}</small>
                          <span className={`chip chip--${c.their_status}`}>{t(`estado.${c.their_status}`)}</span>
                          <b>{c.their_rating != null ? `${c.their_rating}/10` : '—'}</b>
                        </span>
                      </span>

                      {(hayLogros || v) && (
                        <span className="duelo__pie">
                          {v && <span className="duelo__veredicto">{t(`comun.veredicto.${v}`)}</span>}
                          {hayLogros && (
                            <span className="duelo__logros">
                              {t('comun.logros', {
                                nombre,
                                yo: `${c.my_achievements_unlocked}/${c.my_achievements_total}`,
                                otro: `${c.their_achievements_unlocked}/${c.their_achievements_total}`,
                              })}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="comun-amigos">
        <h3 id="comun-amigos" className="sala-titulo">
          {t('comun.amigosTitulo')}
          {comun.friends.length > 0 && <span className="sala-titulo__n">{comun.friends.length}</span>}
        </h3>

        {comun.friends.length === 0 ? (
          <p className="sala-vacio">{t('comun.sinAmigos', { usuario: nombre })}</p>
        ) : (
          <RejillaPersonas personas={comun.friends} onCambio={onCambio} cerrarSesion={cerrarSesion} />
        )}
      </section>
    </div>
  )
}

export default EnComun

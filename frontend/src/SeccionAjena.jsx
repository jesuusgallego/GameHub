import AvatarTono from './AvatarTono'
import IconoPlataforma from './IconoPlataforma'
import IconoSteam from './IconoSteam'
import ProgresoSteam from './ProgresoSteam'
import LogrosSteam from './LogrosSteam'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { miProgreso } from './juegoAjeno'

// Lo que la ficha de un juego cuenta de la partida de OTRA persona: su estado, su nota, su
// reseña, sus horas y sus logros de Steam (la lista, en un desplegable) y, si el juego lo
// tenemos los dos, mi parte al lado para compararnos.
//  - usuario: { username, has_avatar }
//  - juego: la fila de su biblioteca (status, rating, platform, review, has_review,
//    playtime_minutes, achievements_*, in_common y my_*)
//  - logrosVisibles: si deja ver sus horas y logros
//  - resenasVisibles: si deja ver el texto de sus reseñas
function SeccionAjena({ usuario, juego, logrosVisibles, resenasVisibles }) {
  const { t } = useIdioma()
  const nombre = usuario.username
  const hayLogros = logrosVisibles && juego.achievements_total > 0
  const traeSteam = juego.playtime_minutes !== null && juego.playtime_minutes !== undefined

  return (
    <section className="ficha-ajena" style={estiloTono(nombre)} aria-labelledby="ficha-ajena-titulo">
      <header className="ficha-ajena__cabecera">
        <AvatarTono usuario={usuario} tamano="normal" />
        <div>
          <h3 id="ficha-ajena-titulo" className="titulo-seccion">{t('ficha.enBiblioteca', { usuario: nombre })}</h3>
        </div>
      </header>

      <div className="ficha-ajena__datos">
        <span className={`chip chip--${juego.status}`}>{t(`estado.${juego.status}`)}</span>
        {juego.rating != null && <span className="contador">★ {juego.rating}/10</span>}
        {juego.platform && (
          <span className="detalle__plataforma">
            <IconoPlataforma nombre={juego.platform} tamano={16} decorativo />
            {juego.platform}
          </span>
        )}
      </div>

      {juego.review
        ? <p className="detalle__texto detalle__resena">{juego.review}</p>
        : juego.has_review && !resenasVisibles
          ? <p className="estado">{t('ficha.resenaOculta', { usuario: nombre })}</p>
          : <p className="estado">{t('ficha.sinResena', { usuario: nombre })}</p>}

      {traeSteam && logrosVisibles && (
        <div className="detalle__steam">
          <h4 className="detalle__subtitulo">
            <IconoSteam tamano={14} />
            {t('progreso.titulo')}
          </h4>
          <ProgresoSteam juego={juego} grande />
          {hayLogros && (
            <LogrosSteam
              juego={{ id: juego.igdb_id }}
              ruta={`/users/${encodeURIComponent(nombre)}/games/${juego.igdb_id}/achievements`}
            />
          )}
        </div>
      )}

      {!logrosVisibles && (
        <p className="privacidad__ayuda">{t('ficha.logrosOcultos', { usuario: nombre })}</p>
      )}

      {juego.in_common && (
        <div className="ficha-ajena__tu">
          <h4 className="detalle__subtitulo">{t('ficha.tuPartida')}</h4>
          <div className="ficha-ajena__datos">
            <span className={`chip chip--${juego.my_status}`}>{t(`estado.${juego.my_status}`)}</span>
            {juego.my_rating != null && <span className="contador">★ {juego.my_rating}/10</span>}
          </div>
          {juego.my_playtime_minutes != null && <ProgresoSteam juego={miProgreso(juego)} grande />}
        </div>
      )}
    </section>
  )
}

export default SeccionAjena

import { Link, useOutletContext } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import AccionAmistad from './AccionAmistad'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { tiempoRelativo } from './tiempo'

// Una persona como un carnet de jugador: arriba una banda (con la portada de lo que juega
// ahora, o con su color si no juega a nada), su foto en un anillo del color de su nombre,
// tres cifras de su biblioteca y lo que tenéis en común. Debajo, los botones de la amistad.
//  - persona: { username, has_avatar, bio, relation, friendship_id, can_request,
//    playing?: { name, cover_url, since }, games_count?, completed_count?, avg_rating?,
//    games_in_common?, mutual? }
//  - orden: posición en la rejilla; escalona la animación de entrada
//  - onCambio(persona) / cerrarSesion(): como en AccionAmistad
function Carnet({ persona, orden = 0, onCambio, cerrarSesion }) {
  const { t, idioma, locale } = useIdioma()
  const { abrirChat } = useOutletContext()
  const {
    username, bio, playing, games_count: juegos, completed_count: completados,
    avg_rating: nota, games_in_common: juegosComun, mutual,
  } = persona
  const esAmigo = persona.relation === 'amigos'
  const cifras = typeof juegos === 'number' && juegos > 0

  const comun = []
  if (typeof juegosComun === 'number' && juegosComun > 0) {
    comun.push(
      <li key="juegos" className="carnet__comun">
        {juegosComun === 1 ? t('carnet.juegoComunUno') : t('carnet.juegosComun', { n: juegosComun })}
      </li>
    )
  }
  if (typeof mutual === 'number' && mutual > 0) {
    comun.push(
      <li key="amigos" className="carnet__comun">
        {mutual === 1 ? t('carnet.amigoComunUno') : t('carnet.amigosComun', { n: mutual })}
      </li>
    )
  }
  if (persona.relation === 'self') {
    comun.push(<li key="yo" className="carnet__comun">{t('persona.eresTu')}</li>)
  }

  return (
    <li
      className={playing ? "carnet carnet--jugando" : "carnet"}
      style={{ ...estiloTono(username), '--orden': Math.min(orden, 12) }}
    >
      <Link to={`/usuarios/${username}`} className="carnet__banda" aria-label={t('carnet.verPerfil', { usuario: username })}>
        {playing?.cover_url && <img className="carnet__fondo" src={playing.cover_url} alt="" loading="lazy" />}
        {playing && (
          <span className="carnet__jugando">
            <span className="carnet__pulso" aria-hidden="true" />
            <span className="carnet__juego">{playing.name}</span>
            {playing.since && <small>{tiempoRelativo(playing.since, idioma)}</small>}
          </span>
        )}
      </Link>

      <div className="carnet__cuerpo">
        <Link to={`/usuarios/${username}`} className="carnet__identidad">
          <AvatarTono usuario={persona} tamano="grande" vivo={Boolean(playing)} />
          <span className="carnet__nombre">{username}</span>
        </Link>

        {bio && <p className="carnet__bio">{bio}</p>}

        {cifras && (
          <dl className="carnet__cifras">
            <div><dd>{juegos}</dd><dt>{t('carnet.juegos')}</dt></div>
            <div><dd>{completados ?? 0}</dd><dt>{t('carnet.completados')}</dt></div>
            <div><dd>{nota != null ? nota.toLocaleString(locale, { minimumFractionDigits: 1 }) : "—"}</dd><dt>{t('carnet.nota')}</dt></div>
          </dl>
        )}

        {comun.length > 0 && <ul className="carnet__comunes">{comun}</ul>}
      </div>

      <div className="carnet__acciones">
        {esAmigo && (
          <>
            <button type="button" className="btn btn--primario" onClick={() => abrirChat(username)}>{t('chat.mensaje')}</button>
            <Link to={`/usuarios/${username}`} className="btn btn--secundario">{t('carnet.ver')}</Link>
          </>
        )}
        <AccionAmistad persona={persona} onCambio={onCambio} cerrarSesion={cerrarSesion} discreta={esAmigo} />
      </div>
    </li>
  )
}

export default Carnet

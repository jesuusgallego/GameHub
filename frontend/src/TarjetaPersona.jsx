import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import AccionAmistad from './AccionAmistad'
import { useIdioma } from './IdiomaContext'

// Una persona como tarjeta: foto, nombre (enlace a su perfil), descripción, algún dato
// (a qué juega, cuántos juegos tiene, amigos en común) y los botones de la amistad.
//  - persona: { username, has_avatar, bio, relation, friendship_id, can_request,
//    playing?, games_count?, mutual? }
//  - orden: posición en la rejilla; escalona la animación de entrada
//  - onCambio(persona) / cerrarSesion(): como en AccionAmistad
function TarjetaPersona({ persona, orden = 0, onCambio, cerrarSesion }) {
  const { t } = useIdioma()
  const { username, bio, playing, games_count: juegos, mutual } = persona

  const datos = []
  if (playing) {
    datos.push(
      <li key="jugando" className="dato-persona dato-persona--jugando">
        {playing.cover_url && <img src={playing.cover_url} alt="" loading="lazy" />}
        <span>{t('persona.jugando', { juego: playing.name })}</span>
      </li>
    )
  }
  if (typeof juegos === 'number') {
    datos.push(<li key="juegos" className="dato-persona">{juegos === 1 ? t('persona.juegosUno') : t('persona.juegos', { n: juegos })}</li>)
  }
  if (persona.relation === 'self') {
    datos.push(<li key="yo" className="dato-persona dato-persona--comun">{t('persona.eresTu')}</li>)
  }
  if (typeof mutual === 'number' && mutual > 0) {
    datos.push(<li key="comun" className="dato-persona dato-persona--comun">{mutual === 1 ? t('persona.enComunUno') : t('persona.enComun', { n: mutual })}</li>)
  }

  return (
    <li className="tarjeta-persona" style={{ '--orden': Math.min(orden, 12) }}>
      <Link to={`/usuarios/${username}`} className="tarjeta-persona__cabecera">
        <Avatar usuario={persona} tamano="grande" />
        <span className="tarjeta-persona__nombre">{username}</span>
      </Link>

      {bio && <p className="tarjeta-persona__bio">{bio}</p>}
      {datos.length > 0 && <ul className="tarjeta-persona__datos">{datos}</ul>}

      <div className="tarjeta-persona__acciones">
        <AccionAmistad persona={persona} onCambio={onCambio} cerrarSesion={cerrarSesion} />
      </div>
    </li>
  )
}

export default TarjetaPersona

import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import AccionAmistad from './AccionAmistad'
import { estiloTono } from './tono'

// Una persona en una fila compacta: foto, nombre y los botones de la amistad. Para listas
// donde la persona importa poco (las solicitudes que envié, los bloqueados).
//  - persona / onCambio / cerrarSesion: como en Carnet
//  - orden: escalona la animación de entrada
function FilaPersona({ persona, orden = 0, onCambio, cerrarSesion }) {
  return (
    <li className="fila-persona" style={{ ...estiloTono(persona.username), '--orden': Math.min(orden, 10) }}>
      <Link to={`/usuarios/${persona.username}`} className="fila-persona__identidad">
        <AvatarTono usuario={persona} tamano="normal" />
        <span className="fila-persona__texto">
          <strong>{persona.username}</strong>
          {persona.bio && <small>{persona.bio}</small>}
        </span>
      </Link>
      <AccionAmistad persona={persona} onCambio={onCambio} cerrarSesion={cerrarSesion} />
    </li>
  )
}

export default FilaPersona

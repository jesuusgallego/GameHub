import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import AccionAmistad from './AccionAmistad'

// Una lista de personas: foto, nombre (enlace a su perfil) y los botones de la relación.
//  - personas: [{ username, has_avatar, bio, relation, friendship_id }]
//  - onCambio(persona): una acción terminó; el padre actualiza o recarga
//  - cerrarSesion(): para un 401
function ListaPersonas({ personas, onCambio, cerrarSesion }) {
  return (
    <ul className="personas">
      {personas.map((persona) => (
        <li key={persona.username} className="persona">
          <Link to={`/usuarios/${persona.username}`} className="persona__enlace">
            <Avatar usuario={persona} />
            <span className="persona__texto">
              <strong>{persona.username}</strong>
              {persona.bio && <small>{persona.bio}</small>}
            </span>
          </Link>
          <AccionAmistad persona={persona} onCambio={onCambio} cerrarSesion={cerrarSesion} />
        </li>
      ))}
    </ul>
  )
}

export default ListaPersonas

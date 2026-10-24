import Avatar from './Avatar'
import { estiloTono } from './tono'

// La "foto" de un grupo: las caras de hasta tres de sus miembros juntas dentro de un anillo con
// el color del grupo (el tono sale de su nombre, como el de una persona sale del suyo). Si no
// queda nadie más que tú, la inicial del grupo.
//  - nombre: el nombre del grupo
//  - miembros: [{ username, has_avatar }] sin mí (el servidor manda hasta tres en la lista)
//  - tamano: "normal" (lista y cabecera) o "grande" (inicio de la conversación)
function AvatarGrupo({ nombre, miembros = [], tamano = 'normal' }) {
  const caras = miembros.slice(0, 3)
  return (
    <span
      className={`avatar-grupo avatar-grupo--${tamano} avatar-grupo--${Math.max(caras.length, 1)}`}
      style={estiloTono(nombre)}
      aria-hidden="true"
    >
      {caras.length === 0 ? (
        <span className="avatar-grupo__inicial">{nombre.trim().charAt(0).toUpperCase()}</span>
      ) : (
        caras.map((persona, i) => (
          <span key={persona.username} className="avatar-grupo__cara" style={{ ...estiloTono(persona.username), '--i': i }}>
            <Avatar usuario={persona} tamano="pequeno" />
          </span>
        ))
      )}
    </span>
  )
}

export default AvatarGrupo

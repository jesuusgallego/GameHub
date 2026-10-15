import Avatar from './Avatar'
import { estiloTono } from './tono'

// La foto de una persona dentro de su anillo de color (el tono que sale de su nombre, ver
// tono.js). Con `vivo`, el anillo late: está jugando ahora.
//  - usuario: { username, has_avatar | avatar }
//  - tamano: el de Avatar ("pequeno", "normal", "grande", "enorme")
function AvatarTono({ usuario, tamano = "normal", vivo = false }) {
  return (
    <span
      className={`anillo anillo--${tamano}${vivo ? " anillo--vivo" : ""}`}
      style={estiloTono(usuario.username)}
    >
      <Avatar usuario={usuario} tamano={tamano} />
    </span>
  )
}

export default AvatarTono

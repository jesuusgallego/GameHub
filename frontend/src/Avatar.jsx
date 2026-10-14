import { urlAvatar } from './api'

// Foto de perfil redonda. Si el usuario no ha subido ninguna, pinto un círculo
// con el degradado de la marca y la inicial de su nombre.
//  - usuario: objeto con { username, avatar | has_avatar }; puede ser null mientras carga
//  - tamano: "pequeno" (barra), "normal" o "grande" (cabecera del perfil)
// El nombre no hace falta como alt: siempre aparece escrito al lado.
// La foto puede venir dentro del objeto (`avatar`, la de mi perfil) o, en las listas de
// personas, solo como aviso de que existe (`has_avatar`): entonces la pido por su dirección.
function Avatar({ usuario, tamano = "normal" }) {
  const inicial = usuario?.username?.trim().charAt(0).toUpperCase() ?? ""
  const foto = usuario?.avatar ?? (usuario?.has_avatar ? urlAvatar(usuario.username) : null)

  return (
    <span className={`avatar avatar--${tamano}`} aria-hidden="true">
      {foto ? <img src={foto} alt="" /> : inicial}
    </span>
  )
}

export default Avatar

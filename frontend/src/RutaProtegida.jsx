import PideCuenta from './PideCuenta'

// Las páginas que solo tienen sentido con una cuenta (Mi biblioteca, Social, Perfil y los perfiles
// de otras personas). Sin sesión no se sale de la app al login: en su lugar se queda la barra y se
// enseña una invitación a entrar o registrarse (PideCuenta), que explica qué hay en esa sección.
//  - seccion: 'biblioteca' | 'social' | 'perfil' | 'usuarios' (los textos de la invitación)
function RutaProtegida({ token, seccion, children }) {
  if (!token) return <PideCuenta seccion={seccion} />
  return children
}

export default RutaProtegida

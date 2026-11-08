import { Link } from 'react-router-dom'
import { useIdioma } from './IdiomaContext'

// "Seguir sin cuenta", debajo del login y del registro: vuelve a la app sin entrar, a la página de la
// que venías (o a las noticias)
//  - desde: la ruta a la que volver (ya comprobada con rutaDeVuelta, ver invitado.js)
function SeguirSinCuenta({ desde }) {
  const { t } = useIdioma()
  return (
    <Link to={desde} className="auth__invitado">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {t('invitado.seguirSinCuenta')}
    </Link>
  )
}

export default SeguirSinCuenta

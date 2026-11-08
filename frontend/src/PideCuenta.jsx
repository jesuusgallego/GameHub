import { Link, useLocation } from 'react-router-dom'
import FondoCabecera from './FondoCabecera'
import IconoSteam from './IconoSteam'
import { useIdioma } from './IdiomaContext'

// Lo que se enseña en una página que necesita cuenta (Mi biblioteca, Social, Perfil, el perfil de
// otra persona) cuando se entra sin sesión. En vez de mandar al login, la barra se queda y la página
// cuenta qué hay ahí y qué ganas al crear una cuenta, con los dos botones a mano. Así quien solo
// venía a leer noticias o buscar un juego sabe que puede seguir haciéndolo sin registrarse.
// Los botones llevan a /registro y /login con `state.desde`: al entrar, se vuelve a esta página.
//  - seccion: 'biblioteca' | 'social' | 'perfil' | 'usuarios'

// Cada sección: el fondo de su cabecera (FondoCabecera) y las tres ventajas que se enseñan
const SECCIONES = {
  biblioteca: { fondo: 'biblioteca', ventajas: ['guardar', 'progreso', 'steam'] },
  social: { fondo: 'sala', ventajas: ['amigos', 'chat', 'actividad'] },
  perfil: { fondo: 'sala', ventajas: ['guardar', 'amigos', 'paraTi'] },
  usuarios: { fondo: 'sala', ventajas: ['amigos', 'enComun', 'chat'] },
}

// Los iconos de las ventajas: trazos de 24x24 en el estilo de los de la barra
const ICONOS = {
  guardar: <><rect x="3" y="3" width="8" height="18" rx="1" /><path d="M7 3v18" /><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" /></>,
  progreso: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  amigos: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  actividad: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  paraTi: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z" />,
  enComun: <><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>,
}

function PideCuenta({ seccion }) {
  const { t } = useIdioma()
  const { pathname, search } = useLocation()
  const { fondo, ventajas } = SECCIONES[seccion] ?? SECCIONES.perfil
  // A dónde volver después de entrar o registrarse: esta misma página
  const estado = { desde: pathname + search }

  return (
    <div className="pide-cuenta">
      <header className="banner-perfil pide-cuenta__cabecera">
        <FondoCabecera estilo={fondo} />
        <div className="pide-cuenta__contenido">
          <span className="pide-cuenta__candado" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
          <h1 className="titulo-pagina">{t(`invitado.${seccion}.titulo`)}</h1>
          <p className="pide-cuenta__texto">{t(`invitado.${seccion}.texto`)}</p>
          <div className="pide-cuenta__acciones">
            <Link to="/registro" state={estado} className="btn btn--primario">{t('invitado.crearCuenta')}</Link>
            <Link to="/login" state={estado} className="btn btn--secundario">{t('invitado.iniciarSesion')}</Link>
          </div>
        </div>
      </header>

      <ul className="pide-cuenta__ventajas">
        {ventajas.map((v, i) => (
          <li key={v} className="pide-cuenta__ventaja" style={{ '--orden': i }}>
            <span className="pide-cuenta__icono" aria-hidden="true">
              {v === 'steam' ? <IconoSteam tamano={22} /> : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {ICONOS[v]}
                </svg>
              )}
            </span>
            <div>
              <h2>{t(`invitado.ventaja.${v}.titulo`)}</h2>
              <p>{t(`invitado.ventaja.${v}.texto`)}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Lo que sí se puede hacer sin cuenta */}
      <p className="pide-cuenta__sin-cuenta">
        {t('invitado.sinCuentaAntes')}{' '}
        <Link to="/noticias">{t('invitado.sinCuentaNoticias')}</Link>
        {t('invitado.sinCuentaY')}
        <Link to="/buscar">{t('invitado.sinCuentaBuscar')}</Link>
        {t('invitado.sinCuentaDespues')}
      </p>
    </div>
  )
}

export default PideCuenta

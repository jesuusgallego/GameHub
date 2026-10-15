import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import AccionAmistad from './AccionAmistad'
import FilaPersona from './FilaPersona'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'
import { tiempoRelativo } from './tiempo'

// Las solicitudes de amistad: las recibidas como invitaciones (una entrada con "Aceptar" y
// "Rechazar") y debajo, más discretas, las que he enviado y esperan respuesta.
//  - recibidas / enviadas: GET /friends/requests, con `relation` y `friendship_id` ya puestos
//  - onCambio(persona) / cerrarSesion(): como en AccionAmistad
function Invitaciones({ recibidas, enviadas, onCambio, cerrarSesion }) {
  const { t, idioma } = useIdioma()

  return (
    <div className="invitaciones">
      <section aria-labelledby="recibidas-titulo">
        <h3 id="recibidas-titulo" className="titulo-seccion sala-titulo">
          {t('social.recibidas')}
          {recibidas.length > 0 && <span className="sala-titulo__n">{recibidas.length}</span>}
        </h3>

        {recibidas.length === 0 ? (
          <p className="sala-vacio">{t('social.sinRecibidas')}</p>
        ) : (
          <ul className="entradas">
            {recibidas.map((p, i) => (
              <li key={p.username} className="entrada" style={{ ...estiloTono(p.username), '--orden': Math.min(i, 8) }}>
                <Link to={`/usuarios/${p.username}`} className="entrada__persona">
                  <AvatarTono usuario={p} tamano="grande" />
                  <span className="entrada__texto">
                    <strong>{p.username}</strong>
                    {p.bio && <span className="entrada__bio">{p.bio}</span>}
                    {p.created_at && <small>{tiempoRelativo(p.created_at, idioma)}</small>}
                  </span>
                </Link>
                <div className="entrada__acciones">
                  <AccionAmistad persona={p} onCambio={onCambio} cerrarSesion={cerrarSesion} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="enviadas-titulo">
        <h3 id="enviadas-titulo" className="estadisticas__subtitulo">{t('social.enviadas')}</h3>
        {enviadas.length === 0 ? (
          <p className="sala-vacio">{t('social.sinEnviadas')}</p>
        ) : (
          <ul className="filas">
            {enviadas.map((p, i) => (
              <FilaPersona key={p.username} persona={p} orden={i} onCambio={onCambio} cerrarSesion={cerrarSesion} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default Invitaciones

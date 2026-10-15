import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import AccionAmistad from './AccionAmistad'
import ParaJugarJuntos from './ParaJugarJuntos'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'

// La columna de al lado de la actividad: tres bloques, cada uno con una pregunta clara y la
// acción a mano.
//  - "Te han pedido ser amigo": las solicitudes pendientes, con Aceptar y Rechazar ahí mismo
//  - "Para jugar juntos": juegos que juegan o tienen varios de tus amigos
//  - "Quizá los conozcas": amigos de tus amigos, con "Añadir amigo" ahí mismo
//  - recibidas / sugerencias: personas con `relation` y `friendship_id` ya puestos
//  - juegos: GET /friends/games
//  - onAbrirJuego(juego): abre la ficha de un juego
//  - onCambio(persona) / cerrarSesion(): como en AccionAmistad
//  - irA(id): cambia de pestaña (el enlace "Ver todas" / "Descubrir más gente")
function LateralSala({ recibidas, sugerencias, juegos, onAbrirJuego, onCambio, cerrarSesion, irA }) {
  const { t } = useIdioma()

  return (
    <aside className="lateral" aria-label={t('social.lateral')}>
      {recibidas.length > 0 && (
        <section className="lateral__bloque lateral__bloque--invitacion" aria-labelledby="invitacion-titulo">
          <h3 id="invitacion-titulo" className="titulo-seccion lateral__titulo">{t('social.invitaciones')}</h3>
          <ul className="gente">
            {recibidas.slice(0, 3).map((p) => (
              <li key={p.username} className="gente__persona" style={estiloTono(p.username)}>
                <Link to={`/usuarios/${p.username}`} className="gente__identidad">
                  <AvatarTono usuario={p} tamano="pequeno" />
                  <strong>{p.username}</strong>
                </Link>
                <AccionAmistad persona={p} onCambio={onCambio} cerrarSesion={cerrarSesion} />
              </li>
            ))}
          </ul>
          {recibidas.length > 3 && (
            <button type="button" className="lateral__mas" onClick={() => irA('solicitudes')}>
              {t('social.verTodas', { n: recibidas.length })}
            </button>
          )}
        </section>
      )}

      <ParaJugarJuntos juegos={juegos} onAbrir={onAbrirJuego} />

      {sugerencias.length > 0 && (
        <section className="lateral__bloque" aria-labelledby="conozcas-titulo">
          <h3 id="conozcas-titulo" className="titulo-seccion lateral__titulo">{t('social.sugerencias')}</h3>
          <p className="lateral__ayuda">{t('social.sugerenciasAyuda')}</p>
          <ul className="gente">
            {sugerencias.slice(0, 3).map((p) => (
              <li key={p.username} className="gente__persona" style={estiloTono(p.username)}>
                <Link to={`/usuarios/${p.username}`} className="gente__identidad">
                  <AvatarTono usuario={p} tamano="pequeno" />
                  <span className="gente__texto">
                    <strong>{p.username}</strong>
                    <small>
                      {p.mutual === 1 ? t('carnet.amigoComunUno') : t('carnet.amigosComun', { n: p.mutual })}
                    </small>
                  </span>
                </Link>
                <AccionAmistad persona={p} onCambio={onCambio} cerrarSesion={cerrarSesion} />
              </li>
            ))}
          </ul>
          <button type="button" className="lateral__mas" onClick={() => irA('descubrir')}>
            {t('social.masGente')}
          </button>
        </section>
      )}
    </aside>
  )
}

export default LateralSala

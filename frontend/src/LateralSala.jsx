import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'

// La columna de al lado de la actividad: "Tu grupo" (los amigos, con un punto verde si están
// jugando), las invitaciones pendientes y a quién quizá conozcas. Cada bloque salta a su
// pestaña de Social.
//  - amigos, recibidas, sugerencias: lo que ya cargó Social
//  - irA(id): cambia de pestaña
function LateralSala({ amigos, recibidas, sugerencias, irA }) {
  const { t } = useIdioma()
  // Los que juegan primero, y después por orden alfabético (ya vienen así de la API)
  const grupo = [...amigos].sort((a, b) => Number(Boolean(b.playing)) - Number(Boolean(a.playing))).slice(0, 7)

  return (
    <aside className="lateral" aria-label={t('social.lateral')}>
      <section className="lateral__bloque">
        <h3 className="sala-titulo sala-titulo--pequeno">{t('social.grupo')}</h3>
        {grupo.length === 0 ? (
          <p className="sala-vacio">{t('social.grupoVacio')}</p>
        ) : (
          <ul className="grupo">
            {grupo.map((a) => (
              <li key={a.username} style={estiloTono(a.username)}>
                <Link to={`/usuarios/${a.username}`} className="grupo__fila">
                  <AvatarTono usuario={a} tamano="pequeno" vivo={Boolean(a.playing)} />
                  <span className="grupo__texto">
                    <strong>{a.username}</strong>
                    <small>{a.playing ? a.playing.name : t('social.grupoLibre')}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {amigos.length > grupo.length && (
          <button type="button" className="lateral__mas" onClick={() => irA('amigos')}>
            {t('social.verTodos', { n: amigos.length })}
          </button>
        )}
      </section>

      {recibidas.length > 0 && (
        <section className="lateral__bloque lateral__bloque--invitacion">
          <h3 className="sala-titulo sala-titulo--pequeno">{t('social.invitaciones')}</h3>
          <ul className="grupo">
            {recibidas.slice(0, 3).map((p) => (
              <li key={p.username} style={estiloTono(p.username)}>
                <Link to={`/usuarios/${p.username}`} className="grupo__fila">
                  <AvatarTono usuario={p} tamano="pequeno" />
                  <span className="grupo__texto">
                    <strong>{p.username}</strong>
                    <small>{t('social.quiereSerAmigo')}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--primario btn--block" onClick={() => irA('solicitudes')}>
            {t('social.responder', { n: recibidas.length })}
          </button>
        </section>
      )}

      {sugerencias.length > 0 && (
        <section className="lateral__bloque">
          <h3 className="sala-titulo sala-titulo--pequeno">{t('social.sugerencias')}</h3>
          <ul className="grupo">
            {sugerencias.slice(0, 3).map((p) => (
              <li key={p.username} style={estiloTono(p.username)}>
                <Link to={`/usuarios/${p.username}`} className="grupo__fila">
                  <AvatarTono usuario={p} tamano="pequeno" />
                  <span className="grupo__texto">
                    <strong>{p.username}</strong>
                    <small>
                      {p.mutual === 1 ? t('carnet.amigoComunUno') : t('carnet.amigosComun', { n: p.mutual })}
                    </small>
                  </span>
                </Link>
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

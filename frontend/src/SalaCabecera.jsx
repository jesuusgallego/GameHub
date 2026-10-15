import { Link } from 'react-router-dom'
import AvatarTono from './AvatarTono'
import { useIdioma } from './IdiomaContext'
import { estiloTono } from './tono'

const MAX_HUECOS = 6

// La cabecera de Social, como la pantalla de un lobby: de fondo un mosaico con las portadas
// de lo que juegan tus amigos, el título grande y, debajo, una pastilla de estado que dice con
// nombres quién está jugando ahora. A la derecha, tus amigos en una sola fila de círculos con
// su anillo de color: los que están jugando llevan la portada de su juego en la esquina y,
// al final, un círculo punteado con "+" para invitar a alguien.
//  - amigos: GET /friends (cada uno trae `playing`); null mientras carga
//  - actividad: GET /friends/activity (solo para sacar portadas del mosaico)
//  - onInvitar(): lleva a Descubrir
//  - onVerAmigos(): lleva a la pestaña Amigos (el hueco "+N")
function SalaCabecera({ amigos, actividad = [], onInvitar, onVerAmigos }) {
  const { t } = useIdioma()

  const jugando = amigos ? amigos.filter((a) => a.playing) : []

  // La frase: depende de cuántos juegan, con los primeros nombres
  let frase = t('social.subtitulo')
  if (amigos) {
    const [a, b] = jugando.map((p) => p.username)
    if (amigos.length === 0) frase = t('social.fraseSinAmigos')
    else if (jugando.length === 0) frase = t('social.fraseNadie')
    else if (jugando.length === 1) frase = t('social.fraseUno', { a })
    else if (jugando.length === 2) frase = t('social.fraseDos', { a, b })
    else frase = t('social.fraseVarios', { a, b, n: jugando.length - 2 })
  }

  // El mosaico: portadas distintas, primero las de lo que se juega ahora
  const portadas = [...new Set([
    ...jugando.map((a) => a.playing.cover_url),
    ...actividad.map((m) => m.cover_url),
  ].filter(Boolean))].slice(0, 12)

  // Los huecos: los que juegan primero. Si hay más amigos que huecos, el último es "+N".
  const ordenados = amigos
    ? [...amigos].sort((a, b) => Number(Boolean(b.playing)) - Number(Boolean(a.playing)))
    : []
  const sobran = Math.max(0, ordenados.length - MAX_HUECOS)
  const huecos = ordenados.slice(0, sobran > 0 ? MAX_HUECOS - 1 : MAX_HUECOS)

  return (
    <header className="banner-perfil sala-cabecera">
      <div className="banner-perfil__fondo" aria-hidden="true" />
      {portadas.length > 0 && (
        <div className="sala-cabecera__mosaico" aria-hidden="true">
          {portadas.map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
        </div>
      )}
      <div className="sala-cabecera__rayas" aria-hidden="true" />

      <div className="sala-cabecera__contenido">
        <div className="sala-cabecera__texto">
          <h1 className="titulo-pagina sala-cabecera__titulo">{t('social.titulo')}</h1>
          <p className="sala-cabecera__frase">
            {jugando.length > 0 && <span className="sala-titulo__punto" aria-hidden="true" />}
            {frase}
          </p>
        </div>

        {amigos && (
          <ul className="huecos" aria-label={t('social.tusAmigos')}>
            {huecos.map((a, i) => (
              <li key={a.username} className={a.playing ? "hueco hueco--vivo" : "hueco"}
                style={{ ...estiloTono(a.username), '--orden': i }}>
                <Link
                  to={`/usuarios/${a.username}`}
                  className="hueco__enlace"
                  title={a.playing ? t('social.huecoJugando', { usuario: a.username, juego: a.playing.name }) : undefined}
                >
                  <span className="hueco__foto">
                    <AvatarTono usuario={a} tamano="normal" vivo={Boolean(a.playing)} />
                    {a.playing?.cover_url && <img className="hueco__juego" src={a.playing.cover_url} alt="" />}
                  </span>
                  <span className="hueco__nombre">{a.username}</span>
                </Link>
              </li>
            ))}
            {sobran > 0 && (
              <li className="hueco hueco--vacio" style={{ '--orden': huecos.length }}>
                <button type="button" className="hueco__enlace" onClick={onVerAmigos}>
                  <span className="hueco__foto">
                    <span className="hueco__mas">+{sobran + 1}</span>
                  </span>
                  <span className="hueco__nombre">{t('social.masAmigos')}</span>
                </button>
              </li>
            )}
            <li className="hueco hueco--invitar" style={{ '--orden': huecos.length + (sobran > 0 ? 1 : 0) }}>
              <button type="button" className="hueco__enlace" onClick={onInvitar}>
                <span className="hueco__foto">
                  <span className="hueco__mas" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </span>
                <span className="hueco__nombre">{t('social.invitar')}</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </header>
  )
}

export default SalaCabecera

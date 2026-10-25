import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import FeedNoticias from './FeedNoticias'
import { VentanaPortales } from './PortalesNoticias'
import { useEventosNoticias } from './useEventosNoticias'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'
import { tiempoRelativo } from './tiempo'
import { masReciente } from './logicaNoticias'
import { logoPortal } from './logosPortales'

// La cabecera: una tarjeta con el degradado de la app (como la de Buscar). A la izquierda, la fecha,
// el título, una frase (de qué juegos tuyos se habla) y una línea de estado: cuándo salió la última
// noticia y de cuántos portales se leen. A la derecha, un abanico con las portadas de esos juegos que
// se abre al pasar el ratón (pulsar una enseña sus noticias); si no hay ninguno, un dibujo.
//  - frase: el texto de debajo del título
//  - ultima: la fecha de la noticia más reciente (null mientras no hay)
//  - nPortales: cuántos portales hay en el catálogo
//  - juegos: los de "Se habla de tus juegos"; onJuego(juego): pulsar una portada
//  - onPortales(): abre "Tus portales"; el botón solo se ve en pantallas estrechas, donde la columna
//    lateral (que tiene el suyo) se queda en lo justo
function CabeceraNoticias({ frase, ultima, nPortales, juegos, onJuego, onPortales }) {
  const { t, locale } = useIdioma()
  const hoy = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const portadas = juegos.filter((j) => j.cover_url).slice(0, 3)
  return (
    <header className="noticias-cabecera">
      <div className="noticias-cabecera__texto">
        <p className="noticias-cabecera__fecha">{hoy}</p>
        <h1 className="noticias-cabecera__titulo">{t('noticias.titulo')}</h1>
        <p className="noticias-cabecera__frase">{frase}</p>
        <p className="noticias-cabecera__estado">
          {ultima && (
            <span className="noticias-cabecera__vivo">
              <span className="noticias-cabecera__punto" aria-hidden="true" />
              {t('noticias.ultimaNoticia', { tiempo: tiempoRelativo(ultima, locale) })}
            </span>
          )}
          {nPortales > 0 && <span className="noticias-cabecera__cuantos">{t('noticias.nPortales', { n: nPortales })}</span>}
        </p>
      </div>

      {portadas.length > 0 ? (
        <div className="noticias-abanico" style={{ '--cuantas': portadas.length }}>
          {portadas.map((j, i) => (
            <button
              key={j.igdb_id}
              type="button"
              className="noticias-abanico__portada"
              // --i: -1, 0, 1 (posición respecto al centro); la del centro queda por encima
              style={{ '--i': i - (portadas.length - 1) / 2, zIndex: 3 - Math.abs(i - (portadas.length - 1) / 2) * 2 }}
              title={t('noticias.verDeJuego', { juego: j.name })}
              aria-label={t('noticias.verDeJuego', { juego: j.name })}
              onClick={() => onJuego(j)}
            >
              <img src={j.cover_url} alt="" />
            </button>
          ))}
        </div>
      ) : (
        <svg className="noticias-cabecera__dibujo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8M15 18h-5" />
          <path d="M10 6h8v4h-8z" />
        </svg>
      )}

      {onPortales && (
        <button type="button" className="noticias-cabecera__portales" aria-label={t('noticias.gestionarPortales')} title={t('noticias.gestionarPortales')} onClick={onPortales}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      )}
    </header>
  )
}

// La página de noticias: lo primero que ves al entrar en GameHub. Dos pestañas, "Para ti"
// (recomendadas según tu biblioteca, ver backend/src/services/recomendador.js) y "Siguiendo" (lo
// último de tus portales), y al lado "Se habla de tus juegos" (pulsar uno enseña sus noticias) y
// "Tus portales". La pestaña va en la URL (?tab=siguiendo).
function Noticias({ setToken }) {
  const { t, idioma } = useIdioma()
  const { perfil } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'siguiendo' ? 'siguiendo' : 'para_ti'
  const [portales, setPortales] = useState(null)
  const [gestionando, setGestionando] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const [juego, setJuego] = useState(null)
  const [mencionados, setMencionados] = useState([])
  // La fecha de la noticia más reciente de lo cargado, para la cabecera
  const [ultima, setUltima] = useState(null)
  // Las dos pestañas se montan la primera vez que se abren y luego siguen montadas (al volver, cada
  // una está donde la dejaste)
  const [abiertas, setAbiertas] = useState(() => new Set([tab]))
  if (!abiertas.has(tab)) setAbiertas(new Set(abiertas).add(tab))

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken('')
  }, [setToken])

  const eventos = useEventosNoticias({ activo: perfil?.news_personalization !== false, idioma })

  useEffect(() => {
    let vivo = true
    apiFetch('/news/sources', { avisoLento: false })
      .then((data) => { if (vivo) setPortales(data.sources) })
      .catch((err) => { if (err.status === 401) cerrarSesion() })
    return () => { vivo = false }
  }, [cerrarSesion, recarga])

  // Lo que llega de cada pestaña: los juegos de los que se habla (solo Para ti) y la noticia más
  // reciente (de las dos, la que lo sea más)
  const alDatos = useCallback(({ mencionados: m, noticias }) => {
    if (m) setMencionados(m)
    setUltima((previa) => masReciente(noticias, previa))
  }, [])

  function cambiarPortales(lista) {
    setPortales(lista)
    setRecarga((n) => n + 1)
  }

  function irA(id) {
    setParams(id === 'para_ti' ? {} : { tab: id }, { replace: true })
  }

  function verJuego(j) {
    setJuego(j)
    irA('para_ti')
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const seguidos = portales?.filter((p) => p.following) ?? []
  const frase = mencionados.length > 0
    ? t(['noticias.fraseJuego', 'noticias.fraseJuegosUno'][mencionados.length - 1] ?? 'noticias.fraseJuegos', { juego: mencionados[0].name, n: mencionados.length - 1 })
    : t('noticias.frase', { n: portales?.length ?? 24 })

  return (
    <div className="noticias">
      <CabeceraNoticias
        frase={frase}
        ultima={ultima}
        nPortales={portales?.length ?? 0}
        juegos={mencionados}
        onJuego={verJuego}
        onPortales={portales ? () => setGestionando(true) : null}
      />

      <PestanasPerfil
        variante="barra"
        pestanas={[
          { id: 'para_ti', etiqueta: t('noticias.paraTi') },
          { id: 'siguiendo', etiqueta: t('noticias.siguiendo'), contador: seguidos.length },
        ]}
        activa={tab}
        onCambiar={irA}
        etiqueta={t('noticias.secciones')}
      />

      <div className="noticias-cuerpo">
        <div className="noticias-paneles">
          {['para_ti', 'siguiendo'].filter((id) => abiertas.has(id)).map((id) => (
            <section
              key={id}
              id={`panel-${id}`}
              role="tabpanel"
              aria-label={id === 'para_ti' ? t('noticias.paraTi') : t('noticias.siguiendo')}
              hidden={id !== tab}
              className="noticias-panel"
            >
              <FeedNoticias
                // Cambiar la key lo crea de nuevo, desde cero: al cambiar de portales, de idioma o de juego
                key={`${id}:${recarga}:${idioma}:${id === 'para_ti' ? juego?.igdb_id ?? '' : ''}`}
                tipo={id}
                juego={id === 'para_ti' ? juego : null}
                portales={portales}
                eventos={eventos}
                onPortales={cambiarPortales}
                onDatos={alDatos}
                onQuitarJuego={() => setJuego(null)}
                cerrarSesion={cerrarSesion}
              />
            </section>
          ))}
        </div>

        <aside className="noticias-lateral">
          <section className={mencionados.length === 0 ? 'lateral__bloque noticias-bloque noticias-bloque--vacio' : 'lateral__bloque noticias-bloque'}>
            <h3 className="titulo-seccion lateral__titulo">{t('noticias.seHabla')}</h3>
            {mencionados.length === 0 ? (
              <p className="lateral__ayuda">{t('noticias.seHablaVacio')}</p>
            ) : (
              <>
                <p className="lateral__ayuda">{t('noticias.seHablaAyuda')}</p>
                <ul className="noticias-juegos">
                  {mencionados.map((m, i) => (
                    <li key={m.igdb_id} style={{ '--orden': i }}>
                      <button
                        type="button"
                        className={juego?.igdb_id === m.igdb_id ? 'noticias-juego noticias-juego--activo' : 'noticias-juego'}
                        aria-pressed={juego?.igdb_id === m.igdb_id}
                        onClick={() => (juego?.igdb_id === m.igdb_id ? setJuego(null) : verJuego(m))}
                      >
                        <span className="noticias-juego__portada">
                          {m.cover_url ? <img src={m.cover_url} alt="" loading="lazy" /> : null}
                        </span>
                        <span className="noticias-juego__texto">
                          <strong>{m.name}</strong>
                          <small>{t(m.count === 1 ? 'noticias.nNoticia' : 'noticias.nNoticias', { n: m.count })}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="lateral__bloque noticias-bloque noticias-bloque--portales">
            <h3 className="titulo-seccion lateral__titulo">{t('noticias.tusPortales')}</h3>
            {portales !== null && seguidos.length === 0 ? (
              <p className="lateral__ayuda">{t('noticias.sinPortales')}</p>
            ) : (
              <ul className="noticias-sellos">
                {seguidos.map((p, i) => (
                  <li key={p.slug} style={{ '--tono': p.tono, '--orden': i }}>
                    <a href={p.site} target="_blank" rel="noopener noreferrer">
                      {/* El logo en pequeño; sin él, el CSS pone un punto de su color */}
                      {logoPortal(p.slug) && <img className="noticias-sellos__logo" src={logoPortal(p.slug)} alt="" />}
                      {p.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="lateral__mas" disabled={!portales} onClick={() => setGestionando(true)}>
              {seguidos.length === 0 ? t('noticias.elegirPortales') : t('noticias.gestionarPortales')}
            </button>
          </section>

          <p className="noticias-nota">{t('noticias.nota')}</p>
        </aside>
      </div>

      {gestionando && portales && (
        <VentanaPortales
          portales={portales}
          // Al guardar, la ventana sale con su animación y después se quita, con la lista nueva
          onGuardado={(lista) => { cambiarPortales(lista); setGestionando(false) }}
          onCerrar={() => setGestionando(false)}
        />
      )}
    </div>
  )
}

export default Noticias

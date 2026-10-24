import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { apiFetch } from './api'
import PestanasPerfil from './PestanasPerfil'
import FeedNoticias from './FeedNoticias'
import { VentanaPortales } from './PortalesNoticias'
import { useEventosNoticias } from './useEventosNoticias'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'
import { titularesCinta } from './logicaNoticias'

// La cabecera, como la de un periódico: "NOTICIAS" en grande, la fecha de hoy y una frase, y debajo
// una cinta de "Última hora" con los titulares más recientes que se desliza sola (se para al pasar el
// ratón o con el foco, y no se mueve con "reducir movimiento"). Cada titular de la cinta es un enlace.
//  - titulares: las noticias de la cinta; frase: el texto de debajo del título
function CabeceraNoticias({ titulares, frase }) {
  const { t, locale } = useIdioma()
  const hoy = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const enlaces = (oculta) => titulares.map((n) => (
    <a key={`${oculta ? 'b' : 'a'}${n.id}`} href={n.url} target="_blank" rel="noopener noreferrer" tabIndex={oculta ? -1 : undefined} style={{ '--tono': n.source.tono }}>
      <strong>{n.source.name}</strong>
      {n.title}
    </a>
  ))
  return (
    <header className="noticias-cabecera">
      <div className="noticias-cabecera__cuerpo">
        <p className="noticias-cabecera__fecha">{hoy}</p>
        <h1 className="noticias-cabecera__titulo">{t('noticias.titulo')}</h1>
        <p className="noticias-cabecera__frase">{frase}</p>
      </div>
      {titulares.length > 0 && (
        <div className="noticias-cinta" role="region" aria-label={t('noticias.ultimaHora')}>
          <span className="noticias-cinta__rotulo">
            <span className="noticias-cinta__punto" aria-hidden="true" />
            {t('noticias.ultimaHora')}
          </span>
          <div className="noticias-cinta__ventana">
            {/* Dos copias seguidas: al llegar a la mitad, la animación vuelve al principio sin que se note */}
            <div className="noticias-cinta__pista" style={{ '--duracion': `${Math.max(30, titulares.length * 7)}s` }}>
              <span className="noticias-cinta__tanda">{enlaces(false)}</span>
              <span className="noticias-cinta__tanda" aria-hidden="true">{enlaces(true)}</span>
            </div>
          </div>
        </div>
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
  const [titulares, setTitulares] = useState([])
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

  const alDatosParaTi = useCallback(({ mencionados: m, noticias }) => {
    if (m) setMencionados(m)
    setTitulares((previos) => (previos.length > 0 ? previos : titularesCinta(noticias)))
  }, [])
  const alDatosSiguiendo = useCallback(({ noticias }) => {
    setTitulares((previos) => (previos.length > 0 ? previos : titularesCinta(noticias)))
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
      <CabeceraNoticias titulares={titulares} frase={frase} />

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
                onDatos={id === 'para_ti' ? alDatosParaTi : alDatosSiguiendo}
                onQuitarJuego={() => setJuego(null)}
                cerrarSesion={cerrarSesion}
              />
            </section>
          ))}
        </div>

        <aside className="noticias-lateral">
          <section className="lateral__bloque noticias-bloque">
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

          <section className="lateral__bloque noticias-bloque">
            <h3 className="titulo-seccion lateral__titulo">{t('noticias.tusPortales')}</h3>
            {portales !== null && seguidos.length === 0 ? (
              <p className="lateral__ayuda">{t('noticias.sinPortales')}</p>
            ) : (
              <ul className="noticias-sellos">
                {seguidos.map((p, i) => (
                  <li key={p.slug} style={{ '--tono': p.tono, '--orden': i }}>
                    <a href={p.site} target="_blank" rel="noopener noreferrer">{p.name}</a>
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

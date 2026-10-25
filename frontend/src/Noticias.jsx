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
import { masReciente, limpiarOpciones, OPCIONES_INICIALES } from './logicaNoticias'
import OpcionesNoticias from './OpcionesNoticias'
import { logoPortal } from './logosPortales'
import FondoCabecera from './FondoCabecera'

// La cabecera, con el mismo fondo que las de Social y Mi biblioteca (FondoCabecera): de mosaico,
// las imágenes de las últimas noticias. Delante, la fecha, el título, una frase (de qué juegos tuyos
// se habla) y una línea de estado: cuándo salió la última noticia y una pastilla con los logos de
// tus portales, montados uno sobre otro, que abre "Tus portales".
//  - frase: el texto de debajo del título
//  - ultima: la fecha de la noticia más reciente (null mientras no hay)
//  - imagenes: las del mosaico de fondo
//  - portales: el catálogo (null mientras llega); onPortales(): abre "Tus portales"
function CabeceraNoticias({ frase, ultima, imagenes, portales, onPortales }) {
  const { t, locale } = useIdioma()
  const hoy = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  // Los logos del botón: primero los portales que sigues, hasta cinco
  const conLogo = (portales ?? []).filter((p) => logoPortal(p.slug))
  const logos = [...conLogo.filter((p) => p.following), ...conLogo.filter((p) => !p.following)].slice(0, 5)
  return (
    <header className="banner-perfil noticias-cabecera">
      <FondoCabecera estilo="noticias" imagenes={imagenes} />
      <div className="noticias-cabecera__texto">
        <p className="noticias-cabecera__fecha">{hoy}</p>
        <h1 className="noticias-cabecera__titulo">{t('noticias.titulo')}</h1>
        <p className="noticias-cabecera__frase">{frase}</p>
        <div className="noticias-cabecera__estado">
          {ultima && (
            <span className="noticias-cabecera__vivo">
              <span className="noticias-cabecera__punto" aria-hidden="true" />
              {t('noticias.ultimaNoticia', { tiempo: tiempoRelativo(ultima, locale) })}
            </span>
          )}
          {portales && (
            <button type="button" className="noticias-cabecera__portales" title={t('noticias.gestionarPortales')} onClick={onPortales}>
              <span className="noticias-cabecera__logos" aria-hidden="true">
                {logos.map((p, i) => <img key={p.slug} src={logoPortal(p.slug)} alt="" style={{ '--i': i }} />)}
              </span>
              {t('noticias.nPortales', { n: portales.length })}
              <span className="sr-only">{t('noticias.gestionarPortales')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

// El orden y los filtros de cada pestaña se recuerdan en este navegador (si no se puede, solo duran
// la visita). Por defecto: lo más nuevo primero y sin filtros.
const CLAVE_OPCIONES = 'noticias.opciones'

function leerOpciones() {
  let guardadas = null
  try {
    guardadas = JSON.parse(localStorage.getItem(CLAVE_OPCIONES))
  } catch {
    // Sin localStorage o con algo roto dentro: las de por defecto
  }
  return { para_ti: limpiarOpciones(guardadas?.para_ti), siguiendo: limpiarOpciones(guardadas?.siguiendo) }
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
  // Las imágenes del mosaico de la cabecera: las de la primera página que llega, una vez (así no
  // cambian mientras lees)
  const [imagenes, setImagenes] = useState([])
  // Las dos pestañas se montan la primera vez que se abren y luego siguen montadas (al volver, cada
  // una está donde la dejaste)
  const [abiertas, setAbiertas] = useState(() => new Set([tab]))
  if (!abiertas.has(tab)) setAbiertas(new Set(abiertas).add(tab))
  // El orden y los filtros de cada pestaña ({ para_ti, siguiendo }, ver OpcionesNoticias.jsx)
  const [opciones, setOpciones] = useState(leerOpciones)

  function cambiarOpciones(id, nuevas) {
    setOpciones((previas) => {
      const todas = { ...previas, [id]: limpiarOpciones(nuevas) }
      try {
        localStorage.setItem(CLAVE_OPCIONES, JSON.stringify(todas))
      } catch {
        // Sin localStorage: valen hasta que cierres la página
      }
      return todas
    })
  }

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
    setImagenes((previas) => (previas.length > 0 ? previas : [...new Set(noticias.map((n) => n.image).filter(Boolean))].slice(0, 12)))
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
      <CabeceraNoticias frase={frase} ultima={ultima} imagenes={imagenes} portales={portales} onPortales={() => setGestionando(true)} />

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
          {/* El orden y los filtros de la pestaña abierta (en "Siguiendo", solo si sigues algún
              portal: si no, lo que sale es la elección de portales). Los portales que se pueden
              elegir: en "Siguiendo", los tuyos; en "Para ti", todos. */}
          {(tab === 'para_ti' || seguidos.length > 0) && (
            <OpcionesNoticias
              tipo={tab}
              opciones={opciones[tab]}
              portales={portales && (tab === 'siguiendo' ? seguidos : portales)}
              onCambiar={(nuevas) => cambiarOpciones(tab, nuevas)}
            />
          )}
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
                key={`${id}:${recarga}:${idioma}:${id === 'para_ti' ? juego?.igdb_id ?? '' : ''}:${JSON.stringify(opciones[id])}`}
                tipo={id}
                opciones={opciones[id]}
                onQuitarFiltros={() => cambiarOpciones(id, { ...OPCIONES_INICIALES, orden: opciones[id].orden })}
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

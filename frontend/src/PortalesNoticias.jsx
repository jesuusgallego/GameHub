import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useVentana } from './useVentana'
import { useIdioma } from './IdiomaContext'
import { portalesPorIdioma, preseleccion } from './logicaNoticias'
import { tiempoRelativo } from './tiempo'

// La lista de portales para elegir cuáles seguir, en dos grupos por idioma (el de la interfaz
// primero). Cada portal es un botón que se marca y desmarca, con su color, su nombre y su último
// titular. Sirve en dos sitios: la primera vez, dentro de "Siguiendo", y en la ventana "Tus portales".
//  - portales: GET /news/sources
//  - elegidos: los slugs marcados; onAlternar(slug)
export function ListaPortales({ portales, elegidos, onAlternar }) {
  const { t, idioma, locale } = useIdioma()
  return (
    <div className="portales">
      {portalesPorIdioma(portales, idioma).map((grupo) => (
        <section key={grupo.lang} className="portales__grupo" aria-label={t(`noticias.idioma.${grupo.lang}`)}>
          <h3 className="portales__idioma">{t(`noticias.idioma.${grupo.lang}`)}</h3>
          <ul className="portales__lista">
            {grupo.portales.map((p, i) => {
              const elegido = elegidos.includes(p.slug)
              return (
                <li key={p.slug} style={{ '--tono': p.tono, '--orden': Math.min(i, 12) }}>
                  <button
                    type="button"
                    className={elegido ? 'portal portal--elegido' : 'portal'}
                    aria-pressed={elegido}
                    onClick={() => onAlternar(p.slug)}
                  >
                    <span className="portal__sello" aria-hidden="true">{p.name.replace(/[^A-Za-z0-9ÁÉÍÓÚÑ]/g, '').slice(0, 2)}</span>
                    <span className="portal__texto">
                      <strong>{p.name}</strong>
                      <small>
                        {p.latest
                          ? `${tiempoRelativo(p.latest.published_at, locale)} · ${p.latest.title}`
                          : t('noticias.portalSinNoticias')}
                      </small>
                    </span>
                    <span className="portal__marca" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {elegido ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 6v12M6 12h12" />}
                      </svg>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// Guarda la lista de portales que sigues (PUT /news/follows) y devuelve el catálogo al día
async function guardarPortales(slugs) {
  await apiFetch('/news/follows', { method: 'PUT', body: { slugs } })
  const data = await apiFetch('/news/sources')
  return data.sources
}

// La primera vez que entras en "Siguiendo" sin seguir nada: la lista con los portales de tu
// idioma ya marcados, para que confirmes o cambies, en vez de una pantalla vacía
export function ElegirPortalesInicio({ portales, onGuardado }) {
  const { t, idioma } = useIdioma()
  const [elegidos, setElegidos] = useState(() => preseleccion(portales, idioma))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const alternar = (slug) => setElegidos((e) => (e.includes(slug) ? e.filter((s) => s !== slug) : [...e, slug]))

  async function seguir() {
    setGuardando(true)
    setError('')
    try {
      onGuardado(await guardarPortales(elegidos))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <section className="noticias-inicio" aria-labelledby="noticias-inicio-titulo">
      <div className="noticias-inicio__cabecera">
        <h2 id="noticias-inicio-titulo">{t('noticias.inicio.titulo')}</h2>
        <p>{t('noticias.inicio.texto')}</p>
      </div>
      <ListaPortales portales={portales} elegidos={elegidos} onAlternar={alternar} />
      <Mensaje texto={error} />
      <div className="noticias-inicio__acciones">
        <button type="button" className="btn btn--primario" disabled={elegidos.length === 0 || guardando} onClick={seguir}>
          {guardando ? <><Cargando tamano="pequeno" /> {t('comun.guardando')}</> : t(elegidos.length === 1 ? 'noticias.inicio.seguirUno' : 'noticias.inicio.seguir', { n: elegidos.length })}
        </button>
      </div>
    </section>
  )
}

// La ventana "Tus portales": la misma lista, con Guardar y Cancelar
export function VentanaPortales({ portales, onGuardado, onCerrar }) {
  const { t } = useIdioma()
  const dialogRef = useRef(null)
  const [elegidos, setElegidos] = useState(() => portales.filter((p) => p.following).map((p) => p.slug))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const { saliendo, cerrar, alCancelar } = useVentana(onCerrar)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  const alternar = (slug) => setElegidos((e) => (e.includes(slug) ? e.filter((s) => s !== slug) : [...e, slug]))
  const antes = portales.filter((p) => p.following).map((p) => p.slug).sort().join()
  const cambiado = [...elegidos].sort().join() !== antes

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const nuevos = await guardarPortales(elegidos)
      cerrar(() => onGuardado(nuevos))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={saliendo ? 'dialogo ventana-portales ventana--saliendo' : 'dialogo ventana-portales'}
      aria-labelledby="ventana-portales-titulo"
      onCancel={alCancelar}
      onClose={onCerrar}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}
    >
      <header className="ventana-portales__cabecera">
        <div>
          <h2 id="ventana-portales-titulo" className="dialogo__titulo">{t('noticias.portales.titulo')}</h2>
          <p className="dialogo__mensaje">{t('noticias.portales.texto', { n: elegidos.length })}</p>
        </div>
        <button type="button" className="chat-nuevo__cerrar" aria-label={t('comun.cerrar')} onClick={() => cerrar()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="ventana-portales__cuerpo">
        <ListaPortales portales={portales} elegidos={elegidos} onAlternar={alternar} />
      </div>
      <Mensaje texto={error} />
      <div className="dialogo__acciones">
        <button type="button" className="btn btn--secundario" onClick={() => cerrar()}>{t('comun.cancelar')}</button>
        <button type="button" className="btn btn--primario" disabled={!cambiado || guardando} onClick={guardar}>
          {guardando ? <><Cargando tamano="pequeno" /> {t('comun.guardando')}</> : t('comun.guardar')}
        </button>
      </div>
    </dialog>
  )
}

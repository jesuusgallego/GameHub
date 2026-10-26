import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import TarjetaNoticia from './TarjetaNoticia'
import { ElegirPortalesInicio } from './PortalesNoticias'
import { useIdioma } from './IdiomaContext'
import { juntarNoticias, cursorSiguiente, parametrosNoticias, filtrosActivos } from './logicaNoticias'

// Si el servidor estaba leyendo los portales al responder, se vuelve a pedir la primera página al
// cabo de este rato (solo si no has cargado más: así no se te mueve nada mientras lees)
const REPETIR_MS = 9000

// Una de las dos listas de noticias:
//  - tipo 'para_ti': GET /news/for-you (recomendadas, con su motivo); con `juego`, solo las de ese juego
//  - tipo 'siguiendo': GET /news/following (tus portales, por fecha); sin portales, la elección inicial
// La primera noticia sale en grande y el resto en una rejilla. Al llegar abajo carga la página
// siguiente sola. "No me interesa" la cambia por un hueco con "Deshacer".
//  - portales: el catálogo (GET /news/sources), para la elección inicial
//  - eventos: { observar, clic } de useEventosNoticias
//  - onPortales(lista): has elegido portales en la elección inicial
//  - onDatos({ mencionados, noticias }): lo que la página enseña al lado (juegos y titulares)
//  - onQuitarJuego(): quita el filtro por juego
//  - opciones: el orden y los filtros ({ orden, periodo, portal, misJuegos }, ver OpcionesNoticias.jsx);
//    al cambiarlas, el padre cambia la `key` y la lista empieza de nuevo
//  - onQuitarFiltros(): quita los filtros (desde el aviso de "no hay noticias con estos filtros")
function FeedNoticias({ tipo, juego, portales, eventos, onPortales, onDatos, onQuitarJuego, cerrarSesion, opciones, onQuitarFiltros }) {
  const { t, idioma } = useIdioma()
  const [noticias, setNoticias] = useState([])
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'listo' | 'error'
  const [error, setError] = useState('')
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [seguidos, setSeguidos] = useState(null)
  const [tamanoBiblioteca, setTamanoBiblioteca] = useState(null)
  const [refrescando, setRefrescando] = useState(false)
  // Las que acabas de ocultar: en su sitio queda un hueco con "Deshacer". Antes, la tarjeta sale con
  // su animación (`saliendo`); al deshacer, el hueco también sale animado (`volviendo`).
  const [ocultas, setOcultas] = useState(() => new Set())
  const [saliendo, setSaliendo] = useState(() => new Set())
  const [volviendo, setVolviendo] = useState(() => new Set())
  const [aviso, setAviso] = useState('')
  const paginasRef = useRef(0)
  const centinelaRef = useRef(null)
  const onDatosRef = useRef(onDatos)
  useEffect(() => { onDatosRef.current = onDatos }, [onDatos])

  const feed = tipo
  const ruta = useCallback((offset, actuales, fresca) => {
    // El orden y los filtros (solo lo que no es lo de por defecto)
    const filtros = new URLSearchParams(parametrosNoticias(tipo, opciones))
    if (tipo === 'siguiendo') {
      const partes = [filtros.toString(), offset > 0 ? cursorSiguiente(actuales) : ''].filter(Boolean)
      return `/news/following${partes.length > 0 ? `?${partes.join('&')}` : ''}`
    }
    const params = new URLSearchParams({ lang: idioma, offset: String(offset) })
    if (juego) params.set('game', String(juego.igdb_id))
    if (fresca) params.set('fresh', '1')
    for (const [clave, valor] of filtros) params.set(clave, valor)
    return `/news/for-you?${params}`
  }, [tipo, idioma, juego, opciones])
  const hayFiltros = filtrosActivos(tipo, opciones) > 0

  // La primera página. `pedir` solo trae los datos y `aplicar` los pone en pantalla: así el efecto
  // de abajo no cambia ningún estado de forma síncrona (el estado inicial ya es 'cargando').
  const pedir = useCallback((fresca = false) => apiFetch(ruta(0, [], fresca)), [ruta])

  const aplicar = useCallback((data) => {
    paginasRef.current = 1
    setNoticias(data.articles)
    setHayMas(data.has_more)
    setRefrescando(Boolean(data.refreshing))
    if (tipo === 'siguiendo') setSeguidos(data.following)
    else setTamanoBiblioteca(data.library_size)
    setEstado('listo')
    setError('')
    onDatosRef.current?.({ mencionados: data.mentioned ?? null, noticias: data.articles })
  }, [tipo])

  const fallo = useCallback((err) => {
    if (err.status === 401) return cerrarSesion()
    setError(err.message)
    setEstado('error')
  }, [cerrarSesion])

  // "Reintentar" tras un error
  function reintentar() {
    setEstado('cargando')
    pedir().then(aplicar, fallo)
  }

  // Al montar. Para empezar de cero (otro idioma, otro juego, otros portales) el padre cambia la
  // `key` del componente: así React lo crea de nuevo, con su estado inicial ('cargando').
  useEffect(() => {
    let temporizador = null
    let vivo = true
    pedir().then((data) => {
      if (!vivo) return
      aplicar(data)
      // El servidor estaba leyendo los portales: en un rato, otra vez (sin que se note), si no has
      // cargado más páginas
      if (data.refreshing) {
        temporizador = setTimeout(() => {
          if (paginasRef.current === 1) pedir(true).then((d) => { if (vivo) aplicar(d) }, () => {})
        }, REPETIR_MS)
      }
    }, (err) => { if (vivo) fallo(err) })
    return () => { vivo = false; clearTimeout(temporizador) }
  }, [pedir, aplicar, fallo])

  // La página siguiente
  const cargarMas = useCallback(async () => {
    if (cargandoMas || !hayMas) return
    setCargandoMas(true)
    try {
      // En "Para ti", desde la posición de la última más uno (no desde cuántas hay: una página puede
      // llegar con alguna menos si ocultaste una)
      const ultima = noticias[noticias.length - 1]
      const desde = tipo === 'siguiendo' ? 1 : (ultima?.position ?? noticias.length - 1) + 1
      const data = await apiFetch(ruta(desde, noticias, false), { avisoLento: false })
      paginasRef.current += 1
      setNoticias((n) => juntarNoticias(n, data.articles))
      setHayMas(data.has_more)
    } catch (err) {
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, hayMas, ruta, tipo, noticias, cerrarSesion])

  // Cuando el final de la lista se acerca a la pantalla, se carga la siguiente página
  useEffect(() => {
    const el = centinelaRef.current
    if (!el || !hayMas) return undefined
    const observador = new IntersectionObserver((e) => { if (e[0].isIntersecting) cargarMas() }, { rootMargin: '600px 0px' })
    observador.observe(el)
    return () => observador.disconnect()
  }, [hayMas, cargarMas, noticias.length])

  const sin = (conjunto, id) => { const n = new Set(conjunto); n.delete(id); return n }

  async function ocultar(noticia, posicion) {
    // Con "reducir movimiento" no hay animaciones (ni su animationend): se cambia al instante
    if (sinMovimiento()) alSalir(noticia)
    else setSaliendo((s) => new Set(s).add(noticia.id))
    setAviso('')
    try {
      await apiFetch(`/news/articles/${noticia.id}/hide`, { method: 'POST', body: { feed, position: posicion, lang: idioma } })
    } catch (err) {
      setSaliendo((s) => sin(s, noticia.id))
      setOcultas((o) => sin(o, noticia.id))
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    }
  }

  // La tarjeta terminó de salir: en su sitio, el hueco
  function alSalir(noticia) {
    setSaliendo((s) => sin(s, noticia.id))
    setOcultas((o) => new Set(o).add(noticia.id))
  }

  async function deshacer(noticia) {
    setVolviendo((v) => new Set(v).add(noticia.id))
    try {
      await apiFetch(`/news/articles/${noticia.id}/hide`, { method: 'DELETE' })
      if (sinMovimiento()) alVolver(noticia)
    } catch (err) {
      setVolviendo((v) => sin(v, noticia.id))
      if (err.status === 401) return cerrarSesion()
      setAviso(err.message)
    }
  }

  // El hueco terminó de salir: vuelve la tarjeta (con su animación de entrada)
  function alVolver(noticia) {
    setVolviendo((v) => sin(v, noticia.id))
    setOcultas((o) => sin(o, noticia.id))
  }

  // ---- Pintar ------------------------------------------------------------------------
  if (estado === 'cargando') {
    return <div className="noticias-estado"><Cargando texto={t('noticias.cargando')} tamano="grande" centrado /></div>
  }
  if (estado === 'error') {
    return (
      <div className="noticias-estado">
        <Mensaje texto={error} />
        <button type="button" className="btn btn--secundario" onClick={reintentar}>{t('noticias.reintentar')}</button>
      </div>
    )
  }

  if (tipo === 'siguiendo' && seguidos === 0) {
    if (!portales) return <div className="noticias-estado"><Cargando texto={t('noticias.cargando')} centrado /></div>
    return <ElegirPortalesInicio portales={portales} onGuardado={onPortales} />
  }

  return (
    <div className="noticias-feed">
      {juego && (
        <div className="noticias-filtro">
          <span>{t('noticias.filtroJuego', { juego: juego.name })}</span>
          <button type="button" onClick={onQuitarJuego}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            {t('noticias.quitarFiltro')}
          </button>
        </div>
      )}

      {tipo === 'para_ti' && !juego && tamanoBiblioteca === 0 && (
        <p className="noticias-consejo">
          {t('noticias.consejoBiblioteca')} <Link to="/buscar">{t('noticias.consejoBuscar')}</Link>
        </p>
      )}

      {refrescando && (
        <p className="noticias-refrescando" role="status">
          <Cargando tamano="pequeno" /> {t('noticias.buscandoNuevas')}
        </p>
      )}

      <Mensaje texto={aviso} />

      {noticias.length === 0 ? (
        <div className="noticias-estado">
          {hayFiltros ? (
            <>
              <p>{t('noticias.vacioFiltros')}</p>
              <button type="button" className="btn btn--secundario" onClick={onQuitarFiltros}>{t('noticias.quitarFiltros')}</button>
            </>
          ) : (
            <p>{juego ? t('noticias.vacioJuego') : t('noticias.vacio')}</p>
          )}
        </div>
      ) : (
        <div className="noticias-rejilla">
          {noticias.map((n, i) => {
            const posicion = n.position ?? i
            if (ocultas.has(n.id)) {
              const vuelve = volviendo.has(n.id)
              return (
                <div
                  key={n.id}
                  className={['noticia-oculta', i === 0 && 'noticia-oculta--destacada', vuelve && 'noticia-oculta--saliendo'].filter(Boolean).join(' ')}
                  onAnimationEnd={(e) => { if (vuelve && e.target === e.currentTarget) alVolver(n) }}
                >
                  <p>{t('noticias.ocultada')}</p>
                  <button type="button" className="btn btn--secundario" disabled={vuelve} onClick={() => deshacer(n)}>{t('noticias.deshacer')}</button>
                </div>
              )
            }
            return (
              <TarjetaNoticia
                key={n.id}
                noticia={n}
                destacada={i === 0}
                orden={i % POR_TANDA}
                refObservar={eventos.observar(n, feed, posicion)}
                onAbrir={() => eventos.clic(n, feed, posicion)}
                onOcultar={() => ocultar(n, posicion)}
                saliendo={saliendo.has(n.id)}
                onSalida={() => alSalir(n)}
              />
            )
          })}
        </div>
      )}

      {hayMas && (
        <div ref={centinelaRef} className="noticias-mas">
          {cargandoMas
            ? <Cargando texto={t('noticias.cargandoMas')} />
            : <button type="button" className="btn btn--secundario" onClick={cargarMas}>{t('noticias.verMas')}</button>}
        </div>
      )}
    </div>
  )
}

// Las tarjetas entran una tras otra; al cargar otra página, la cuenta del escalonado empieza de nuevo
const POR_TANDA = 20

const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default FeedNoticias

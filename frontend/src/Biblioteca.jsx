import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import JuegoGuardado from './JuegoGuardado'
import DetalleJuego from './DetalleJuego'
import AnadirJuegos from './AnadirJuegos'
import FondoCabecera from './FondoCabecera'
import FiltrosBiblioteca from './FiltrosBiblioteca'
import OrdenBiblioteca from './OrdenBiblioteca'
import { CRITERIOS, TODOS, ordenar, filtrar, opcionesDeFiltros, filtrosVigentes } from './ordenFiltros'
import { ESTADOS } from './estados'
import { useIdioma } from './IdiomaContext'
import { apiFetch } from './api'
import Cargando from './Cargando'
import JugandoAhora from './JugandoAhora'
import Plegable from './Plegable'
import { useAnimacionLista } from './useAnimacionLista'
import { leerCacheJuegos, guardarCacheJuegos } from './cacheBiblioteca'
import { borrarToken } from './sesion'

// Muestro los juegos que el usuario ha guardado (GET /games). El botón "Añadir juegos" abre la
// ventana para buscar en IGDB y guardar más (AnadirJuegos). Esa ventana va en la URL
// (/biblioteca?anadir=, con lo que haya que buscar ya escrito): así otras páginas pueden traer aquí
// con ella abierta y el botón Atrás del navegador la cierra.
function Biblioteca({ setToken }) {
  const { t, locale } = useIdioma()
  // Si ya pedí la biblioteca en esta sesión, la enseño al instante y la refresco por detrás
  // (ver cacheBiblioteca.js); si no, spinner hasta que llegue
  const [juegos, setJuegos] = useState(() => leerCacheJuegos() ?? [])
  const [cargando, setCargando] = useState(() => leerCacheJuegos() === null)
  const [error, setError] = useState("")
  // Los filtros y el orden solo viven en el navegador: no piden nada al backend, los
  // aplico sobre la lista que ya tengo en "juegos".
  const [filtros, setFiltros] = useState({
    estado: TODOS,
    genero: TODOS,
    compania: TODOS,
    plataforma: TODOS,
  })
  const [consulta, setConsulta] = useState("")
  // Por qué dato se ordena y en qué sentido. Por defecto, lo último que añadí primero.
  const [criterio, setCriterio] = useState("anadido")
  const [direccion, setDireccion] = useState("desc")
  // Juego cuya ficha está abierta (null = ninguna). Un único estado en la página
  // vale para todas las tarjetas.
  const [detalle, setDetalle] = useState(null)
  // Anima la rejilla al filtrar, ordenar o buscar (las tarjetas se deslizan, entran y salen)
  const rejillaRef = useAnimacionLista()
  const [params, setParams] = useSearchParams()
  const anadiendo = params.has('anadir')
  // Los que ya tengo, por su id de IGDB, para marcarlos en la ventana de añadir
  const guardados = useMemo(() => new Map(juegos.map((j) => [j.igdb_id, j])), [juegos])

  // Estable (useCallback): la ventana de añadir lo usa dentro de un efecto
  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken("")
  }, [setToken])

  // Cada cambio de la lista (al cargar, editar o borrar) se guarda para la próxima visita
  useEffect(() => {
    if (!cargando) guardarCacheJuegos(juegos)
  }, [juegos, cargando])

  useEffect(() => {
    let cancelado = false

    apiFetch('/games')
      .then((data) => {
        if (!cancelado) setJuegos(data.games)
      })
      .catch((err) => {
        if (cancelado) return

        if (err.status === 401) {
          // Token caducado o inválido: cierro sesión y RutaProtegida me redirige al login
          borrarToken()
          setToken("")
          return
        }

        // Con la copia en pantalla, un fallo al refrescar no la quita: se sigue viendo lo último
        // que se sabe. Sin copia, se enseña el error.
        if (!leerCacheJuegos()) setError(err.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    // Si el componente se desmonta antes de que llegue la respuesta, la ignoro
    return () => { cancelado = true }
  }, [setToken])

  // Editar y borrar viven aquí porque este componente es el dueño de la lista:
  // al responder el backend actualizo el estado local sin volver a pedirla entera.
  // Relanzo los errores para que la tarjeta los muestre; solo gestiono aquí el
  // 401 (cerrar sesión).
  async function actualizarJuego(id, cambios) {
    try {
      const data = await apiFetch(`/games/${id}`, { method: 'PATCH', body: cambios })
      setJuegos((prev) => prev.map((j) => (j.id === id ? data.game : j)))
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  // Guardo un juego nuevo (desde la ventana de añadir o desde su ficha). Va el primero de la lista,
  // como lo último que añadí. Relanzo el error para que lo enseñe el botón que lo pidió.
  async function anadirJuego(juego) {
    try {
      const data = await apiFetch('/games', {
        method: 'POST',
        body: { igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url },
      })
      setJuegos((prev) => [data.game, ...prev.filter((j) => j.id !== data.game.id)])
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  // Abrir la ventana de añadir, con algo ya escrito si se quiere; al cerrarla, se quita de la URL
  function abrirAnadir(termino = "") {
    setParams({ anadir: termino })
  }

  function cerrarAnadir() {
    setParams((p) => { p.delete('anadir'); return p }, { replace: true })
  }

  async function borrarJuego(id) {
    try {
      await apiFetch(`/games/${id}`, { method: 'DELETE' })
      setJuegos((prev) => prev.filter((j) => j.id !== id))
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  function cambiarFiltro(clave, valor) {
    setFiltros((prev) => ({ ...prev, [clave]: valor }))
  }

  function limpiarFiltros() {
    setFiltros({ estado: TODOS, genero: TODOS, compania: TODOS, plataforma: TODOS })
    setConsulta("")
  }

  // Al elegir otro criterio vuelve al sentido que es lo normal en él: A → Z en un
  // nombre, de mayor a menor en un tiempo...
  function cambiarCriterio(id) {
    setCriterio(id)
    setDireccion(CRITERIOS.find((c) => c.id === id).porDefecto)
  }

  if (cargando) return <Cargando texto={t('biblioteca.cargando')} tamano="grande" centrado />

  if (error) return <p className="mensaje mensaje--error" role="alert">{error}</p>

  function abrirDetalle(juego) {
    setDetalle({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url })
  }

  // La fila de mi biblioteca del juego cuya ficha está abierta (undefined si no hay
  // ninguna o si acaba de quitarse)
  const guardadoDelDetalle = detalle && juegos.find((j) => j.igdb_id === detalle.igdb_id)

  // Las dos ventanas, iguales con la biblioteca vacía o llena. La ficha va después: si se abre
  // desde la ventana de añadir, queda encima de ella.
  const ventanas = (
    <>
      {anadiendo && (
        <AnadirJuegos
          guardados={guardados}
          terminoInicial={params.get('anadir') ?? ""}
          onAnadir={anadirJuego}
          // Desde aquí la ficha ofrece "Añadir a mi biblioteca"
          onVerDetalle={(juego) => setDetalle({ ...juego, desdeAnadir: true })}
          onCerrar={cerrarAnadir}
          cerrarSesion={cerrarSesion}
        />
      )}

      {detalle && (
        <DetalleJuego
          key={detalle.igdb_id}
          juego={detalle}
          guardado={guardadoDelDetalle}
          onAnadir={detalle.desdeAnadir ? () => anadirJuego(detalle) : undefined}
          onActualizar={guardadoDelDetalle && ((cambios) => actualizarJuego(guardadoDelDetalle.id, cambios))}
          onBorrar={guardadoDelDetalle && (() => borrarJuego(guardadoDelDetalle.id))}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </>
  )

  if (juegos.length === 0) {
    return (
      <>
        <div className="estado-vacio">
          <h1>{t('biblioteca.vaciaTitulo')}</h1>
          <p>{t('biblioteca.vaciaTexto')}</p>
          <button type="button" className="btn btn--primario" onClick={() => abrirAnadir()}>
            <IconoMas />
            {t('biblioteca.anadirJuegos')}
          </button>
        </div>
        {ventanas}
      </>
    )
  }

  // Valores derivados: los calculo en cada render a partir del estado para que
  // nunca queden desactualizados (así no necesitan su propio useState).
  const jugandoAhora = juegos.filter((j) => j.status === "jugando")
  // La pastilla de la cabecera: cuántos juegos hay en cada estado (solo los que tienen alguno)
  const resumen = ESTADOS
    .map((estado) => ({ estado, n: juegos.filter((j) => j.status === estado).length }))
    .filter((r) => r.n > 0)
  // El mosaico de la cabecera: mis portadas, primero las de lo que estoy jugando
  const portadasCabecera = [...new Set(
    [...jugandoAhora, ...juegos].map((j) => j.cover_url).filter(Boolean)
  )].slice(0, 12)

  const opciones = opcionesDeFiltros(juegos, locale)
  const vigentes = filtrosVigentes(filtros, opciones)
  const visibles = ordenar(filtrar(juegos, vigentes, consulta), criterio, direccion, locale)
  const hayFiltros = consulta.trim() !== "" || Object.values(vigentes).some((v) => v !== TODOS)

  return (
    <div className="biblioteca-pagina">
      {/* La cabecera, con el mismo fondo que las de Social y Noticias (FondoCabecera): de mosaico,
          las portadas de mis juegos. Delante, el título con cuántos juegos veo, una pastilla con
          cuántos hay en cada estado y "Añadir juegos" (busca juegos nuevos). Arriba del todo, para
          que el botón se vea nada más entrar, también en el móvil. */}
      <header className="banner-perfil biblioteca__cabecera">
        <FondoCabecera estilo="biblioteca" imagenes={portadasCabecera} />
        <div className="biblioteca__cabecera-contenido">
          <div className="biblioteca__cabecera-texto">
            <h1 id="titulo-biblioteca" className="titulo-pagina">
              {t('biblioteca.titulo')}{" "}
              <span className="contador">
                {/* Con filtros: "12 / 48" (los que veo de los que tengo) */}
                {visibles.length === juegos.length ? juegos.length : `${visibles.length} / ${juegos.length}`}
              </span>
            </h1>
            <p className="biblioteca__resumen">
              {resumen.map(({ estado, n }) => (
                <span key={estado}>
                  <span className={`punto punto--${estado}`} aria-hidden="true" />
                  {t(n === 1 ? `biblioteca.resumen.${estado}` : `biblioteca.resumen.${estado}N`, { n })}
                </span>
              ))}
            </p>
          </div>

          <button type="button" className="btn btn--primario biblioteca__anadir" onClick={() => abrirAnadir()}>
            <IconoMas />
            {t('biblioteca.anadirJuegos')}
          </button>
        </div>
      </header>

      {/* Se despliega y se pliega en lugar de aparecer de golpe y empujar toda la página */}
      <Plegable abierto={jugandoAhora.length > 0}>
        <JugandoAhora
          juegos={jugandoAhora}
          onVerDetalle={abrirDetalle}
          onActualizar={actualizarJuego}
          onBorrar={borrarJuego}
        />
      </Plegable>

      <div className="biblioteca">
        <FiltrosBiblioteca
          juegos={juegos}
          filtros={vigentes}
          opciones={opciones}
          onCambiar={cambiarFiltro}
          onLimpiar={limpiarFiltros}
          hayFiltros={hayFiltros}
        />

        <section className="biblioteca__contenido" aria-labelledby="titulo-biblioteca">
          {/* Encima de la rejilla: el filtro (busca entre mis juegos) a la izquierda y el orden a la
              derecha; si no caben, el orden pasa debajo */}
          <div className="biblioteca__barra">
            <div className="caja-busqueda caja-busqueda--filtro">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder={t('biblioteca.filtrarJuegos')}
                aria-label={t('biblioteca.filtrarJuegos')}
              />
            </div>

            <OrdenBiblioteca
              criterio={criterio}
              direccion={direccion}
              onCambiarCriterio={cambiarCriterio}
              onInvertir={() => setDireccion(direccion === 'asc' ? 'desc' : 'asc')}
            />
          </div>

          <ul className="rejilla" ref={rejillaRef}>
            {visibles.map((juego) => (
              <JuegoGuardado
                key={juego.id}
                juego={juego}
                onActualizar={(cambios) => actualizarJuego(juego.id, cambios)}
                onBorrar={() => borrarJuego(juego.id)}
                onVerDetalle={() => abrirDetalle(juego)}
              />
            ))}
          </ul>

          {visibles.length === 0 && (
            <div className="sin-resultados">
              <h2>{t('biblioteca.sinResultadosTitulo')}</h2>
              <p>
                {t('biblioteca.sinResultadosAntes')}
                {/* Abre la ventana de añadir con lo que estaba filtrando ya escrito */}
                <button type="button" className="enlace-boton" onClick={() => abrirAnadir(consulta.trim())}>
                  {t('biblioteca.sinResultadosEnlace')}
                </button>
                {t('biblioteca.sinResultadosDespues')}
              </p>
            </div>
          )}
        </section>
      </div>

      {ventanas}
    </div>
  )
}

// El "+" de los botones de añadir
function IconoMas() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export default Biblioteca

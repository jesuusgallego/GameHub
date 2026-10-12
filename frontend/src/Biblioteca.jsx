import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import JuegoGuardado from './JuegoGuardado'
import DetalleJuego from './DetalleJuego'
import FiltrosBiblioteca from './FiltrosBiblioteca'
import OrdenBiblioteca from './OrdenBiblioteca'
import { CRITERIOS, TODOS, ordenar, filtrar, opcionesDeFiltros, filtrosVigentes } from './ordenFiltros'
import { useIdioma } from './IdiomaContext'
import { apiFetch } from './api'
import Cargando from './Cargando'
import JugandoAhora from './JugandoAhora'
import { borrarToken } from './sesion'

// Muestro los juegos que el usuario ha guardado (GET /games).
function Biblioteca({ setToken }) {
  const { t, locale } = useIdioma()
  const [juegos, setJuegos] = useState([])
  const [cargando, setCargando] = useState(true)
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

        setError(err.message)
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

  function cerrarSesion() {
    borrarToken()
    setToken("")
  }

  if (cargando) return <Cargando texto={t('biblioteca.cargando')} tamano="grande" centrado />

  if (error) return <p className="mensaje mensaje--error" role="alert">{error}</p>

  if (juegos.length === 0) {
    return (
      <div className="estado-vacio">
        <h1>{t('biblioteca.vaciaTitulo')}</h1>
        <p>{t('biblioteca.vaciaTexto')}</p>
        <Link to="/buscar" className="btn btn--primario">{t('comun.buscarJuegos')}</Link>
      </div>
    )
  }

  function abrirDetalle(juego) {
    setDetalle({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url })
  }

  // La fila de mi biblioteca del juego cuya ficha está abierta (undefined si no hay
  // ninguna o si acaba de quitarse)
  const guardadoDelDetalle = detalle && juegos.find((j) => j.igdb_id === detalle.igdb_id)

  // Valores derivados: los calculo en cada render a partir del estado para que
  // nunca queden desactualizados (así no necesitan su propio useState).
  const jugandoAhora = juegos.filter((j) => j.status === "jugando")

  const opciones = opcionesDeFiltros(juegos, locale)
  const vigentes = filtrosVigentes(filtros, opciones)
  const visibles = ordenar(filtrar(juegos, vigentes, consulta), criterio, direccion, locale)
  const hayFiltros = consulta.trim() !== "" || Object.values(vigentes).some((v) => v !== TODOS)

  return (
    <div className="biblioteca-pagina">
      {jugandoAhora.length > 0 && (
        <JugandoAhora
          juegos={jugandoAhora}
          onVerDetalle={abrirDetalle}
          onActualizar={actualizarJuego}
          onBorrar={borrarJuego}
        />
      )}

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
          <div className="biblioteca__cabecera">
            <h1 id="titulo-biblioteca" className="titulo-pagina">
              {t('biblioteca.titulo')}{" "}
              <span className="contador">
                {/* Con filtros: "12 / 48" (los que veo de los que tengo) */}
                {visibles.length === juegos.length ? juegos.length : `${visibles.length} / ${juegos.length}`}
              </span>
            </h1>

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
          </div>

          {/* Barra de orden: debajo de la cabecera y pegada a la derecha */}
          <div className="biblioteca__orden">
            <OrdenBiblioteca
              criterio={criterio}
              direccion={direccion}
              onCambiarCriterio={cambiarCriterio}
              onInvertir={() => setDireccion(direccion === 'asc' ? 'desc' : 'asc')}
            />
          </div>

          <ul className="rejilla">
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
                <Link to="/buscar">{t('biblioteca.sinResultadosEnlace')}</Link>
                {t('biblioteca.sinResultadosDespues')}
              </p>
            </div>
          )}
        </section>
      </div>

      {detalle && (
        <DetalleJuego
          key={detalle.igdb_id}
          juego={detalle}
          guardado={guardadoDelDetalle}
          onActualizar={guardadoDelDetalle && ((cambios) => actualizarJuego(guardadoDelDetalle.id, cambios))}
          onBorrar={guardadoDelDetalle && (() => borrarJuego(guardadoDelDetalle.id))}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

export default Biblioteca

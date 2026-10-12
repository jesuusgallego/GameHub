import { useState, useEffect } from 'react'
import GameCard from './GameCard'
import DetalleJuego from './DetalleJuego'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

const RETARDO_BUSQUEDA_MS = 400

function Buscar({ setToken }) {
  const { t } = useIdioma()
  const [nombreJuego, setNombreJuego] = useState("")
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState("")
  // Último término cuya búsqueda ya terminó (bien o mal). Mientras sea distinto
  // del que hay escrito, estoy buscando; así lo calculo sin un estado más que
  // tenga que poner a true dentro del efecto.
  const [terminoResuelto, setTerminoResuelto] = useState("")
  // Juegos que ya tengo guardados, en un Map (igdb_id -> fila de la biblioteca) y
  // no en un Set: así, además de saber si uno está guardado, tengo su nota y su
  // reseña para la ficha.
  const [guardados, setGuardados] = useState(new Map())
  // Juego cuya ficha está abierta (null = ninguna)
  const [detalle, setDetalle] = useState(null)

  const termino = nombreJuego.trim()
  const buscando = termino !== "" && termino !== terminoResuelto

  // Al entrar cargo mi biblioteca para marcar los juegos ya guardados. Si falla no
  // es grave: los botones salen como "Añadir" y el 409 del backend cubre el caso
  // de pulsar uno que ya tenía.
  useEffect(() => {
    let cancelado = false

    apiFetch('/games')
      .then((data) => {
        if (!cancelado) setGuardados(new Map(data.games.map((g) => [g.igdb_id, g])))
      })
      .catch((err) => {
        if (err.status === 401) {
          borrarToken()
          setToken("")
        }
      })

    return () => { cancelado = true }
  }, [setToken])

  useEffect(() => {

    if (termino === "") return

    // Debounce: espero a que el usuario deje de escribir antes de buscar. El
    // AbortController cancela la petición anterior si llega una nueva.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/games/search?q=${encodeURIComponent(termino)}`,
          { signal: controller.signal }
        )

        setResultados(data.results ?? [])
        setError("")
        setTerminoResuelto(termino)
      } catch (err) {
        if (err.name === "AbortError") return

        if (err.status === 401) {
          // Token caducado o inválido: cierro sesión y RutaProtegida me redirige al login
          borrarToken()
          setToken("")
          return
        }

        setResultados([])
        setError(err.message)
        setTerminoResuelto(termino)
      }
    }, RETARDO_BUSQUEDA_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [termino, setToken])

  // Guardo un juego en mi biblioteca. Relanzo los errores para que la GameCard los
  // muestre; solo gestiono aquí el 401 (cerrar sesión).
  async function anadirJuego(juego) {
    try {
      const data = await apiFetch('/games', {
        method: 'POST',
        body: { igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url },
      })
      // El backend devuelve la fila recién creada: la guardo tal cual
      setGuardados((prev) => new Map(prev).set(juego.igdb_id, data.game))
    } catch (err) {
      if (err.status === 401) {
        borrarToken()
        setToken("")
      }
      throw err
    }
  }

  return (
    <div className="buscar-pagina">
      <section className="banner">
        <h1 className="banner__titulo">{t('buscar.titulo')}</h1>
        <p className="banner__texto">
          {t('buscar.texto')}
        </p>

        <div className="caja-busqueda caja-busqueda--grande">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={nombreJuego}
            onChange={(e) => setNombreJuego(e.target.value)}
            placeholder={t('buscar.placeholder')}
            aria-label={t('buscar.etiqueta')}
            autoFocus
          />
        </div>
      </section>

      {!termino && (
        <p className="estado">{t('buscar.vacio')}</p>
      )}

      {buscando && <Cargando texto={t('buscar.buscando')} tamano="grande" centrado />}

      <Mensaje texto={termino && !buscando ? error : ""} />

      {termino && !buscando && !error && (
        <div className="resultados__cabecera">
          <h2 className="titulo-seccion">{t('buscar.resultadosPara', { termino })}</h2>
          <span className="estado">{t('buscar.marcados')}</span>
        </div>
      )}

      <ul className="rejilla">
        {termino && !buscando && resultados.map((juego) => (
          <GameCard
            key={juego.igdb_id}
            nombre={juego.name}
            portada={juego.cover_url}
            yaGuardado={guardados.has(juego.igdb_id)}
            onAnadir={() => anadirJuego(juego)}
            onVerDetalle={() =>
              setDetalle({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url })
            }
          />
        ))}
      </ul>

      {detalle && (
        <DetalleJuego
          key={detalle.igdb_id}
          juego={detalle}
          guardado={guardados.get(detalle.igdb_id)}
          onAnadir={() => anadirJuego(detalle)}
          onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

export default Buscar

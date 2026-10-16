import { useState, useEffect } from 'react'
import GameCard from './GameCard'
import DetalleJuego from './DetalleJuego'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Plegable from './Plegable'
import { useAnimacionLista } from './useAnimacionLista'
import { leerCacheJuegos, guardarCacheJuegos } from './cacheBiblioteca'
import { leerBusqueda, guardarBusqueda } from './cacheBusquedas'
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
  // Si ya pedí mi biblioteca en esta sesión parto de esa copia: los botones salen bien desde el
  // primer momento y no pasan de "Añadir" a "En tu biblioteca" cuando llega la respuesta.
  const [guardados, setGuardados] = useState(() => new Map((leerCacheJuegos() ?? []).map((g) => [g.igdb_id, g])))
  // Juego cuya ficha está abierta (null = ninguna)
  const [detalle, setDetalle] = useState(null)

  // Los resultados se animan al cambiar: los que siguen se deslizan, los nuevos entran uno tras
  // otro y los que sobran se desvanecen
  const rejillaRef = useAnimacionLista({ escalonar: true })

  const termino = nombreJuego.trim()
  // Un término que ya busqué se enseña al instante, sin pedirlo otra vez (cacheBusquedas.js)
  const enCache = termino ? leerBusqueda(termino) : undefined
  const buscando = termino !== "" && !enCache && termino !== terminoResuelto
  // Mientras llega una búsqueda nueva se siguen viendo los resultados de la anterior (atenuados),
  // en vez de vaciar la página a cada letra. `terminoMostrado` es el término de lo que se ve.
  const mostrados = termino ? (enCache ?? resultados) : []
  const terminoMostrado = enCache ? termino : terminoResuelto

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

    // Vacío, o ya buscado antes: no hay nada que pedir
    if (termino === "" || leerBusqueda(termino)) return

    // Debounce: espero a que el usuario deje de escribir antes de buscar. El
    // AbortController cancela la petición anterior si llega una nueva.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/games/search?q=${encodeURIComponent(termino)}`,
          { signal: controller.signal }
        )

        guardarBusqueda(termino, data.results ?? [])
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
      // Mi biblioteca guarda una copia de la lista (cacheBiblioteca.js): la mantengo al día para
      // que, al volver a ella, el juego nuevo ya esté
      const copia = leerCacheJuegos()
      if (copia) guardarCacheJuegos([data.game, ...copia.filter((j) => j.id !== data.game.id)])
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

      {/* Cada bloque se pliega y se despliega en lugar de aparecer de golpe: así nada de lo que
          hay debajo salta cuando cambia lo de encima. El hueco entre bloques va dentro de ellos. */}
      <div className="buscar-zona" style={{ '--plegable-hueco': '1.75rem' }}>
        <Plegable abierto={!termino}>
          <p className="estado">{t('buscar.vacio')}</p>
        </Plegable>

        <Plegable abierto={buscando && mostrados.length === 0}>
          <Cargando texto={t('buscar.buscando')} tamano="grande" centrado />
        </Plegable>

        <Plegable abierto={Boolean(termino && !buscando && error)}>
          <p className="mensaje mensaje--error" role="alert">{error}</p>
        </Plegable>

        <Plegable abierto={Boolean(termino && terminoMostrado && !error && (mostrados.length > 0 || buscando))} hueco="1.25rem">
          <div className="resultados__cabecera">
            <h2 className="titulo-seccion">{t('buscar.resultadosPara', { termino: terminoMostrado })}</h2>
            {buscando ? (
              <span className="estado resultados__buscando" role="status">
                <Cargando tamano="pequeno" />
                {t('buscar.buscando')}
              </span>
            ) : (
              <span className="estado">{t('buscar.marcados')}</span>
            )}
          </div>
        </Plegable>

        <Plegable abierto={Boolean(termino && !buscando && !error && mostrados.length === 0)}>
          <p className="estado">{t('buscar.sinResultados', { termino })}</p>
        </Plegable>

        <ul className={buscando ? "rejilla rejilla--buscando" : "rejilla"} ref={rejillaRef} aria-busy={buscando}>
          {mostrados.map((juego) => (
            <GameCard
              key={juego.igdb_id}
              clave={juego.igdb_id}
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
      </div>

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

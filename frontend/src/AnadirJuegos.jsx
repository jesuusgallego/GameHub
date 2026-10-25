import { useState, useEffect, useRef } from 'react'
import GameCard from './GameCard'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Plegable from './Plegable'
import { useAnimacionLista } from './useAnimacionLista'
import { useVentana } from './useVentana'
import { leerBusqueda, guardarBusqueda } from './cacheBusquedas'
import { useIdioma } from './IdiomaContext'

const RETARDO_BUSQUEDA_MS = 400

// La ventana "Añadir juegos" de Mi biblioteca: busca en el catálogo de IGDB y guarda juegos sin salir
// de la biblioteca (antes era la página Buscar). Al cerrarla, los que añadiste ya están en la rejilla
// de detrás, porque quien guarda es la Biblioteca (onAnadir).
//  - guardados: Map igdb_id -> fila de la biblioteca, para marcar los que ya tienes
//  - terminoInicial: lo que sale escrito al abrir (por ejemplo, lo que filtrabas sin encontrarlo)
//  - onAnadir(juego): lo guarda en la biblioteca; si falla, lanza el error (lo enseña la tarjeta)
//  - onVerDetalle(juego): abre la ficha. La abre la Biblioteca, no esta ventana: así son dos
//    ventanas hermanas, y Esc o un clic fuera cierran solo la de arriba.
//  - onCerrar(): ya ha terminado la animación de salida
//  - cerrarSesion(): el token ha caducado (401)
function AnadirJuegos({ guardados, terminoInicial = '', onAnadir, onVerDetalle, onCerrar, cerrarSesion }) {
  const { t } = useIdioma()
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const { saliendo, cerrar, alCancelar } = useVentana(onCerrar)
  const [nombreJuego, setNombreJuego] = useState(terminoInicial)
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  // Último término cuya búsqueda ya terminó (bien o mal). Mientras sea distinto del que hay
  // escrito, estoy buscando; así lo calculo sin un estado más que tenga que poner a true dentro
  // del efecto.
  const [terminoResuelto, setTerminoResuelto] = useState('')

  // Los resultados se animan al cambiar: los que siguen se deslizan, los nuevos entran uno tras
  // otro y los que sobran se desvanecen
  const rejillaRef = useAnimacionLista({ escalonar: true })

  const termino = nombreJuego.trim()
  // Un término que ya busqué se enseña al instante, sin pedirlo otra vez (cacheBusquedas.js)
  const enCache = termino ? leerBusqueda(termino) : undefined
  const buscando = termino !== '' && !enCache && termino !== terminoResuelto
  // Mientras llega una búsqueda nueva se siguen viendo los resultados de la anterior (atenuados),
  // en vez de vaciar la ventana a cada letra. `terminoMostrado` es el término de lo que se ve.
  const mostrados = termino ? (enCache ?? resultados) : []
  const terminoMostrado = enCache ? termino : terminoResuelto

  // <dialog> es la ventana modal nativa: showModal() la abre encima de todo. Al abrirse, el navegador
  // pone el foco en lo primero que se puede pulsar (la ✕), así que después lo llevo al buscador: se
  // abre para escribir. (autoFocus no vale aquí: React lo aplica antes de showModal.)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    inputRef.current.focus()
  }, [])

  useEffect(() => {
    // Vacío, o ya buscado antes: no hay nada que pedir
    if (termino === '' || leerBusqueda(termino)) return

    // Debounce: espero a que deje de escribir antes de buscar. El AbortController cancela la
    // petición anterior si llega una nueva.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/games/search?q=${encodeURIComponent(termino)}`, { signal: controller.signal })
        guardarBusqueda(termino, data.results ?? [])
        setResultados(data.results ?? [])
        setError('')
        setTerminoResuelto(termino)
      } catch (err) {
        if (err.name === 'AbortError') return
        if (err.status === 401) return cerrarSesion()
        setResultados([])
        setError(err.message)
        setTerminoResuelto(termino)
      }
    }, RETARDO_BUSQUEDA_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [termino, cerrarSesion])

  return (
    <dialog
      ref={dialogRef}
      className={saliendo ? 'dialogo anadir-juegos ventana--saliendo' : 'dialogo anadir-juegos'}
      aria-labelledby="anadir-juegos-titulo"
      onCancel={alCancelar}
      onClose={onCerrar}
      // Un clic en el fondo oscuro (que cuenta como parte del <dialog>) la cierra
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}
    >
      <header className="anadir-juegos__cabecera">
        <div>
          <h2 id="anadir-juegos-titulo" className="dialogo__titulo">{t('anadir.titulo')}</h2>
          <p className="dialogo__mensaje">{t('anadir.texto')}</p>
        </div>
        <button type="button" className="chat-nuevo__cerrar" aria-label={t('comun.cerrar')} onClick={() => cerrar()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="caja-busqueda caja-busqueda--grande anadir-juegos__caja">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={nombreJuego}
          onChange={(e) => setNombreJuego(e.target.value)}
          // Esc en el buscador solo lo vacía; con él vacío, cierra la ventana (lo normal)
          onKeyDown={(e) => { if (e.key === 'Escape' && nombreJuego) { e.preventDefault(); setNombreJuego('') } }}
          placeholder={t('buscar.placeholder')}
          aria-label={t('buscar.etiqueta')}
        />
      </div>

      {/* Cada bloque se pliega y se despliega en lugar de aparecer de golpe: así nada de lo que
          hay debajo salta cuando cambia lo de encima. El hueco entre bloques va dentro de ellos. */}
      <div className="anadir-juegos__cuerpo buscar-zona" style={{ '--plegable-hueco': '1.25rem' }}>
        <Plegable abierto={!termino}>
          <p className="estado">{t('buscar.vacio')}</p>
        </Plegable>

        <Plegable abierto={buscando && mostrados.length === 0}>
          <Cargando texto={t('buscar.buscando')} tamano="grande" centrado />
        </Plegable>

        <Plegable abierto={Boolean(termino && !buscando && error)}>
          <p className="mensaje mensaje--error" role="alert">{error}</p>
        </Plegable>

        <Plegable abierto={Boolean(termino && terminoMostrado && !error && (mostrados.length > 0 || buscando))} hueco="1rem">
          <div className="resultados__cabecera">
            <h3 className="titulo-seccion">{t('buscar.resultadosPara', { termino: terminoMostrado })}</h3>
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

        <ul className={buscando ? 'rejilla rejilla--buscando' : 'rejilla'} ref={rejillaRef} aria-busy={buscando}>
          {mostrados.map((juego) => (
            <GameCard
              key={juego.igdb_id}
              clave={juego.igdb_id}
              nombre={juego.name}
              portada={juego.cover_url}
              yaGuardado={guardados.has(juego.igdb_id)}
              onAnadir={() => onAnadir(juego)}
              onVerDetalle={() => onVerDetalle({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url })}
            />
          ))}
        </ul>
      </div>
    </dialog>
  )
}

export default AnadirJuegos

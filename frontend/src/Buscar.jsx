import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameCard from './GameCard'
import DetalleJuego from './DetalleJuego'
import FondoCabecera from './FondoCabecera'
import { apiFetch } from './api'
import Cargando from './Cargando'
import Plegable from './Plegable'
import { useAnimacionLista } from './useAnimacionLista'
import { useBusquedaIgdb } from './useBusquedaIgdb'
import { busquedasRecientes } from './cacheBusquedas'
import { leerCacheJuegos, guardarCacheJuegos } from './cacheBiblioteca'
import { useIdioma } from './IdiomaContext'
import { borrarToken } from './sesion'

// Lo último que se buscó, mientras la app está abierta: al volver a la pestaña Buscar sigue ahí,
// como en las apps del móvil (cada pestaña recuerda dónde la dejaste)
let ultimoTermino = ''

// La pestaña Buscar del menú: busca en el catálogo de IGDB y guarda juegos en tu biblioteca. Lo que
// se busca va en la URL (/buscar?q=zelda): otras páginas pueden traer aquí con algo ya escrito (el
// "busca juegos nuevos" de Mi biblioteca), y al volver atrás desde una página sigue la búsqueda.
// La ficha de un resultado se abre encima y también deja añadirlo.
function Buscar({ setToken }) {
  const { t } = useIdioma()
  const [params, setParams] = useSearchParams()
  const [texto, setTexto] = useState(() => params.get('q') ?? ultimoTermino)
  const inputRef = useRef(null)
  // Juegos que ya tengo, por su id de IGDB (igdb_id -> fila de la biblioteca), para marcarlos en los
  // resultados y que la ficha enseñe mi nota. Parto de la copia de Mi biblioteca si ya la pedí en
  // esta sesión: así los botones salen bien desde el principio.
  const [guardados, setGuardados] = useState(() => new Map((leerCacheJuegos() ?? []).map((g) => [g.igdb_id, g])))
  const [detalle, setDetalle] = useState(null)
  // Los resultados se animan al cambiar: los que siguen se deslizan, los nuevos entran uno tras
  // otro y los que sobran se desvanecen
  const rejillaRef = useAnimacionLista({ escalonar: true })

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setToken('')
  }, [setToken])

  const { termino, buscando, mostrados, terminoMostrado, error } = useBusquedaIgdb(texto, cerrarSesion)

  // Si otra página trae aquí con algo distinto escrito (?q=), se busca eso. Ajustar el estado
  // mientras se pinta, comparando con el valor anterior, es lo que recomienda React para esto (sin
  // un efecto que pinte dos veces).
  const qUrl = params.get('q')
  const [qAnterior, setQAnterior] = useState(qUrl)
  if (qUrl !== qAnterior) {
    setQAnterior(qUrl)
    if (qUrl !== null && qUrl !== texto.trim()) setTexto(qUrl)
  }

  // Lo escrito pasa a la URL (sin añadir una entrada al historial por cada letra) y se recuerda
  useEffect(() => {
    ultimoTermino = texto
    const q = texto.trim()
    if ((params.get('q') ?? '') === q) return
    setParams(q ? { q } : {}, { replace: true })
  }, [texto, params, setParams])

  // En el ordenador, al entrar ya se puede escribir. En una pantalla táctil no: el teclado taparía
  // la mitad de la pantalla sin haberlo pedido (y iOS no lo deja abrir sin un toque).
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
  }, [])

  // Mi biblioteca, para marcar los que ya tengo. Si falla no es grave: los botones salen como
  // "Añadir" y, si pulsas uno que ya tenías, el backend responde 409 y la tarjeta lo dice.
  useEffect(() => {
    let cancelado = false
    apiFetch('/games')
      .then((data) => {
        if (!cancelado) setGuardados(new Map(data.games.map((g) => [g.igdb_id, g])))
      })
      .catch((err) => {
        if (!cancelado && err.status === 401) cerrarSesion()
      })
    return () => { cancelado = true }
  }, [cerrarSesion])

  // Guardo un juego en mi biblioteca. Relanzo el error para que lo enseñe el botón que lo pidió.
  async function anadirJuego(juego) {
    try {
      const data = await apiFetch('/games', {
        method: 'POST',
        body: { igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url },
      })
      setGuardados((prev) => new Map(prev).set(juego.igdb_id, data.game))
      // Mi biblioteca guarda una copia de la lista (cacheBiblioteca.js): la mantengo al día para que,
      // al ir a ella, el juego nuevo ya esté (el primero, como lo último añadido)
      const copia = leerCacheJuegos()
      if (copia) guardarCacheJuegos([data.game, ...copia.filter((j) => j.id !== data.game.id)])
    } catch (err) {
      if (err.status === 401) cerrarSesion()
      throw err
    }
  }

  // Sin nada escrito: las últimas búsquedas de esta sesión, para repetirlas de un toque
  const recientes = termino ? [] : busquedasRecientes()
  // Las fotos de la escena de la cabecera: las portadas de lo que se ve; si aún no hay resultados,
  // las de mi biblioteca
  const portadas = [...mostrados, ...guardados.values()].map((j) => j.cover_url).filter(Boolean).slice(0, 5)

  return (
    <div className="buscar-pagina">
      <header className="banner-perfil buscar__cabecera">
        <FondoCabecera estilo="buscar" imagenes={portadas} />
        <div className="buscar__cabecera-contenido">
          <h1 className="titulo-pagina">{t('buscar.titulo')}</h1>
          <p className="buscar__texto">{t('buscar.texto')}</p>

          <div className="caja-busqueda caja-busqueda--grande buscar__caja">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              // Esc vacía el buscador
              onKeyDown={(e) => { if (e.key === 'Escape' && texto) { e.preventDefault(); setTexto('') } }}
              placeholder={t('buscar.placeholder')}
              aria-label={t('buscar.etiqueta')}
              enterKeyHint="search"
            />
          </div>
        </div>
      </header>

      {/* Cada bloque se pliega y se despliega en lugar de aparecer de golpe: así nada de lo que
          hay debajo salta cuando cambia lo de encima. El hueco entre bloques va dentro de ellos. */}
      <div className="buscar-zona" style={{ '--plegable-hueco': '1.5rem' }}>
        <Plegable abierto={!termino}>
          <div className="buscar__inicio">
            {recientes.length > 0 ? (
              <>
                <h2 className="buscar__subtitulo">{t('buscar.recientes')}</h2>
                <div className="buscar__recientes">
                  {recientes.map((r) => (
                    <button key={r.termino} type="button" className="buscar__reciente" onClick={() => setTexto(r.termino)}>
                      {r.portada
                        ? <img src={r.portada} alt="" loading="lazy" />
                        : <span className="buscar__reciente-icono" aria-hidden="true" />}
                      {r.termino}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="estado">{t('buscar.vacio')}</p>
            )}
          </div>
        </Plegable>

        <Plegable abierto={buscando && mostrados.length === 0}>
          <Cargando texto={t('buscar.buscando')} tamano="grande" centrado />
        </Plegable>

        <Plegable abierto={Boolean(error)}>
          <p className="mensaje mensaje--error" role="alert">{error}</p>
        </Plegable>

        <Plegable abierto={Boolean(termino && terminoMostrado && !error && (mostrados.length > 0 || buscando))} hueco="1rem">
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

        <ul className={buscando ? 'rejilla rejilla--buscando' : 'rejilla'} ref={rejillaRef} aria-busy={buscando}>
          {mostrados.map((juego) => (
            <GameCard
              key={juego.igdb_id}
              clave={juego.igdb_id}
              nombre={juego.name}
              portada={juego.cover_url}
              yaGuardado={guardados.has(juego.igdb_id)}
              onAnadir={() => anadirJuego(juego)}
              onVerDetalle={() => setDetalle({ igdb_id: juego.igdb_id, name: juego.name, cover_url: juego.cover_url })}
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

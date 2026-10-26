import { useState, useEffect } from 'react'
import { apiFetch } from './api'
import { leerBusqueda, guardarBusqueda } from './cacheBusquedas'

const RETARDO_BUSQUEDA_MS = 400

// Busca juegos en el catálogo de IGDB (GET /games/search) mientras se escribe. Lo usa la página
// Buscar (Buscar.jsx).
//  - Espera a que dejes de escribir (400 ms) antes de pedir nada, y cancela la petición anterior si
//    escribes otra cosa antes de que llegue (AbortController).
//  - Un término que ya buscaste en esta sesión sale al instante, sin pedirlo (cacheBusquedas.js).
//  - Mientras llega una búsqueda nueva siguen viéndose los resultados de la anterior, en vez de
//    vaciar la rejilla a cada letra.
// Recibe lo escrito y qué hacer si la sesión ha caducado (401). Devuelve:
//  - termino: lo escrito, sin espacios a los lados
//  - buscando: hay una búsqueda en camino
//  - mostrados: los resultados que se ven ahora
//  - terminoMostrado: el término al que corresponden esos resultados
//  - error: el mensaje del último fallo ('' si no lo hubo)
export function useBusquedaIgdb(texto, alCaducar) {
  const [resultados, setResultados] = useState([])
  const [error, setError] = useState('')
  // Último término cuya búsqueda ya terminó (bien o mal). Mientras sea distinto del que hay
  // escrito, estoy buscando; así lo calculo sin un estado más que tenga que poner a true dentro
  // del efecto.
  const [terminoResuelto, setTerminoResuelto] = useState('')

  const termino = texto.trim()
  const enCache = termino ? leerBusqueda(termino) : undefined
  const buscando = termino !== '' && !enCache && termino !== terminoResuelto
  const mostrados = termino ? (enCache ?? resultados) : []
  const terminoMostrado = enCache ? termino : terminoResuelto

  useEffect(() => {
    // Vacío, o ya buscado antes: no hay nada que pedir
    if (termino === '' || leerBusqueda(termino)) return

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
        if (err.status === 401) return alCaducar()
        setResultados([])
        setError(err.message)
        setTerminoResuelto(termino)
      }
    }, RETARDO_BUSQUEDA_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [termino, alCaducar])

  return { termino, buscando, mostrados, terminoMostrado, error: termino && !buscando && !enCache ? error : '' }
}

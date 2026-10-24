import { useEffect, useRef, useCallback, useState } from 'react'
import { apiFetch } from './api'
import { crearCola } from './logicaNoticias'

// Lo que pasa con las noticias que se enseñan, para el recomendador (ver news_events en
// schema.sql): una "impresión" cuando una tarjeta ha estado a la vista (al menos la mitad) durante
// un segundo, y un "clic" al abrirla. Se mandan por tandas cada pocos segundos, al ocultar la
// pestaña y al salir de la página. Con `keepalive`, la petición termina aunque la página se cierre
// (al pulsar una noticia se abre otra pestaña o el navegador, y esta puede quedarse atrás).
//
// Por qué "un segundo a la vista" y no "llegó del servidor": para entrenar hace falta saber qué
// noticias vio de verdad la persona y no pulsó. Una tarjeta que pasó volando al desplazar no
// cuenta como vista.
//
// Si la personalización está apagada, el servidor no guarda nada (y la interfaz ni lo manda).
//  - activo: si se registra
//  - idioma: va con la tanda (con él se calculan las señales si ya no están en memoria)
// Devuelve { observar(noticia, feed, posicion) -> ref, clic(noticia, feed, posicion) }
const CADA_MS = 5000
const VISTA_MS = 1000

export function useEventosNoticias({ activo, idioma }) {
  // La cola se crea una sola vez (useState con una función: solo la llama en el primer pintado)
  const [cola] = useState(crearCola)
  // Qué noticia hay en cada elemento observado, y los relojes de "lleva un segundo a la vista"
  const datosRef = useRef(new Map())
  const relojesRef = useRef(new Map())
  const observadorRef = useRef(null)
  const activoRef = useRef(activo)
  const idiomaRef = useRef(idioma)
  useEffect(() => { activoRef.current = activo; idiomaRef.current = idioma }, [activo, idioma])

  const enviar = useCallback(() => {
    while (cola.pendientes > 0) {
      const tanda = cola.tomar()
      if (!activoRef.current) continue
      apiFetch('/news/events', {
        method: 'POST', body: { events: tanda, lang: idiomaRef.current }, keepalive: true, avisoLento: false,
      }).catch(() => {})
    }
  }, [cola])

  // El observador de "está a la vista". Se crea al primer uso y no en un efecto: React llama a los
  // `ref` de las tarjetas ANTES que a los efectos, así que en el primer pintado aún no existiría.
  const obtenerObservador = useCallback(() => {
    if (observadorRef.current) return observadorRef.current
    const relojes = relojesRef.current
    observadorRef.current = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        const datos = datosRef.current.get(e.target)
        if (!datos) continue
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (relojes.has(e.target)) continue
          relojes.set(e.target, setTimeout(() => {
            relojes.delete(e.target)
            cola.impresion(datos.noticia, datos.feed, datos.posicion)
          }, VISTA_MS))
        } else {
          clearTimeout(relojes.get(e.target))
          relojes.delete(e.target)
        }
      }
    }, { threshold: [0, 0.5] })
    return observadorRef.current
  }, [cola])

  useEffect(() => {
    const relojes = relojesRef.current
    // Al volver a montar (en desarrollo, React monta, desmonta y vuelve a montar los efectos) se
    // vuelven a observar las tarjetas que ya estaban
    for (const el of datosRef.current.keys()) {
      if (el.isConnected) obtenerObservador().observe(el)
      else datosRef.current.delete(el)
    }
    const intervalo = setInterval(enviar, CADA_MS)
    const alOcultar = () => { if (document.visibilityState === 'hidden') enviar() }
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      observadorRef.current?.disconnect()
      observadorRef.current = null
      for (const r of relojes.values()) clearTimeout(r)
      relojes.clear()
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alOcultar)
      enviar()
    }
  }, [enviar, obtenerObservador])

  // Para el `ref` de cada tarjeta: la empieza a observar (y deja de hacerlo al quitarla)
  const observar = useCallback((noticia, feed, posicion) => (el) => {
    if (!el) return
    // Las tarjetas que ya no están en la página se olvidan (para que la lista no crezca sin fin)
    if (datosRef.current.size > 400) {
      for (const viejo of datosRef.current.keys()) if (!viejo.isConnected) datosRef.current.delete(viejo)
    }
    datosRef.current.set(el, { noticia, feed, posicion })
    obtenerObservador().observe(el)
  }, [obtenerObservador])

  const clic = useCallback((noticia, feed, posicion) => {
    cola.clic(noticia, feed, posicion)
    enviar()
  }, [cola, enviar])

  return { observar, clic }
}

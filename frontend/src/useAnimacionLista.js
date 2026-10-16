import { useRef, useLayoutEffect, useEffect } from 'react'

// Anima una lista (una rejilla de tarjetas) cuando cambia: filtrar, ordenar, buscar, añadir o quitar.
// Sin esto, las tarjetas que se quedan saltan de golpe a su sitio nuevo y las que sobran
// desaparecen sin más. La técnica se llama FLIP (First, Last, Invert, Play):
//  1. Lo que ya estaba y cambia de sitio: se mide dónde estaba y dónde está ahora, y se anima el
//     desplazamiento desde el sitio viejo al nuevo (con transform, que anima la tarjeta gráfica).
//  2. Lo que entra: aparece con un fundido y un pequeño zoom.
//  3. Lo que sale: React ya lo ha quitado, así que se deja una copia ("fantasma") en su sitio que se
//     desvanece y se borra al terminar.
//
// Uso: const ref = useAnimacionLista(); <ul ref={ref}>…<li data-clave={juego.id}>…</li></ul>
//  - El contenedor tiene que ser `position: relative` (los fantasmas se colocan dentro).
//  - Cada hijo lleva `data-clave` con un valor único y estable (el id).
//  - La primera vez que aparece la lista no se anima nada (de eso se encarga la entrada de la página).
//  - Con "reducir movimiento" del sistema no se anima nada (las animaciones de la Web Animations
//    API no las apaga el CSS, así que se comprueba aquí).
const MOVER_MS = 340
const ENTRAR_MS = 260
const SALIR_MS = 200
// Si cambia casi todo (una lista enorme), animar cientos de elementos a la vez sería peor que nada
const MAX_ANIMADOS = 120
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

// Los hijos reales de la lista (sin los fantasmas), con su sitio dentro del contenedor. offsetLeft
// y offsetTop no cuentan las transformaciones en curso: son el sitio donde ha quedado cada uno.
function medir(contenedor) {
  const mapa = new Map()
  for (const el of contenedor.children) {
    if (el.dataset.clave === undefined) continue
    mapa.set(el.dataset.clave, { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, nodo: el })
  }
  return mapa
}

// Lo que lleva desplazado ahora mismo una tarjeta por una animación nuestra que no ha terminado.
// Si se pulsa otro filtro a mitad de camino, la nueva animación sale de donde está la tarjeta
// ahora, no de donde estaba antes de empezar (sería un salto).
function desplazamientoEnCurso(el) {
  const animacion = el.getAnimations().find((a) => a.id === 'lista-mover')
  if (!animacion) return { x: 0, y: 0 }
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return { x: m.m41, y: m.m42 }
}

export function useAnimacionLista() {
  const ref = useRef(null)
  const previas = useRef(new Map())

  // Después de cada pintado: compara con cómo estaba la lista la vez anterior
  useLayoutEffect(() => {
    const contenedor = ref.current
    if (!contenedor) {
      previas.current = new Map()
      return
    }

    const ahora = medir(contenedor)
    const antes = previas.current
    previas.current = ahora

    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sinMovimiento || antes.size === 0 || ahora.size + antes.size > MAX_ANIMADOS * 2) return

    for (const [clave, actual] of ahora) {
      const previa = antes.get(clave)

      if (!previa) {
        actual.nodo.animate(
          [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: ENTRAR_MS, easing: CURVA, id: 'lista-entrar' }
        )
        continue
      }

      const curso = desplazamientoEnCurso(actual.nodo)
      const dx = previa.x + curso.x - actual.x
      const dy = previa.y + curso.y - actual.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue

      actual.nodo.getAnimations().filter((a) => a.id === 'lista-mover').forEach((a) => a.cancel())
      actual.nodo.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: MOVER_MS, easing: CURVA, id: 'lista-mover' }
      )
    }

    // Lo que ya no está: una copia que se desvanece donde estaba
    for (const [clave, previa] of antes) {
      if (ahora.has(clave)) continue
      const fantasma = previa.nodo.cloneNode(true)
      fantasma.removeAttribute('data-clave')
      fantasma.setAttribute('aria-hidden', 'true')
      fantasma.inert = true
      Object.assign(fantasma.style, {
        position: 'absolute', left: `${previa.x}px`, top: `${previa.y}px`,
        width: `${previa.w}px`, height: `${previa.h}px`, margin: '0', pointerEvents: 'none', zIndex: '0',
      })
      contenedor.appendChild(fantasma)
      fantasma.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.92)' }],
        { duration: SALIR_MS, easing: 'ease-in', fill: 'forwards' }
      ).finished.then(() => fantasma.remove(), () => fantasma.remove())
    }
  })

  // Si cambia el tamaño de la lista por otra causa (se redimensiona la ventana y cambian las
  // columnas), pongo al día dónde está cada tarjeta SIN animar. Si no, el siguiente filtro
  // compararía con un reparto de columnas que ya no existe y las tarjetas saldrían volando.
  useEffect(() => {
    const contenedor = ref.current
    if (!contenedor) return undefined
    const observador = new ResizeObserver(() => {
      if (ref.current) previas.current = medir(ref.current)
    })
    observador.observe(contenedor)
    return () => observador.disconnect()
  })

  return ref
}

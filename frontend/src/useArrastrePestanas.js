import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Lo que hay que mover el dedo (en píxeles) para que cuente como arrastre y no como un toque
const UMBRAL = 8

// Cambiar de sección arrastrando el dedo por la barra de pestañas de abajo (la de la app instalada
// en el iPhone, ver estilos/cristal-ios.css), como en Instagram o en las apps de iOS 26: pones el
// dedo, lo deslizas, la lente lo sigue y, al soltar, vas a la pestaña que tengas debajo.
//  - navRef: la <nav> con los enlaces (cada uno con data-to="/ruta")
//  - lineaRef: la lente (la "línea" de la pestaña activa; su posición va en --x y su ancho en --ancho)
// Solo actúa con el dedo (no con el ratón) y cuando la barra es la de abajo (position: fixed): en
// la barra de arriba del ordenador no hace nada. Un toque normal sigue siendo un clic en el enlace.
export function useArrastrePestanas(navRef, lineaRef) {
  const navigate = useNavigate()

  useEffect(() => {
    const nav = navRef.current
    const linea = lineaRef.current
    // El gesto en curso: qué dedo, dónde empezó y si ya es un arrastre
    let gesto = null

    const enlaces = () => [...nav.querySelectorAll('a[data-to]')]

    // La pestaña cuyo centro queda más cerca del dedo
    function enlaceMasCercano(x) {
      let mejor = null
      let distancia = Infinity
      for (const enlace of enlaces()) {
        const caja = enlace.getBoundingClientRect()
        const d = Math.abs(x - (caja.left + caja.width / 2))
        if (d < distancia) {
          distancia = d
          mejor = enlace
        }
      }
      return mejor
    }

    // La lente, centrada bajo el dedo, sin salirse de la primera ni de la última pestaña. --x se
    // mide desde el borde interior de la barra (como offsetLeft), de ahí el clientLeft (el borde).
    function seguirDedo(x) {
      const lista = enlaces()
      const ancho = linea.offsetWidth
      const origen = nav.getBoundingClientRect().left + nav.clientLeft
      const minimo = lista[0].offsetLeft
      const maximo = lista.at(-1).offsetLeft + lista.at(-1).offsetWidth - ancho
      const izquierda = Math.min(maximo, Math.max(minimo, x - origen - ancho / 2))
      linea.style.setProperty('--x', `${izquierda}px`)
      // La pestaña que hay debajo se enciende, para saber a dónde vas a ir al soltar
      const debajo = enlaceMasCercano(x)
      lista.forEach((enlace) => enlace.classList.toggle('bajo-el-dedo', enlace === debajo))
    }

    function terminar() {
      nav.classList.remove('barra__nav--arrastrando')
      enlaces().forEach((enlace) => enlace.classList.remove('bajo-el-dedo'))
      gesto = null
    }

    // La lente vuelve a la pestaña indicada (se desliza: la clase del arrastre ya no está)
    function lenteA(enlace) {
      if (!enlace) return
      linea.style.setProperty('--x', `${enlace.offsetLeft}px`)
      linea.style.setProperty('--ancho', `${enlace.offsetWidth}px`)
    }

    // Tras un arrastre, el navegador puede lanzar además un clic sobre la barra: no debe contar
    function anularClic(e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function alBajar(e) {
      if (e.pointerType === 'mouse' || getComputedStyle(nav).position !== 'fixed') return
      gesto = { id: e.pointerId, x0: e.clientX, arrastrando: false }
    }

    function alMover(e) {
      if (!gesto || e.pointerId !== gesto.id) return
      if (!gesto.arrastrando) {
        if (Math.abs(e.clientX - gesto.x0) < UMBRAL) return
        gesto.arrastrando = true
        // A partir de aquí, el dedo es de la barra aunque se salga de ella
        nav.setPointerCapture(e.pointerId)
        nav.classList.add('barra__nav--arrastrando')
      }
      seguirDedo(e.clientX)
    }

    function alSoltar(e) {
      if (!gesto || e.pointerId !== gesto.id) return
      if (!gesto.arrastrando) {
        terminar()
        return
      }
      const destino = enlaceMasCercano(e.clientX)
      terminar()
      lenteA(destino)
      nav.addEventListener('click', anularClic, { capture: true, once: true })
      setTimeout(() => nav.removeEventListener('click', anularClic, { capture: true }), 400)
      if (destino && !destino.classList.contains('active')) navigate(destino.dataset.to)
    }

    // El sistema se queda con el gesto (llega una llamada, etc.): la lente vuelve a su sitio
    function alCancelar(e) {
      if (!gesto || e.pointerId !== gesto.id) return
      const eraArrastre = gesto.arrastrando
      terminar()
      if (eraArrastre) lenteA(nav.querySelector('a.active'))
    }

    nav.addEventListener('pointerdown', alBajar)
    nav.addEventListener('pointermove', alMover)
    nav.addEventListener('pointerup', alSoltar)
    nav.addEventListener('pointercancel', alCancelar)
    return () => {
      nav.removeEventListener('pointerdown', alBajar)
      nav.removeEventListener('pointermove', alMover)
      nav.removeEventListener('pointerup', alSoltar)
      nav.removeEventListener('pointercancel', alCancelar)
      nav.removeEventListener('click', anularClic, { capture: true })
    }
  }, [navRef, lineaRef, navigate])
}

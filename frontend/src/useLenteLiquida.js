import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// La "lente" de la barra de pestañas de abajo (la de la app instalada en el iPhone, ver
// estilos/cristal-ios.css): la gota de cristal que marca la pestaña activa y que se puede arrastrar
// con el dedo de una pestaña a otra, como en Instagram o en las apps de iOS 26.
//
// Cómo se mueve: con un MUELLE simulado fotograma a fotograma (requestAnimationFrame), en lugar de
// transiciones de CSS. Cada valor (posición, ancho, cuánto se hincha) tiene un objetivo y una
// velocidad; en cada fotograma un muelle tira de él hacia su objetivo y un rozamiento lo frena. Así
// el movimiento es continuo aunque el objetivo cambie a mitad de camino (el dedo se mueve, sueltas,
// cambias de página): nunca salta, siempre parte de donde está y con la velocidad que llevaba.
//
// Los valores se escriben como variables en la <nav> (--lx, --lw, --lgx, --lgy) y el CSS dibuja con
// ellas la lente Y la capa de color de dentro (.barra__tinta: los mismos iconos en color de acento,
// recortados con la forma de la lente). Por eso hay UN solo selector: un icono a medio tapar por la
// lente se ve medio coloreado, y el color viaja con ella.
//
// Gestos (solo con el dedo y solo en la barra de abajo; en la de arriba del ordenador no hace nada):
//  - un toque: es un clic normal en el enlace (la lente va luego a la página nueva);
//  - arrastrar: la lente sigue al dedo, se hincha un poco y se estira según la velocidad; al soltar
//    se desliza hasta la pestaña más cercana y se abre esa página.
//  - navRef: la <nav> (sus enlaces llevan data-to="/ruta")
//  - pathname: la ruta actual (al cambiar, la lente va a la pestaña activa)

// Lo que hay que mover el dedo (en píxeles) para que cuente como arrastre y no como un toque
const UMBRAL = 8
// Rigidez del muelle: más alta, más rápido llega. Al arrastrar va casi pegada al dedo; al soltar o
// al cambiar de página, un poco más suelta, para que se vea deslizarse.
const RIGIDEZ_DEDO = 1100
const RIGIDEZ_LIBRE = 320
// Rozamiento, en proporción al "justo" para no pasarse (1). Un poco menos de 1: un rebote mínimo,
// que da sensación de líquido sin que la lente se salga de su sitio.
const AMORTIGUACION = 0.86
// Cuánto se hincha la lente al ponerle el dedo encima (px por cada lado) y cuánto se estira de más,
// como mucho, cuando el dedo va rápido
const HINCHADO_X = 5
const HINCHADO_Y = 3
const ESTIRON_MAX = 9

export function useLenteLiquida(navRef, pathname) {
  // navigate cambia en cada cambio de página (React Router da una función nueva): si fuera una
  // dependencia del efecto, el motor se reiniciaría al navegar y la lente saltaría de golpe a su
  // sitio en vez de deslizarse. La guardo en una referencia y el motor se crea una sola vez.
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])
  // irA(enlace, saltar): lo usa el efecto de la ruta para mover la lente a la pestaña activa
  const motorRef = useRef(null)

  useEffect(() => {
    const nav = navRef.current
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)')
    const esBarraDeAbajo = () => getComputedStyle(nav).position === 'fixed'
    const enlaces = () => [...nav.querySelectorAll('a[data-to]')]

    // Cada valor: dónde está (v), a qué velocidad va (vel) y a dónde quiere ir (obj)
    const valores = {
      lx: { v: 0, vel: 0, obj: 0 }, // borde izquierdo (px desde el borde interior de la barra)
      lw: { v: 0, vel: 0, obj: 0 }, // ancho
      lgx: { v: 0, vel: 0, obj: 0 }, // hinchado/estirado a cada lado
      lgy: { v: 0, vel: 0, obj: 0 }, // hinchado hacia arriba y abajo
    }
    let rigidez = RIGIDEZ_LIBRE
    let fotograma = 0
    let ultimoTiempo = 0
    let colocada = false

    function pintar() {
      for (const [nombre, valor] of Object.entries(valores)) nav.style.setProperty(`--${nombre}`, `${valor.v.toFixed(2)}px`)
    }

    // Que la lente no se salga de la primera ni de la última pestaña
    function limites() {
      const lista = enlaces()
      return { minimo: lista[0].offsetLeft, maximo: lista.at(-1).offsetLeft + lista.at(-1).offsetWidth }
    }

    function paso(tiempo) {
      // Segundos desde el fotograma anterior (con tope, por si la pestaña estuvo en segundo plano)
      const dt = Math.min(0.032, (tiempo - ultimoTiempo) / 1000 || 0.016)
      ultimoTiempo = tiempo
      const rozamiento = 2 * Math.sqrt(rigidez) * AMORTIGUACION
      let quieto = true
      for (const valor of Object.values(valores)) {
        const aceleracion = rigidez * (valor.obj - valor.v) - rozamiento * valor.vel
        valor.vel += aceleracion * dt
        valor.v += valor.vel * dt
        if (Math.abs(valor.obj - valor.v) > 0.25 || Math.abs(valor.vel) > 4) quieto = false
      }
      const { minimo, maximo } = limites()
      const { lx, lw } = valores
      if (lx.v < minimo) { lx.v = minimo; lx.vel = 0 }
      if (lx.v + lw.v > maximo) { lx.v = maximo - lw.v; lx.vel = 0 }
      if (quieto) {
        for (const valor of Object.values(valores)) { valor.v = valor.obj; valor.vel = 0 }
        pintar()
        fotograma = 0
        return
      }
      pintar()
      fotograma = requestAnimationFrame(paso)
    }

    function animar() {
      if (fotograma) return
      ultimoTiempo = performance.now()
      fotograma = requestAnimationFrame(paso)
    }

    // La lente, a la pestaña indicada: deslizándose o, la primera vez (y con "reducir movimiento"),
    // directamente
    function irA(enlace, saltar = false) {
      if (!enlace) return
      Object.assign(valores.lx, { obj: enlace.offsetLeft })
      Object.assign(valores.lw, { obj: enlace.offsetWidth })
      valores.lgx.obj = 0
      valores.lgy.obj = 0
      if (saltar || !colocada || reducido.matches) {
        for (const valor of Object.values(valores)) { valor.v = valor.obj; valor.vel = 0 }
        colocada = true
        cancelAnimationFrame(fotograma)
        fotograma = 0
        pintar()
        return
      }
      rigidez = RIGIDEZ_LIBRE
      animar()
    }
    motorRef.current = { irA }

    // ---- El dedo ----
    let gesto = null // { id, x0, arrastrando, ultimaX, ultimoT, velocidad }

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

    function seguirDedo(x) {
      const ancho = valores.lw.obj
      const origen = nav.getBoundingClientRect().left + nav.clientLeft
      const { minimo, maximo } = limites()
      valores.lx.obj = Math.min(maximo - ancho, Math.max(minimo, x - origen - ancho / 2))
      // Hinchada mientras la arrastras, y más estirada cuanto más rápido va el dedo
      valores.lgx.obj = HINCHADO_X + Math.min(ESTIRON_MAX, Math.abs(gesto.velocidad) / 160)
      valores.lgy.obj = HINCHADO_Y
      rigidez = RIGIDEZ_DEDO
      animar()
    }

    // Tras un arrastre, el navegador puede lanzar además un clic sobre la barra: no debe contar
    function anularClic(e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function alBajar(e) {
      if (e.pointerType === 'mouse' || !esBarraDeAbajo()) return
      gesto = { id: e.pointerId, x0: e.clientX, arrastrando: false, ultimaX: e.clientX, ultimoT: e.timeStamp, velocidad: 0 }
    }

    function alMover(e) {
      if (!gesto || e.pointerId !== gesto.id) return
      // Velocidad del dedo (px/s), suavizada para que no dé tirones
      const dt = Math.max(1, e.timeStamp - gesto.ultimoT)
      gesto.velocidad = gesto.velocidad * 0.6 + ((e.clientX - gesto.ultimaX) / dt) * 1000 * 0.4
      gesto.ultimaX = e.clientX
      gesto.ultimoT = e.timeStamp
      if (!gesto.arrastrando) {
        if (Math.abs(e.clientX - gesto.x0) < UMBRAL) return
        gesto.arrastrando = true
        // A partir de aquí, el dedo es de la barra aunque se salga de ella
        nav.setPointerCapture(e.pointerId)
        nav.classList.add('barra__nav--arrastrando')
      }
      seguirDedo(e.clientX)
    }

    function soltar(e, cancelado) {
      if (!gesto || e.pointerId !== gesto.id) return
      const eraArrastre = gesto.arrastrando
      gesto = null
      if (!eraArrastre) return
      nav.classList.remove('barra__nav--arrastrando')
      const destino = cancelado ? nav.querySelector('a.active') : enlaceMasCercano(e.clientX)
      irA(destino)
      if (cancelado) return
      nav.addEventListener('click', anularClic, { capture: true, once: true })
      setTimeout(() => nav.removeEventListener('click', anularClic, { capture: true }), 400)
      if (destino && !destino.classList.contains('active')) navigateRef.current(destino.dataset.to)
    }
    const alSoltar = (e) => soltar(e, false)
    // El sistema se queda con el gesto (llega una llamada, etc.): la lente vuelve a la activa
    const alCancelar = (e) => soltar(e, true)

    nav.addEventListener('pointerdown', alBajar)
    nav.addEventListener('pointermove', alMover)
    nav.addEventListener('pointerup', alSoltar)
    nav.addEventListener('pointercancel', alCancelar)

    // Si cambia el tamaño de la barra (giras el móvil, carga la tipografía), la lente se recoloca
    const observador = new ResizeObserver(() => irA(nav.querySelector('a.active'), true))
    observador.observe(nav)

    return () => {
      cancelAnimationFrame(fotograma)
      observador.disconnect()
      nav.removeEventListener('pointerdown', alBajar)
      nav.removeEventListener('pointermove', alMover)
      nav.removeEventListener('pointerup', alSoltar)
      nav.removeEventListener('pointercancel', alCancelar)
      nav.removeEventListener('click', anularClic, { capture: true })
      motorRef.current = null
    }
  }, [navRef])

  // Al cambiar de página (con un toque, con el teclado o al soltar), la lente va a la pestaña activa
  useEffect(() => {
    motorRef.current?.irA(navRef.current.querySelector('a.active'))
  }, [pathname, navRef])
}

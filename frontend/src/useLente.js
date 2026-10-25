import { useEffect, useRef } from 'react'

// La "lente" de una barra de pestañas: la gota de cristal que marca la pestaña elegida y que se
// puede arrastrar con el dedo de una pestaña a otra, como en Instagram o en las apps de iOS 26. La
// usan la barra de abajo del iPhone (Menu.jsx) y las pestañas de Noticias, Social y Perfil
// (PestanasPerfil.jsx).
//
// Cómo se mueve: con un MUELLE simulado fotograma a fotograma (requestAnimationFrame), en lugar de
// transiciones de CSS. Cada valor (posición, ancho, cuánto se hincha) tiene un objetivo y una
// velocidad; en cada fotograma un muelle tira de él hacia su objetivo y un rozamiento lo frena. Así
// el movimiento es continuo aunque el objetivo cambie a mitad de camino (el dedo se mueve, sueltas,
// cambias de pestaña): nunca salta, siempre parte de donde está y con la velocidad que llevaba.
//
// Los valores se escriben como variables en el contenedor (--lx, --lw, --lgx, --lgy) y el CSS
// dibuja con ellas la lente Y una capa de color encima (los mismos iconos en el color de la pestaña
// elegida, recortados con la forma de la lente). Por eso hay UN solo selector: un icono a medio
// tapar por la lente se ve medio coloreado, y el color viaja con ella.
//
// Gestos (solo con el dedo):
//  - un toque: es un clic normal en la pestaña (la lente va luego a la nueva);
//  - arrastrar: la lente sigue al dedo, se hincha un poco y se estira según la velocidad; al soltar
//    se desliza hasta la pestaña más cercana y se elige esa.
//
// Opciones:
//  - contenedorRef: el elemento que contiene las pestañas (y donde se escriben las variables)
//  - selector: cómo encontrar las pestañas dentro de él ('a[data-to]', '[role="tab"]'...)
//  - selectorActiva: cómo encontrar la elegida ('a.active', '.pestana--activa'...)
//  - activa: cualquier valor que cambie al cambiar de pestaña (la ruta, el id): la lente va a ella
//  - alElegir(pestana): al soltar el dedo sobre otra pestaña (navegar, cambiar de panel...)
//  - activo(): si la lente funciona ahora (p. ej., solo cuando la barra está abajo); por defecto, sí
//  - toquesPropios: el dedo lo gestiona todo este motor, también los toques (la barra de abajo del
//    iPhone). Sus pestañas son enlaces y, al mantenerlos pulsados, iOS enseña una vista previa de
//    la página; en iOS 26 la propiedad CSS que debería quitarla (-webkit-touch-callout) no siempre
//    funciona. Cancelando el "touchstart" el sistema no ve ni el toque ni la pulsación larga, y el
//    toque lo convierte en navegación este motor. Con el ratón y el teclado, los enlaces van igual.

// Lo que hay que mover el dedo (en píxeles) para que cuente como arrastre y no como un toque
const UMBRAL = 8
// Rigidez del muelle: más alta, más rápido llega. Al arrastrar va casi pegada al dedo; al soltar o
// al cambiar de pestaña, un poco más suelta, para que se vea deslizarse.
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

export function useLente({ contenedorRef, selector, selectorActiva, activa, alElegir, activo, toquesPropios = false }) {
  // Las funciones que llegan de fuera cambian en cada pintado (o, como navigate, en cada cambio de
  // página): si fueran dependencias del efecto, el motor se reiniciaría y la lente saltaría de golpe
  // a su sitio en vez de deslizarse. Las guardo en referencias y el motor se crea una sola vez.
  const alElegirRef = useRef(alElegir)
  const activoRef = useRef(activo)
  useEffect(() => {
    alElegirRef.current = alElegir
    activoRef.current = activo
  })
  // irA(pestaña, saltar): lo usa el efecto de "activa" para mover la lente a la elegida
  const motorRef = useRef(null)

  useEffect(() => {
    const caja = contenedorRef.current
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)')
    const funciona = () => (activoRef.current ? activoRef.current() : true)
    const pestanas = () => [...caja.querySelectorAll(selector)]
    const elegida = () => caja.querySelector(selectorActiva)

    // Cada valor: dónde está (v), a qué velocidad va (vel) y a dónde quiere ir (obj)
    const valores = {
      lx: { v: 0, vel: 0, obj: 0 }, // borde izquierdo (px desde el borde interior del contenedor)
      lw: { v: 0, vel: 0, obj: 0 }, // ancho
      lgx: { v: 0, vel: 0, obj: 0 }, // hinchado/estirado a cada lado
      lgy: { v: 0, vel: 0, obj: 0 }, // hinchado hacia arriba y abajo
    }
    let rigidez = RIGIDEZ_LIBRE
    let fotograma = 0
    let ultimoTiempo = 0
    let colocada = false

    function pintar() {
      for (const [nombre, valor] of Object.entries(valores)) caja.style.setProperty(`--${nombre}`, `${valor.v.toFixed(2)}px`)
    }

    // Que la lente no se salga de la primera ni de la última pestaña
    function limites() {
      const lista = pestanas()
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
    function irA(pestana, saltar = false) {
      if (!pestana || !funciona()) return
      valores.lx.obj = pestana.offsetLeft
      valores.lw.obj = pestana.offsetWidth
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
    motorRef.current = { irA: (saltar) => irA(elegida(), saltar) }

    // ---- El dedo ----
    let gesto = null // { id, x0, arrastrando, ultimaX, ultimoT, velocidad }

    // La pestaña cuyo centro queda más cerca del dedo
    function masCercana(x) {
      let mejor = null
      let distancia = Infinity
      for (const pestana of pestanas()) {
        const r = pestana.getBoundingClientRect()
        const d = Math.abs(x - (r.left + r.width / 2))
        if (d < distancia) {
          distancia = d
          mejor = pestana
        }
      }
      return mejor
    }

    // La lente, centrada bajo el dedo. --lx se mide desde el borde interior del contenedor y con su
    // scroll (como offsetLeft), de ahí el clientLeft (el borde) y el scrollLeft.
    function seguirDedo(x) {
      const ancho = valores.lw.obj
      const origen = caja.getBoundingClientRect().left + caja.clientLeft - caja.scrollLeft
      const { minimo, maximo } = limites()
      valores.lx.obj = Math.min(maximo - ancho, Math.max(minimo, x - origen - ancho / 2))
      // Hinchada mientras la arrastras, y más estirada cuanto más rápido va el dedo
      valores.lgx.obj = HINCHADO_X + Math.min(ESTIRON_MAX, Math.abs(gesto.velocidad) / 160)
      valores.lgy.obj = HINCHADO_Y
      rigidez = RIGIDEZ_DEDO
      animar()
    }

    // Tras un arrastre, el navegador puede lanzar además un clic: no debe contar
    function anularClic(e) {
      e.preventDefault()
      e.stopPropagation()
    }

    function alBajar(e) {
      if (e.pointerType === 'mouse' || !funciona()) return
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
        caja.setPointerCapture(e.pointerId)
        caja.classList.add('lente--arrastrando')
      }
      seguirDedo(e.clientX)
    }

    function soltar(e, cancelado) {
      if (!gesto || e.pointerId !== gesto.id) return
      const eraArrastre = gesto.arrastrando
      gesto = null
      if (!eraArrastre) {
        // Un toque, con los toques a cargo de este motor: elige la pestaña que hay bajo el dedo
        if (toquesPropios && !cancelado) {
          const tocada = e.target.closest?.(selector)
          if (tocada && caja.contains(tocada) && tocada !== elegida()) {
            irA(tocada)
            alElegirRef.current?.(tocada)
          }
        }
        return
      }
      caja.classList.remove('lente--arrastrando')
      const destino = cancelado ? elegida() : masCercana(e.clientX)
      irA(destino)
      if (cancelado) return
      caja.addEventListener('click', anularClic, { capture: true, once: true })
      setTimeout(() => caja.removeEventListener('click', anularClic, { capture: true }), 400)
      if (destino && destino !== elegida()) alElegirRef.current?.(destino)
    }
    const alSoltar = (e) => soltar(e, false)
    // El sistema se queda con el gesto (llega una llamada, empieza un scroll...): la lente vuelve
    const alCancelar = (e) => soltar(e, true)

    // Con los toques a cargo de este motor, el sistema no ve el dedo: ni vista previa de enlace al
    // mantener pulsado, ni menú, ni el clic que lanzaría después (los "pointer" sí siguen llegando)
    function anularToque(e) {
      if (funciona()) e.preventDefault()
    }
    if (toquesPropios) caja.addEventListener('touchstart', anularToque, { passive: false })
    // Mantener pulsado nunca abre el menú del sistema sobre las pestañas
    function anularMenu(e) {
      if (funciona()) e.preventDefault()
    }
    caja.addEventListener('contextmenu', anularMenu)

    caja.addEventListener('pointerdown', alBajar)
    caja.addEventListener('pointermove', alMover)
    caja.addEventListener('pointerup', alSoltar)
    caja.addEventListener('pointercancel', alCancelar)

    // Si cambia el tamaño del contenedor o de las pestañas (giras el móvil, carga la tipografía, la
    // pestaña elegida enseña su nombre), la lente va a su nuevo sitio deslizándose
    const observador = new ResizeObserver(() => irA(elegida()))
    observador.observe(caja)
    pestanas().forEach((pestana) => observador.observe(pestana))

    return () => {
      cancelAnimationFrame(fotograma)
      observador.disconnect()
      caja.removeEventListener('pointerdown', alBajar)
      caja.removeEventListener('pointermove', alMover)
      caja.removeEventListener('pointerup', alSoltar)
      caja.removeEventListener('pointercancel', alCancelar)
      caja.removeEventListener('click', anularClic, { capture: true })
      caja.removeEventListener('touchstart', anularToque)
      caja.removeEventListener('contextmenu', anularMenu)
      motorRef.current = null
    }
  }, [contenedorRef, selector, selectorActiva, toquesPropios])

  // Al cambiar de pestaña (con un toque, con el teclado o al soltar), la lente va a la elegida
  useEffect(() => {
    motorRef.current?.irA()
  }, [activa])
}

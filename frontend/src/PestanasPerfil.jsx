import { useRef, useLayoutEffect, useState } from 'react'
import { usePresencia } from './usePresencia'

// Dibujos de las pestañas (trazos de un viewBox de 24x24)
const ICONOS = {
  resumen: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  editar: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  cuentas: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  privacidad: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  biblioteca: (
    <>
      <path d="M4 5h4v14H4zM10 5h4v14h-4z" />
      <path d="m16 6 4 1-3 12-4-1" />
    </>
  ),
  // Pestañas de Noticias
  para_ti: (
    <>
      <path d="M12 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 15.2 7 18l1.2-5.6L4 8.6 9.6 8Z" />
    </>
  ),
  siguiendo: (
    <>
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" />
    </>
  ),
  // Pestañas de Social
  amigos: (
    <>
      <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.65a3.5 3.5 0 0 1 0 6.7" />
    </>
  ),
  solicitudes: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  actividad: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  descubrir: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bloqueados: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  comun: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  seguridad: (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
}

// El número que sale junto a una pestaña (solicitudes, amigos...). Entra y sale animado: va
// ocupando o dejando su hueco poco a poco, para que la barra no pegue un salto de golpe cuando
// llegan los datos y aparecen los números (ver .pestana__contador en sala.css).
function ContadorPestana({ valor }) {
  const { montado, saliendo } = usePresencia(valor > 0, 250)
  // Al salir, el número que se desvanece sigue siendo el último que hubo
  const [ultimo, setUltimo] = useState(valor)
  if (valor > 0 && valor !== ultimo) setUltimo(valor)

  if (!montado) return null
  return (
    <span className={saliendo ? "pestana__contador pestana__contador--saliendo" : "pestana__contador"}>
      {valor > 0 ? valor : ultimo}
    </span>
  )
}

// Barra de pestañas del perfil. Es una columna a la izquierda en pantallas anchas y
// una fila con scroll en las estrechas (lo decide el CSS). Un indicador de fondo se
// desliza hasta la pestaña activa.
//  - pestanas: [{ id, etiqueta, contador? }]; `contador` es un número que sale al lado
//    (solicitudes pendientes, juegos en común...); 0 o ausente no pinta nada
//  - activa: id de la pestaña seleccionada
//  - onCambiar(id): el padre cambia de pestaña
//  - etiqueta: nombre accesible de la barra
//  - variante: 'lateral' (la del perfil) o 'barra': siempre en fila, con el indicador como
//    subrayado (la usa la parte social)
// Teclado (patrón "tabs" de ARIA): las flechas pasan de una pestaña a otra, Inicio y
// Fin saltan a la primera y la última, y solo la activa entra con Tab (tabIndex).
function PestanasPerfil({ pestanas, activa, onCambiar, etiqueta, variante = 'lateral' }) {
  const navRef = useRef(null)
  const botonesRef = useRef({})
  // Posición y tamaño del indicador (null hasta la primera medida)
  const [indicador, setIndicador] = useState(null)
  // Si el indicador se desliza (con transición) o se coloca al instante. Se desliza SOLO al
  // cambiar de pestaña. Cuando lo único que cambia es el tamaño de los botones (llegan los
  // contadores, cambia el idioma, se redimensiona la ventana) tiene que seguirlos al momento: con
  // transición iría siempre unos pasos por detrás de ellos y la barra se vería descuadrada.
  const [deslizar, setDeslizar] = useState(false)
  // Cuándo se cambió de pestaña por última vez (0 = aún no), para saber de qué viene una medida
  const ultimoCambioRef = useRef(0)
  const primeraRef = useRef(true)

  // Mido el botón activo antes de pintar. Lo repito si cambia el tamaño de la barra
  // o de algún botón.
  useLayoutEffect(() => {
    // Este efecto corre al montar y cada vez que cambia la pestaña activa
    if (primeraRef.current) primeraRef.current = false
    else {
      ultimoCambioRef.current = performance.now()
      setDeslizar(true)
    }

    function medir(delObservador) {
      const boton = botonesRef.current[activa]
      if (!boton) return
      // Los ajustes de tamaño que llegan justo tras un clic forman parte del cambio de pestaña
      // (en móvil, la pestaña nueva enseña su texto y la vieja lo esconde)
      if (delObservador && performance.now() - ultimoCambioRef.current > 450) setDeslizar(false)
      const nuevo = { x: boton.offsetLeft, y: boton.offsetTop, w: boton.offsetWidth, h: boton.offsetHeight }
      setIndicador((previo) => (
        previo && previo.x === nuevo.x && previo.y === nuevo.y && previo.w === nuevo.w && previo.h === nuevo.h
          ? previo
          : nuevo
      ))
    }

    medir(false)
    const observador = new ResizeObserver(() => medir(true))
    observador.observe(navRef.current)
    Object.values(botonesRef.current).forEach((boton) => boton && observador.observe(boton))

    return () => observador.disconnect()
  }, [activa])

  function alPulsarTecla(e) {
    const actual = pestanas.findIndex((p) => p.id === activa)
    let siguiente

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') siguiente = (actual + 1) % pestanas.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') siguiente = (actual - 1 + pestanas.length) % pestanas.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = pestanas.length - 1
    else return

    e.preventDefault()
    onCambiar(pestanas[siguiente].id)
    botonesRef.current[pestanas[siguiente].id]?.focus()
  }

  return (
    <div ref={navRef} className={variante === 'barra' ? "pestanas pestanas--barra" : "pestanas"} role="tablist" aria-label={etiqueta} onKeyDown={alPulsarTecla}>
      {indicador && (
        <span
          className={deslizar ? "pestanas__indicador pestanas__indicador--lista" : "pestanas__indicador"}
          style={{
            width: indicador.w,
            height: indicador.h,
            transform: `translate(${indicador.x}px, ${indicador.y}px)`,
          }}
          aria-hidden="true"
        />
      )}

      {pestanas.map(({ id, etiqueta: texto, contador }) => (
        <button
          key={id}
          ref={(el) => { botonesRef.current[id] = el }}
          type="button"
          role="tab"
          id={`pestana-${id}`}
          aria-selected={id === activa}
          aria-controls={`panel-${id}`}
          tabIndex={id === activa ? 0 : -1}
          className={id === activa ? "pestana pestana--activa" : "pestana"}
          onClick={() => onCambiar(id)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONOS[id]}
          </svg>
          <span>{texto}</span>
          <ContadorPestana valor={contador ?? 0} />
        </button>
      ))}
    </div>
  )
}

export default PestanasPerfil

// "Polling": repetir una consulta cada cierto tiempo para enterarse de lo nuevo (por ejemplo,
// las solicitudes de amistad que llegan mientras la app está abierta).
//
// El servidor gratuito (Render) y la base de datos (Neon) se duermen si nadie les pregunta
// nada, y cada consulta repetida los mantiene despiertos. Para que una ventana olvidada no los
// tenga despiertos todo el día, el sondeo solo corre mientras alguien USA la app:
//  - cada `cada` ms (un minuto por defecto) mientras la pestaña se ve y hay actividad;
//  - se PARA si la pestaña se oculta o pasan `inactividad` ms sin ratón, teclado ni pantalla
//    táctil (5 minutos por defecto);
//  - al volver (verla otra vez o mover el ratón) consulta en el acto y se reanuda;
//  - no lanza una consulta nueva si la anterior (un servidor que despierta tarda) sigue en vuelo.
// Con `seguirOculto`, sigue también con la pestaña oculta o la ventana minimizada (es lo que
// necesitan los avisos del sistema del chat), pero igualmente se para pasados `inactividad` ms
// desde que tocaste la app por última vez.
//
// Lógica sin React para poder probarla con un reloj y un documento simulados (el `doc`,
// la `ventana` y `ahora` se pueden inyectar). Devuelve la función que lo detiene todo.
//
// Uso: const parar = iniciarSondeo(() => apiFetch('/friends/requests/count'))
export function iniciarSondeo(funcion, {
  cada = 60_000,
  inactividad = 5 * 60_000,
  seguirOculto = false,
  doc = document,
  ventana = window,
  ahora = Date.now,
} = {}) {
  const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart', 'focus']

  let temporizador = null
  let ultimaActividad = ahora()
  let enCurso = false

  const activo = () => (seguirOculto || doc.visibilityState === 'visible')
    && ahora() - ultimaActividad < inactividad

  // Lanza la consulta salvo que la anterior siga sin terminar. Un fallo no para el sondeo:
  // ya se reintenta en el siguiente turno.
  function ejecutar() {
    if (enCurso) return
    let resultado
    try {
      resultado = funcion()
    } catch {
      return
    }
    if (resultado && typeof resultado.then === 'function') {
      enCurso = true
      const terminar = () => { enCurso = false }
      resultado.then(terminar, terminar)
    }
  }

  function arrancar() {
    if (temporizador !== null || !activo()) return
    temporizador = setInterval(() => {
      // Comprobar aquí (y no solo al arrancar) es lo que detecta que llevas rato sin tocar nada
      if (activo()) ejecutar()
      else parar()
    }, cada)
  }

  function parar() {
    if (temporizador === null) return
    clearInterval(temporizador)
    temporizador = null
  }

  // Cualquier señal de uso: apunta la hora y, si el sondeo estaba parado, consulta y reanuda.
  // mousemove salta decenas de veces por segundo, así que esto es a propósito solo una
  // asignación en el caso normal.
  function alActividad() {
    ultimaActividad = ahora()
    if (temporizador === null && doc.visibilityState === 'visible') {
      ejecutar()
      arrancar()
    }
  }

  function alCambiarVisibilidad() {
    if (doc.visibilityState === 'visible') alActividad()
    else if (!seguirOculto) parar()
  }

  // Ha vuelto internet: no esperes al siguiente turno
  function alVolverConexion() {
    if (activo()) ejecutar()
  }

  for (const e of EVENTOS_ACTIVIDAD) ventana.addEventListener(e, alActividad, { passive: true })
  doc.addEventListener('visibilitychange', alCambiarVisibilidad)
  ventana.addEventListener('online', alVolverConexion)
  arrancar()

  return () => {
    parar()
    for (const e of EVENTOS_ACTIVIDAD) ventana.removeEventListener(e, alActividad)
    doc.removeEventListener('visibilitychange', alCambiarVisibilidad)
    ventana.removeEventListener('online', alVolverConexion)
  }
}

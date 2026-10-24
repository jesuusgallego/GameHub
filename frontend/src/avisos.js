// Avisos del sistema para los mensajes del chat: la notificación de Windows (o del navegador)
// que sale cuando te escriben y estás en otra ventana.
//
// Cómo funciona:
//  - La barra ya pregunta cada poco cuántos mensajes tienes sin leer (GET /chat/unread). La
//    respuesta trae además los últimos sin leer (`latest`), cada uno con un `ref` único.
//  - Aquí se decide cuáles son NUEVOS (no se han avisado ya) y se agrupan por conversación:
//    tres mensajes de ana dan un solo aviso, "ana (3)".
//  - Solo se avisa si la ventana no está delante (oculta, minimizada o con otra encima): si
//    estás usando la app, ya ves el número en el botón del chat.
//  - La primera consulta tras abrir la app no avisa de nada: lo que ya estaba sin leer no es
//    "nuevo" (si no, cada vez que abres la app te saltarían avisos viejos).
// Se activa y desactiva en el menú de ajustes; la preferencia se guarda en este equipo.
//
// La lógica no usa React ni el navegador para poder probarla (test/avisos.test.js).

const CLAVE_PREFERENCIA = 'avisosChat'

// ¿Hay notificaciones en este navegador?
export function avisosDisponibles(ventana = globalThis) {
  return typeof ventana.Notification === 'function'
}

// La preferencia guardada: true (sí), false (no) o null (aún no ha elegido)
export function preferenciaAvisos(almacen = globalThis.localStorage) {
  try {
    const valor = almacen?.getItem(CLAVE_PREFERENCIA)
    return valor === 'si' ? true : valor === 'no' ? false : null
  } catch {
    return null
  }
}

export function guardarPreferenciaAvisos(activos, almacen = globalThis.localStorage) {
  try {
    almacen?.setItem(CLAVE_PREFERENCIA, activos ? 'si' : 'no')
  } catch {
    // Sin almacenamiento (ventana privada...): dura lo que la sesión
  }
}

// ¿Están activos de verdad? La preferencia es "sí" y el navegador lo permite
export function avisosActivos(ventana = globalThis, almacen = globalThis.localStorage) {
  return avisosDisponibles(ventana) && ventana.Notification.permission === 'granted' && preferenciaAvisos(almacen) === true
}

// De los últimos mensajes sin leer, los que hay que avisar ahora, agrupados por conversación:
//   [{ key, from, group, body, cuantos }] (el mensaje más reciente de cada una)
//  - latest: la lista del servidor (el más nuevo primero)
//  - vistos: Set con los `ref` ya conocidos; se le añaden los de ahora
//  - primeraVez: la primera consulta solo apunta, no avisa
//  - delante: la ventana está delante (entonces no se avisa, pero se apunta igual)
export function avisosNuevos(latest, vistos, { primeraVez = false, delante = false } = {}) {
  const nuevos = latest.filter((m) => !vistos.has(m.ref))
  for (const m of latest) vistos.add(m.ref)
  // Que el conjunto no crezca sin fin en una sesión larga: con los de ahora basta, porque
  // lo que ya no está en `latest` se ha leído o es demasiado antiguo para volver
  if (vistos.size > 200) {
    const actuales = new Set(latest.map((m) => m.ref))
    for (const ref of vistos) if (!actuales.has(ref)) vistos.delete(ref)
  }
  if (primeraVez || delante || nuevos.length === 0) return []

  const porConversacion = new Map()
  for (const m of nuevos) {
    const previo = porConversacion.get(m.key)
    if (previo) previo.cuantos += 1
    else porConversacion.set(m.key, { key: m.key, from: m.from, group: m.group, body: m.body, cuantos: 1 })
  }
  return [...porConversacion.values()]
}

// El título y el texto de un aviso: "ana" / "Los del viernes" con "ana: hola" en un grupo, y
// el número de mensajes si son varios
export function contenidoAviso(aviso, t) {
  const base = aviso.group ?? aviso.from
  const titulo = aviso.cuantos > 1 ? t('avisos.varios', { quien: base, n: aviso.cuantos }) : base
  const texto = aviso.group ? t('chat.de', { usuario: aviso.from, texto: aviso.body }) : aviso.body
  return { titulo, texto: texto.replace(/\s+/g, ' ') }
}

// Enseña el aviso con la API de notificaciones. Al pulsarlo se trae la ventana al frente y se
// llama a `alPulsar`. `tag` hace que un aviso nuevo de la misma conversación sustituya al
// anterior en vez de apilarse.
export function mostrarAviso(aviso, t, alPulsar, ventana = globalThis) {
  const { titulo, texto } = contenidoAviso(aviso, t)
  try {
    const notificacion = new ventana.Notification(titulo, {
      body: texto,
      tag: `gamehub-chat-${aviso.key}`,
      icon: '/favicon.svg',
    })
    notificacion.onclick = () => {
      // En la app de escritorio, window.focus() no saca una ventana minimizada: lo pide al
      // proceso principal (ver desktop/preload.js)
      ventana.gamehubEscritorio?.enfocar()
      ventana.focus?.()
      notificacion.close()
      alPulsar(aviso.key)
    }
  } catch {
    // Algunos navegadores móviles solo permiten avisos desde un service worker: sin aviso
  }
}

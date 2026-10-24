// Lógica del chat sin React, para poder probarla (ver test/chat.test.js). Un mensaje del
// servidor es { id, mine, body, created_at, deleted, read_at? } (read_at solo en los míos).
// En un grupo además lleva `sender` (quién lo escribió), `kind` ('text' o 'event': los avisos
// como "ana añadió a luis", con `event` y `target`) y `hidden` si es de alguien a quien has
// bloqueado.
//
// Cada conversación se identifica con una "clave": el nombre de la persona ("ana") o
// "g:<id>" para un grupo ("g:12"). Un nombre de usuario no puede llevar ":", así que no chocan.

// ¿Es la clave de un grupo?
export function esGrupo(clave) {
  return typeof clave === 'string' && clave.startsWith('g:')
}

// La ruta de la API de una conversación: /chat/ana o /chat/g/12
export function rutaConversacion(clave) {
  return esGrupo(clave) ? `/chat/g/${clave.slice(2)}` : `/chat/${encodeURIComponent(clave)}`
}

// Entre dos mensajes seguidos de la misma persona que pasen más de esto, se corta el bloque
// y se vuelve a enseñar la hora
export const HUECO_BLOQUE_MS = 5 * 60_000

// Junta los mensajes que ya tengo con los que llegan: sin repetir ninguno (el mismo id se
// queda con la versión nueva, que puede estar borrada o leída) y por orden de id.
export function fusionar(actuales, nuevos) {
  if (nuevos.length === 0) return actuales
  const porId = new Map(actuales.map((m) => [m.id, m]))
  for (const m of nuevos) porId.set(m.id, { ...porId.get(m.id), ...m })
  return [...porId.values()].sort((a, b) => a.id - b.id)
}

// Marca como borrados (y sin texto) los mensajes cuyo id está en `ids`. Si no cambia nada
// devuelve la misma lista, para que React no repinte en vano.
export function marcarBorrados(mensajes, ids) {
  if (ids.length === 0) return mensajes
  const borrados = new Set(ids)
  if (!mensajes.some((m) => borrados.has(m.id) && !m.deleted)) return mensajes
  return mensajes.map((m) => (borrados.has(m.id) && !m.deleted ? { ...m, deleted: true, body: '' } : m))
}

// El id del último mensaje del servidor que tengo (el punto desde el que pedir lo nuevo), o 0
export function ultimoId(mensajes) {
  return mensajes.reduce((max, m) => Math.max(max, m.id), 0)
}

// ¿Hay mensajes de otra persona que aún no he marcado como leídos? `leidoHasta` es el
// mayor id que ya avisé al servidor que vi. Los avisos del grupo no cuentan.
export function hayPorLeer(mensajes, leidoHasta) {
  return mensajes.some((m) => !m.mine && !m.deleted && m.kind !== 'event' && m.id > leidoHasta)
}

// El mensaje mío bajo el que se escribe "Visto": el último que la otra persona ha leído.
// `peerRead` es { id, at } del servidor (hasta qué mensaje mío ha leído) o null.
export function mensajeVisto(mensajes, peerRead) {
  if (!peerRead) return null
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i]
    if (m.mine && !m.deleted && m.id <= peerRead.id) return m.id
  }
  return null
}

// "2026-10-16": el día de calendario de una fecha en la zona horaria del navegador. Es la
// clave para agrupar y para saber si dos mensajes son del mismo día.
export function claveDia(fecha) {
  const d = new Date(fecha)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// En un grupo, el "Visto por...": quiénes han leído mi último mensaje. `reads` es la lista del
// servidor ([{ username, last_read_id }], sin mí). Devuelve { id, nombres, todos } o null si no
// lo ha leído nadie (o no tengo mensajes).
export function vistoPor(mensajes, reads) {
  let mio = null
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i]
    if (m.kind === 'event') continue
    if (m.mine && !m.deleted) mio = m
    break
  }
  if (!mio || !reads?.length) return null
  const nombres = reads.filter((r) => r.last_read_id >= mio.id).map((r) => r.username)
  if (nombres.length === 0) return null
  return { id: mio.id, nombres, todos: nombres.length === reads.length }
}

// Reparte los mensajes en días y, dentro de cada día, en bloques: tandas seguidas de la misma
// persona con menos de HUECO_BLOQUE_MS entre mensajes. Un aviso del grupo ("ana añadió a luis")
// va suelto, en su propio bloque, y corta la tanda. Es la forma en que se pintan:
//   [{ dia: '2026-10-16', fecha, bloques: [{ mine, sender?, mensajes: [...] } | { evento }] }]
// `sender` solo aparece en los grupos (en una conversación de dos ya se sabe quién es quién).
export function agrupar(mensajes) {
  const dias = []
  for (const m of mensajes) {
    const clave = claveDia(m.created_at)
    let dia = dias[dias.length - 1]
    if (!dia || dia.dia !== clave) {
      dia = { dia: clave, fecha: m.created_at, bloques: [] }
      dias.push(dia)
    }

    if (m.kind === 'event') {
      dia.bloques.push({ evento: m })
      continue
    }

    const bloque = dia.bloques[dia.bloques.length - 1]
    const anterior = bloque?.mensajes?.[bloque.mensajes.length - 1]
    const seguido = anterior && bloque.mine === m.mine && bloque.sender === m.sender
      && new Date(m.created_at) - new Date(anterior.created_at) < HUECO_BLOQUE_MS
    if (seguido) bloque.mensajes.push(m)
    else dia.bloques.push({ mine: m.mine, ...(m.sender !== undefined && { sender: m.sender }), mensajes: [m] })
  }
  return dias
}

// El rótulo de un día de la conversación: 'hoy', 'ayer' o null (entonces se escribe la fecha).
// Cuenta días de calendario, como tramoDia de tiempo.js.
export function rotuloDia(clave, ahora = Date.now()) {
  if (clave === claveDia(ahora)) return 'hoy'
  if (clave === claveDia(ahora - 86_400_000)) return 'ayer'
  return null
}

// Las frases de arranque que se ofrecen en una conversación vacía; si la otra persona está
// jugando a algo, una pregunta sobre ese juego.
export function sugerenciasInicio(juego) {
  return juego ? ['hola', 'jugamos', 'juego'] : ['hola', 'jugamos', 'aQueJuegas']
}

// Cuántos mensajes sin leer en total (para la insignia y el título de la pestaña)
export function totalSinLeer(conversaciones) {
  return conversaciones.reduce((suma, c) => suma + (c.unread ?? 0), 0)
}

// El texto de un aviso del grupo, con la forma que toca según quién lo hizo y a quién afecta:
// "ana añadió a luis", "Añadiste a luis", "ana te añadió"... `m` es { mine, sender, event,
// target, body }; `yo` es mi nombre de usuario (para el "te").
export function textoEvento(m, t, yo) {
  const quien = m.sender
  const objetivo = m.target ?? t('chat.alguien')
  const aMi = m.target != null && m.target === yo
  const forma = m.mine ? '.yo' : aMi ? '.ati' : ''
  switch (m.event) {
    case 'created': return t(`chat.evento.created${m.mine ? '.yo' : ''}`, { quien, nombre: m.body })
    case 'renamed': return t(`chat.evento.renamed${m.mine ? '.yo' : ''}`, { quien, nombre: m.body })
    case 'left': return t('chat.evento.left', { quien })
    case 'owner': return t(`chat.evento.owner${m.mine ? '.yo' : ''}`, { quien })
    case 'added': return t(`chat.evento.added${forma}`, { quien, objetivo })
    case 'removed': return t(`chat.evento.removed${forma}`, { quien, objetivo })
    default: return ''
  }
}

// El texto de la vista previa de una conversación en la lista. En los grupos (`grupo`), lo de
// los demás va con su nombre delante ("luis: vale") y los avisos, con su texto.
export function vistaPrevia(ultimo, t, { grupo = false, yo = null } = {}) {
  if (!ultimo) return ''
  if (ultimo.kind === 'event') return textoEvento(ultimo, t, yo)
  if (ultimo.deleted) return t('chat.mensajeEliminado')
  if (ultimo.hidden) return t('chat.mensajeOculto')
  const cuerpo = ultimo.body.replace(/\s+/g, ' ')
  if (ultimo.mine) return t('chat.tu', { texto: cuerpo })
  return grupo && ultimo.sender ? t('chat.de', { usuario: ultimo.sender, texto: cuerpo }) : cuerpo
}

// "Escribiendo...": en una conversación de dos basta eso; en un grupo, quién. `nombres` es la
// lista de quienes escriben (sin mí).
export function textoEscribiendo(nombres, t, grupo) {
  if (!grupo) return t('chat.escribiendo')
  if (nombres.length === 1) return t('chat.escribiendoUno', { a: nombres[0] })
  if (nombres.length === 2) return t('chat.escribiendoDos', { a: nombres[0], b: nombres[1] })
  return t('chat.escribiendoVarios')
}

// El nombre que se propone para un grupo nuevo con los elegidos: "ana, luis y marta". Si no cabe
// en `max` caracteres, se recorta con "...".
export function nombreSugerido(nombres, t, max) {
  if (nombres.length === 0) return ''
  const texto = nombres.length === 1
    ? nombres[0]
    : t('chat.grupo.nombreLista', { lista: nombres.slice(0, -1).join(', '), ultimo: nombres[nombres.length - 1] })
  return [...texto].length <= max ? texto : `${[...texto].slice(0, max - 3).join('')}...`
}

// Cuánto hace de una fecha para la lista de conversaciones: 'hoy', 'ayer', 'semana' (los 5
// días anteriores a ayer) o 'antes'. Días de calendario, como rotuloDia.
export function tramoLista(fecha, ahora = Date.now()) {
  const inicioDia = (ms) => {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const dias = Math.round((inicioDia(ahora) - inicioDia(new Date(fecha).getTime())) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias <= 6) return 'semana'
  return 'antes'
}

// Parte un texto en trozos para pintar los enlaces como enlaces:
//   [{ texto: 'mira ' }, { texto: 'https://x.com/a', enlace: 'https://x.com/a' }, { texto: ' qué guay' }]
// Solo valen http y https (nada de javascript:), y el punto, la coma o el paréntesis que cierran
// una frase no se cuentan como parte del enlace. Lo que no es enlace se deja tal cual: React
// lo escribe como texto, nunca como HTML.
const ENLACE = /https?:\/\/[^\s<>"']+/gi

const cuenta = (texto, caracter) => texto.split(caracter).length - 1

// ¿Es una dirección web de verdad? http o https y un dominio con punto (así "http://localhost" o
// "http://x" no se tratan como enlaces)
function esEnlace(url) {
  try {
    const { protocol, hostname } = new URL(url)
    return (protocol === 'http:' || protocol === 'https:') && hostname.includes('.')
  } catch {
    return false
  }
}

export function partirEnlaces(texto) {
  const trozos = []
  let desde = 0

  for (const coincidencia of texto.matchAll(ENLACE)) {
    let url = coincidencia[0]
    // Un ")" al final solo es parte del enlace si dentro hay un "(" que lo abre
    while (/[.,;:!?'"]$/.test(url) || (url.endsWith(')') && cuenta(url, ')') > cuenta(url, '('))) {
      url = url.slice(0, -1)
    }

    if (!esEnlace(url)) continue

    if (coincidencia.index > desde) trozos.push({ texto: texto.slice(desde, coincidencia.index) })
    trozos.push({ texto: url, enlace: url })
    desde = coincidencia.index + url.length
  }

  if (desde < texto.length) trozos.push({ texto: texto.slice(desde) })
  return trozos
}

// Lógica del chat sin React, para poder probarla (ver test/chat.test.js). Un mensaje del
// servidor es { id, mine, body, created_at, deleted, read_at? } (read_at solo en los míos).

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

// ¿Hay mensajes de la otra persona que aún no he marcado como leídos? `leidoHasta` es el
// mayor id que ya avisé al servidor que vi.
export function hayPorLeer(mensajes, leidoHasta) {
  return mensajes.some((m) => !m.mine && !m.deleted && m.id > leidoHasta)
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

// Reparte los mensajes en días y, dentro de cada día, en bloques: tandas seguidas de la misma
// persona con menos de HUECO_BLOQUE_MS entre mensajes. Es la forma en que se pintan:
//   [{ dia: '2026-10-16', fecha, bloques: [{ mine, mensajes: [...] }] }]
export function agrupar(mensajes) {
  const dias = []
  for (const m of mensajes) {
    const clave = claveDia(m.created_at)
    let dia = dias[dias.length - 1]
    if (!dia || dia.dia !== clave) {
      dia = { dia: clave, fecha: m.created_at, bloques: [] }
      dias.push(dia)
    }

    const bloque = dia.bloques[dia.bloques.length - 1]
    const anterior = bloque?.mensajes[bloque.mensajes.length - 1]
    const seguido = bloque && bloque.mine === m.mine
      && new Date(m.created_at) - new Date(anterior.created_at) < HUECO_BLOQUE_MS
    if (seguido) bloque.mensajes.push(m)
    else dia.bloques.push({ mine: m.mine, mensajes: [m] })
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

// El texto de la vista previa de una conversación en la lista
export function vistaPrevia(ultimo, t) {
  if (!ultimo) return ''
  if (ultimo.deleted) return t('chat.mensajeEliminado')
  const cuerpo = ultimo.body.replace(/\s+/g, ' ')
  return ultimo.mine ? t('chat.tu', { texto: cuerpo }) : cuerpo
}

// La dirección que abre el chat en Social: ?chat=ana (conversación) o ?chat= (lista). Es lo que
// llevan todos los enlaces al chat (el botón Mensaje del perfil y del carnet, la lista...).
//  - ubicacion: { pathname, search } de donde se está. Si ya se está en Social, se conservan sus
//    demás parámetros (la pestaña): el botón Mensaje de un carnet abre el chat SIN cambiarte de
//    pestaña. Desde cualquier otra página se va a Social tal cual.
export function rutaChat(usuario, ubicacion) {
  const params = new URLSearchParams(ubicacion?.pathname === '/social' ? ubicacion.search : '')
  params.set('chat', usuario ?? '')
  return `/social?${params.toString()}`
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

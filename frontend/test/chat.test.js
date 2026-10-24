// Pruebas de la lógica del chat del cliente: fusionar mensajes, agruparlos por días y tandas,
// el "visto", los enlaces y que el tope de longitud es el del servidor. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'
import {
  fusionar, marcarBorrados, ultimoId, hayPorLeer, mensajeVisto, agrupar, claveDia, rotuloDia,
  tramoLista, partirEnlaces, totalSinLeer, vistaPrevia, HUECO_BLOQUE_MS,
  esGrupo, rutaConversacion, vistoPor, textoEvento, textoEscribiendo, nombreSugerido,
} from '../src/logicaChat.js'
import { MENSAJE_MAX } from '../src/validacion.js'

const require = createRequire(import.meta.url)

// Un mensaje de prueba; la fecha se da en horas y minutos de un día fijo (zona del equipo)
const en = (dia, h, min = 0) => new Date(2026, 9, dia, h, min).toISOString()
const msg = (id, mine, fecha, extra = {}) => ({ id, mine, body: `m${id}`, created_at: fecha, deleted: false, ...extra })

test('el tope de longitud del mensaje es el del servidor', () => {
  const servidor = require('../../backend/src/config/validacion.js')
  assert.strictEqual(MENSAJE_MAX, servidor.MENSAJE_MAX)
})

test('fusionar: sin repetir, por orden de id y el mismo id se queda con lo nuevo', () => {
  const a = [msg(1, true, en(16, 10)), msg(3, false, en(16, 10, 2))]
  const r = fusionar(a, [msg(2, true, en(16, 10, 1)), msg(3, false, en(16, 10, 2), { deleted: true, body: '' })])
  assert.deepStrictEqual(r.map((m) => m.id), [1, 2, 3])
  assert.strictEqual(r[2].deleted, true)
  assert.strictEqual(fusionar(a, []), a, 'sin nada nuevo devuelve la misma lista')
})

test('marcarBorrados vacía el texto y no toca nada si no hay cambios', () => {
  const a = [msg(1, true, en(16, 10)), msg(2, false, en(16, 11))]
  const r = marcarBorrados(a, [2])
  assert.strictEqual(r[1].deleted, true)
  assert.strictEqual(r[1].body, '')
  assert.strictEqual(r[0], a[0])
  assert.strictEqual(marcarBorrados(a, []), a)
  assert.strictEqual(marcarBorrados(a, [99]), a, 'un id que no tengo no cambia nada')
  assert.strictEqual(marcarBorrados(r, [2]), r, 'ya borrado: misma lista')
})

test('ultimoId y hayPorLeer', () => {
  assert.strictEqual(ultimoId([]), 0)
  const a = [msg(4, false, en(16, 10)), msg(7, true, en(16, 11))]
  assert.strictEqual(ultimoId(a), 7)
  assert.strictEqual(hayPorLeer(a, 0), true)
  assert.strictEqual(hayPorLeer(a, 4), false, 'ya avisé hasta el 4; el 7 es mío')
  assert.strictEqual(hayPorLeer([msg(5, false, en(16, 10), { deleted: true })], 0), false, 'borrado no cuenta')
  assert.strictEqual(hayPorLeer([], 0), false)
})

test('mensajeVisto: el último mío que la otra persona ha leído', () => {
  const a = [msg(1, true, en(16, 10)), msg(2, false, en(16, 10, 1)), msg(3, true, en(16, 10, 2)), msg(4, true, en(16, 10, 3))]
  assert.strictEqual(mensajeVisto(a, null), null)
  assert.strictEqual(mensajeVisto(a, { id: 3, at: 'x' }), 3)
  assert.strictEqual(mensajeVisto(a, { id: 2, at: 'x' }), 1, 'los ajenos no cuentan')
  assert.strictEqual(mensajeVisto(a, { id: 4, at: 'x' }), 4)
  const borrado = [msg(1, true, en(16, 10)), msg(3, true, en(16, 10, 2), { deleted: true })]
  assert.strictEqual(mensajeVisto(borrado, { id: 3, at: 'x' }), 1, 'un mensaje borrado no lleva "Visto"')
})

test('agrupar: por días y, dentro de cada día, en tandas de la misma persona', () => {
  const a = [
    msg(1, true, en(15, 23, 58)),
    msg(2, true, en(16, 0, 1)),   // otro día
    msg(3, true, en(16, 0, 3)),   // misma tanda
    msg(4, false, en(16, 0, 4)),  // otra persona
    msg(5, false, en(16, 0, 4 + HUECO_BLOQUE_MS / 60_000 + 1)), // pasó el hueco: tanda nueva
  ]
  const dias = agrupar(a)
  assert.deepStrictEqual(dias.map((d) => d.dia), ['2026-10-15', '2026-10-16'])
  assert.deepStrictEqual(dias[1].bloques.map((b) => [b.mine, b.mensajes.map((m) => m.id)]), [
    [true, [2, 3]], [false, [4]], [false, [5]],
  ])
  assert.deepStrictEqual(agrupar([]), [])
})

test('claveDia y rotuloDia: hoy, ayer y el resto', () => {
  const ahora = new Date(2026, 9, 16, 12).getTime()
  assert.strictEqual(claveDia(en(16, 3)), '2026-10-16')
  assert.strictEqual(rotuloDia('2026-10-16', ahora), 'hoy')
  assert.strictEqual(rotuloDia('2026-10-15', ahora), 'ayer')
  assert.strictEqual(rotuloDia('2026-10-14', ahora), null)
})

test('tramoLista: hoy, ayer, esta semana y antes', () => {
  const ahora = new Date(2026, 9, 16, 12).getTime()
  assert.strictEqual(tramoLista(en(16, 0, 5), ahora), 'hoy')
  assert.strictEqual(tramoLista(en(15, 23, 59), ahora), 'ayer')
  assert.strictEqual(tramoLista(en(12, 9), ahora), 'semana')
  assert.strictEqual(tramoLista(en(10, 9), ahora), 'semana')
  assert.strictEqual(tramoLista(en(9, 9), ahora), 'antes')
})

test('partirEnlaces: solo http(s), sin la puntuación final y sin tocar el resto', () => {
  assert.deepStrictEqual(partirEnlaces('hola'), [{ texto: 'hola' }])
  assert.deepStrictEqual(partirEnlaces('mira https://store.steampowered.com/app/1145360, qué guay'), [
    { texto: 'mira ' },
    { texto: 'https://store.steampowered.com/app/1145360', enlace: 'https://store.steampowered.com/app/1145360' },
    { texto: ', qué guay' },
  ])
  assert.deepStrictEqual(partirEnlaces('(https://es.wikipedia.org/wiki/Hades_(videojuego))').map((t) => t.enlace ?? null), [
    null, 'https://es.wikipedia.org/wiki/Hades_(videojuego)', null,
  ])
  // Nada de otros protocolos ni de direcciones sin dominio
  for (const malo of ['javascript:alert(1)', 'ftp://x.com/a', 'http://localhost:4000', 'https://', 'data:text/html,<b>x</b>']) {
    assert.ok(partirEnlaces(malo).every((t) => !t.enlace), malo)
  }
  assert.deepStrictEqual(partirEnlaces('<img src=x onerror=alert(1)>'), [{ texto: '<img src=x onerror=alert(1)>' }])
  // Dos enlaces seguidos
  assert.deepStrictEqual(partirEnlaces('https://a.com y https://b.com').filter((t) => t.enlace).length, 2)
})

test('totalSinLeer y vistaPrevia', () => {
  assert.strictEqual(totalSinLeer([{ unread: 2 }, { unread: 0 }, { unread: 3 }]), 5)
  assert.strictEqual(totalSinLeer([]), 0)
  const t = (clave, p) => (p ? `${clave}:${p.texto}` : clave)
  assert.strictEqual(vistaPrevia({ mine: false, deleted: false, body: 'hola\n\n  qué tal' }, t), 'hola qué tal')
  assert.strictEqual(vistaPrevia({ mine: true, deleted: false, body: 'vale' }, t), 'chat.tu:vale')
  assert.strictEqual(vistaPrevia({ mine: true, deleted: true, body: '' }, t), 'chat.mensajeEliminado')
  assert.strictEqual(vistaPrevia(null, t), '')
})

// ---- Grupos -----------------------------------------------------------------------------
const tt = (clave, p = {}) => `${clave}|${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(',')}`

test('claves y rutas: una persona o un grupo', () => {
  assert.strictEqual(esGrupo('g:12'), true)
  assert.strictEqual(esGrupo('ana'), false)
  assert.strictEqual(esGrupo('g12'), false, 'g12 es un nombre de usuario válido')
  assert.strictEqual(rutaConversacion('g:12'), '/chat/g/12')
  assert.strictEqual(rutaConversacion('ana'), '/chat/ana')
})

test('agrupar en un grupo: tandas por autor y los avisos sueltos cortan la tanda', () => {
  const g = (id, sender, extra = {}) => msg(id, sender === 'yo', en(16, 10, id), { sender, kind: 'text', ...extra })
  const dias = agrupar([
    g(1, 'ana'), g(2, 'ana'), g(3, 'luis'),
    g(4, 'ana', { kind: 'event', event: 'added', target: 'marta' }),
    g(5, 'ana'), g(6, 'yo'),
  ])
  assert.deepStrictEqual(dias[0].bloques.map((b) => (b.evento ? `aviso ${b.evento.id}` : `${b.sender}:${b.mensajes.map((m) => m.id)}`)), [
    'ana:1,2', 'luis:3', 'aviso 4', 'ana:5', 'yo:6',
  ])
})

test('hayPorLeer no cuenta los avisos del grupo', () => {
  assert.strictEqual(hayPorLeer([{ id: 5, mine: false, deleted: false, kind: 'event' }], 0), false)
  assert.strictEqual(hayPorLeer([{ id: 5, mine: false, deleted: false, kind: 'text' }], 0), true)
})

test('vistoPor: quiénes han leído mi último mensaje', () => {
  const mensajes = [
    { id: 1, mine: false, kind: 'text' },
    { id: 2, mine: true, kind: 'text', deleted: false },
    { id: 3, mine: false, kind: 'event' },
  ]
  const reads = [{ username: 'ana', last_read_id: 3 }, { username: 'luis', last_read_id: 1 }]
  assert.deepStrictEqual(vistoPor(mensajes, reads), { id: 2, nombres: ['ana'], todos: false })
  assert.deepStrictEqual(vistoPor(mensajes, reads.map((r) => ({ ...r, last_read_id: 9 }))), { id: 2, nombres: ['ana', 'luis'], todos: true })
  assert.strictEqual(vistoPor(mensajes, [{ username: 'luis', last_read_id: 1 }]), null, 'nadie')
  assert.strictEqual(vistoPor([...mensajes, { id: 4, mine: false, kind: 'text' }], reads), null, 'lo último no es mío')
})

test('textoEvento: la forma según quién lo hizo y a quién afecta', () => {
  const ev = (extra) => ({ mine: false, sender: 'ana', target: null, body: '', ...extra })
  assert.strictEqual(textoEvento(ev({ event: 'created', body: 'Viernes' }), tt, 'yo'), 'chat.evento.created|quien=ana,nombre=Viernes')
  assert.strictEqual(textoEvento(ev({ event: 'created', body: 'Viernes', mine: true }), tt, 'yo'), 'chat.evento.created.yo|quien=ana,nombre=Viernes')
  assert.strictEqual(textoEvento(ev({ event: 'added', target: 'luis' }), tt, 'yo'), 'chat.evento.added|quien=ana,objetivo=luis')
  assert.strictEqual(textoEvento(ev({ event: 'added', target: 'yo' }), tt, 'yo'), 'chat.evento.added.ati|quien=ana,objetivo=yo')
  assert.strictEqual(textoEvento(ev({ event: 'removed', target: 'luis', mine: true }), tt, 'yo'), 'chat.evento.removed.yo|quien=ana,objetivo=luis')
  assert.strictEqual(textoEvento(ev({ event: 'removed', target: null }), tt, 'yo'), 'chat.evento.removed|quien=ana,objetivo=chat.alguien|')
  assert.strictEqual(textoEvento(ev({ event: 'left' }), tt, 'yo'), 'chat.evento.left|quien=ana')
  assert.strictEqual(textoEvento(ev({ event: 'owner', mine: true }), tt, 'yo'), 'chat.evento.owner.yo|quien=ana')
})

test('vistaPrevia en un grupo: nombre delante, avisos y ocultos', () => {
  const op = { grupo: true, yo: 'yo' }
  assert.strictEqual(vistaPrevia({ mine: false, sender: 'luis', body: 'vale', kind: 'text', deleted: false }, tt, op), 'chat.de|usuario=luis,texto=vale')
  assert.strictEqual(vistaPrevia({ mine: true, sender: 'yo', body: 'ok', kind: 'text', deleted: false }, tt, op), 'chat.tu|texto=ok')
  assert.strictEqual(vistaPrevia({ mine: false, sender: 'eva', body: '', kind: 'text', deleted: false, hidden: true }, tt, op), 'chat.mensajeOculto|')
  assert.strictEqual(vistaPrevia({ mine: false, sender: 'ana', kind: 'event', event: 'left', body: '' }, tt, op), 'chat.evento.left|quien=ana')
})

test('textoEscribiendo y nombreSugerido', () => {
  assert.strictEqual(textoEscribiendo([], tt, false), 'chat.escribiendo|')
  assert.strictEqual(textoEscribiendo(['ana'], tt, true), 'chat.escribiendoUno|a=ana')
  assert.strictEqual(textoEscribiendo(['ana', 'luis'], tt, true), 'chat.escribiendoDos|a=ana,b=luis')
  assert.strictEqual(textoEscribiendo(['a', 'b', 'c'], tt, true), 'chat.escribiendoVarios|')
  const lista = (clave, p) => `${p.lista} y ${p.ultimo}`
  assert.strictEqual(nombreSugerido(['ana', 'luis', 'marta'], lista, 50), 'ana, luis y marta')
  assert.strictEqual(nombreSugerido(['ana'], lista, 50), 'ana')
  assert.strictEqual(nombreSugerido([], lista, 50), '')
  const largo = nombreSugerido(Array.from({ length: 9 }, (_, i) => `jugador_numero_${i}`), lista, 50)
  assert.strictEqual([...largo].length, 50)
  assert.ok(largo.endsWith('...'))
})

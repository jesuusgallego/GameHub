// Pruebas de la lógica del chat del cliente: fusionar mensajes, agruparlos por días y tandas,
// el "visto", los enlaces y que el tope de longitud es el del servidor. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'
import {
  fusionar, marcarBorrados, ultimoId, hayPorLeer, mensajeVisto, agrupar, claveDia, rotuloDia,
  tramoLista, partirEnlaces, totalSinLeer, vistaPrevia, rutaChat, HUECO_BLOQUE_MS,
} from '../src/chat.js'
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

test('rutaChat: abre el chat en Social y, si ya estás allí, conserva la pestaña', () => {
  // Desde cualquier otra página: a Social tal cual
  assert.strictEqual(rutaChat('ana'), '/social?chat=ana')
  assert.strictEqual(rutaChat(null), '/social?chat=')
  assert.strictEqual(rutaChat('ana', { pathname: '/usuarios/beto', search: '?tab=comun' }), '/social?chat=ana')
  // Desde Social: se queda en la pestaña en la que estabas
  assert.strictEqual(rutaChat('ana', { pathname: '/social', search: '?tab=amigos' }), '/social?tab=amigos&chat=ana')
  assert.strictEqual(rutaChat(undefined, { pathname: '/social', search: '?tab=amigos&chat=ana' }), '/social?tab=amigos&chat=')
  assert.strictEqual(rutaChat('beto', { pathname: '/social', search: '?tab=amigos&chat=ana' }), '/social?tab=amigos&chat=beto')
})

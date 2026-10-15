// Pruebas del sondeo (polling) de la barra: cuándo consulta, cuándo se para y cuándo
// reanuda. Usa temporizadores y un reloj simulados, y un documento y una ventana falsos
// (un EventTarget con visibilityState). npm test
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { iniciarSondeo } from '../src/sondeo.js'

const MINUTO = 60_000

let reloj, doc, ventana, llamadas, parar

// Avanza el tiempo simulado de minuto en minuto: cada paso mueve el reloj y dispara los
// temporizadores que tocan (igual que pasaría en el navegador)
function avanzar(ms) {
  for (let hecho = 0; hecho < ms; hecho += MINUTO) {
    const paso = Math.min(MINUTO, ms - hecho)
    reloj += paso
    mock.timers.tick(paso)
  }
}

const emitir = (objetivo, tipo) => objetivo.dispatchEvent(new Event(tipo))
const cambiarVisibilidad = (estado) => { doc.visibilityState = estado; emitir(doc, 'visibilitychange') }
// Deja que terminen las promesas de las consultas simuladas
const vaciar = async () => { for (let i = 0; i < 3; i++) await Promise.resolve() }

function iniciar(funcion = () => { llamadas++ }, opciones = {}) {
  parar = iniciarSondeo(funcion, { doc, ventana, ahora: () => reloj, ...opciones })
}

beforeEach(() => {
  mock.timers.enable({ apis: ['setInterval'] })
  reloj = 0
  llamadas = 0
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  ventana = new EventTarget()
})

afterEach(() => {
  parar?.()
  parar = null
  mock.timers.reset()
})

test('consulta cada minuto mientras la pestaña se ve y hay actividad', () => {
  iniciar()
  assert.strictEqual(llamadas, 0) // al entrar no consulta: lo hace el Layout al montarse
  for (let i = 1; i <= 3; i++) {
    emitir(ventana, 'mousemove') // sigo usando la app
    avanzar(MINUTO)
    assert.strictEqual(llamadas, i)
  }
})

test('se para tras 5 minutos sin actividad y no vuelve a consultar', () => {
  iniciar()
  avanzar(10 * MINUTO)
  // Minutos 1 a 4 consultan; en el 5 ya han pasado 5 minutos sin tocar nada y se para
  assert.strictEqual(llamadas, 4)
})

test('al mover el ratón tras parar, consulta en el acto y reanuda', () => {
  iniciar()
  avanzar(6 * MINUTO)
  assert.strictEqual(llamadas, 4)

  emitir(ventana, 'mousemove')
  assert.strictEqual(llamadas, 5) // consulta inmediata

  avanzar(MINUTO)
  assert.strictEqual(llamadas, 6) // y sigue su ritmo
})

test('con la pestaña oculta no consulta; al verla otra vez, consulta en el acto', () => {
  iniciar()
  emitir(ventana, 'keydown')
  cambiarVisibilidad('hidden')
  avanzar(3 * MINUTO)
  assert.strictEqual(llamadas, 0)

  cambiarVisibilidad('visible')
  assert.strictEqual(llamadas, 1)
  avanzar(MINUTO)
  assert.strictEqual(llamadas, 2)
})

test('con la pestaña oculta, mover el ratón no reanuda', () => {
  iniciar()
  cambiarVisibilidad('hidden')
  emitir(ventana, 'mousemove')
  avanzar(2 * MINUTO)
  assert.strictEqual(llamadas, 0)
})

test('no apila consultas si la anterior sigue en vuelo', async () => {
  let terminar
  iniciar(() => {
    llamadas++
    return new Promise((resolver) => { terminar = resolver })
  })
  emitir(ventana, 'mousemove')
  avanzar(MINUTO)
  emitir(ventana, 'mousemove')
  avanzar(MINUTO)
  assert.strictEqual(llamadas, 1) // la primera aún no ha respondido

  terminar()
  await vaciar()
  emitir(ventana, 'mousemove')
  avanzar(MINUTO)
  assert.strictEqual(llamadas, 2)
})

test('una consulta que falla (rechazada o con excepción) no para el sondeo', async () => {
  let n = 0
  iniciar(() => {
    n++
    if (n === 1) return Promise.reject(new Error('sin red'))
    if (n === 2) throw new Error('boom')
    return undefined
  })
  for (let i = 0; i < 3; i++) {
    emitir(ventana, 'mousemove')
    avanzar(MINUTO)
    await vaciar()
  }
  assert.strictEqual(n, 3)
})

test('al volver internet, consulta sin esperar al siguiente turno', () => {
  iniciar()
  emitir(ventana, 'mousemove')
  emitir(ventana, 'online')
  assert.strictEqual(llamadas, 1)
})

test('la función devuelta lo detiene todo y quita los oyentes', () => {
  iniciar()
  parar()
  emitir(ventana, 'mousemove')
  cambiarVisibilidad('hidden')
  cambiarVisibilidad('visible')
  avanzar(5 * MINUTO)
  assert.strictEqual(llamadas, 0)
})

test('se puede cambiar el ritmo y el tiempo de inactividad', () => {
  iniciar(undefined, { cada: 10_000, inactividad: 25_000 })
  const diezSegundos = () => { reloj += 10_000; mock.timers.tick(10_000) }
  diezSegundos()
  diezSegundos()
  assert.strictEqual(llamadas, 2)
  diezSegundos() // 30 s sin actividad > 25 s: se para
  assert.strictEqual(llamadas, 2)
})

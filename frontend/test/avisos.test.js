// Pruebas de los avisos del sistema del chat: qué mensajes se avisan, cuándo no y cómo se
// agrupan. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import {
  avisosNuevos, contenidoAviso, preferenciaAvisos, guardarPreferenciaAvisos, avisosActivos,
} from '../src/avisos.js'

const m = (ref, key, from, body, group = null) => ({ ref, key, from, group, body, created_at: '2026-10-24T10:00:00Z' })
const t = (clave, p = {}) => `${clave}|${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(',')}`

test('la primera consulta solo apunta: lo que ya había sin leer no se avisa', () => {
  const vistos = new Set()
  assert.deepStrictEqual(avisosNuevos([m('u1', 'ana', 'ana', 'hola')], vistos, { primeraVez: true }), [])
  assert.ok(vistos.has('u1'))
  assert.deepStrictEqual(avisosNuevos([m('u1', 'ana', 'ana', 'hola')], vistos), [], 'ya conocido')
})

test('lo nuevo se avisa una vez y agrupado por conversación', () => {
  const vistos = new Set(['u1'])
  const latest = [
    m('g9', 'g:3', 'luis', 'vamos', 'Viernes'),
    m('u3', 'ana', 'ana', '¿estás?'),
    m('u2', 'ana', 'ana', 'oye'),
    m('u1', 'ana', 'ana', 'hola'),
  ]
  assert.deepStrictEqual(avisosNuevos(latest, vistos), [
    { key: 'g:3', from: 'luis', group: 'Viernes', body: 'vamos', cuantos: 1 },
    { key: 'ana', from: 'ana', group: null, body: '¿estás?', cuantos: 2 },
  ])
  assert.deepStrictEqual(avisosNuevos(latest, vistos), [], 'no se repite')
})

test('con la ventana delante no se avisa, pero se apunta', () => {
  const vistos = new Set()
  assert.deepStrictEqual(avisosNuevos([m('u5', 'ana', 'ana', 'x')], vistos, { delante: true }), [])
  assert.deepStrictEqual(avisosNuevos([m('u5', 'ana', 'ana', 'x')], vistos), [], 'al irte no salta lo que ya viste')
})

test('el conjunto de vistos no crece sin fin', () => {
  const vistos = new Set(Array.from({ length: 300 }, (_, i) => `u${i}`))
  avisosNuevos([m('u999', 'ana', 'ana', 'x')], vistos)
  assert.deepStrictEqual([...vistos], ['u999'])
})

test('contenidoAviso: título con la persona o el grupo, y el número si son varios', () => {
  assert.deepStrictEqual(contenidoAviso({ from: 'ana', group: null, body: 'hola\n\nqué tal', cuantos: 1 }, t),
    { titulo: 'ana', texto: 'hola qué tal' })
  assert.deepStrictEqual(contenidoAviso({ from: 'luis', group: 'Viernes', body: 'vamos', cuantos: 3 }, t),
    { titulo: 'avisos.varios|quien=Viernes,n=3', texto: 'chat.de|usuario=luis,texto=vamos' })
})

test('preferencia guardada y avisos activos solo con permiso del navegador', () => {
  const datos = new Map()
  const almacen = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) }
  assert.strictEqual(preferenciaAvisos(almacen), null)
  guardarPreferenciaAvisos(true, almacen)
  assert.strictEqual(preferenciaAvisos(almacen), true)
  const conPermiso = { Notification: Object.assign(function () {}, { permission: 'granted' }) }
  const sinPermiso = { Notification: Object.assign(function () {}, { permission: 'denied' }) }
  assert.strictEqual(avisosActivos(conPermiso, almacen), true)
  assert.strictEqual(avisosActivos(sinPermiso, almacen), false)
  assert.strictEqual(avisosActivos({}, almacen), false, 'sin API de notificaciones')
  guardarPreferenciaAvisos(false, almacen)
  assert.strictEqual(avisosActivos(conPermiso, almacen), false)
  const roto = { getItem: () => { throw new Error('bloqueado') } }
  assert.strictEqual(preferenciaAvisos(roto), null)
})

// Pruebas de la parte social del cliente: reglas de privacidad (las mismas que las del
// servidor), tiempo relativo y que todos los textos que usa el código existen. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { puedeVer, GRUPOS_PRIVACIDAD, PRIVACIDAD_POR_DEFECTO, POLITICAS_SOLICITUD } from '../src/privacidad.js'
import { tiempoRelativo } from '../src/tiempo.js'
import { VISIBILIDADES } from '../src/validacion.js'
import es from '../src/textos/es.js'
import en from '../src/textos/en.js'

const require = createRequire(import.meta.url)
const servidor = require('../../backend/src/services/privacidad.js')
const reglas = require('../../backend/src/config/validacion.js')

test('puedeVer da lo mismo que el servidor en todas las combinaciones', () => {
  const niveles = [...VISIBILIDADES, undefined, null, '', 'publico']
  const relaciones = ['self', 'amigos', 'enviada', 'recibida', 'ninguna', 'otros']
  for (const nivel of niveles) {
    for (const relacion of relaciones) {
      assert.strictEqual(puedeVer(nivel, relacion), servidor.puedeVer(nivel, relacion), `${nivel} / ${relacion}`)
    }
  }
})

test('puedeVer: la tabla de lo que ve cada tipo de persona', () => {
  assert.deepStrictEqual(['self', 'amigos', 'otros'].map((r) => puedeVer('nadie', r)), [true, false, false])
  assert.deepStrictEqual(['self', 'amigos', 'otros'].map((r) => puedeVer('amigos', r)), [true, true, false])
  assert.deepStrictEqual(['self', 'amigos', 'otros'].map((r) => puedeVer('todos', r)), [true, true, true])
})

test('los ajustes de privacidad del cliente son los del servidor', () => {
  const delCliente = GRUPOS_PRIVACIDAD.flatMap((g) => g.campos)
  assert.deepStrictEqual([...delCliente].sort(), [...reglas.CAMPOS_VISIBILIDAD].sort())
  assert.deepStrictEqual(Object.keys(PRIVACIDAD_POR_DEFECTO).sort(), [...reglas.CAMPOS_VISIBILIDAD].sort())
  assert.deepStrictEqual(VISIBILIDADES, reglas.VISIBILIDADES)
  assert.deepStrictEqual(POLITICAS_SOLICITUD, reglas.POLITICAS_SOLICITUD)
  // Lo que no se ve por defecto es lo personal; el valor por defecto es siempre válido
  for (const valor of Object.values(PRIVACIDAD_POR_DEFECTO)) assert.ok(VISIBILIDADES.includes(valor))
  assert.strictEqual(PRIVACIDAD_POR_DEFECTO.visibility_name, 'nadie')
})

test('tiempoRelativo: de hace un momento a hace años, en los dos idiomas', () => {
  const ahora = new Date('2026-10-15T12:00:00Z').getTime()
  const hace = (segundos) => new Date(ahora - segundos * 1000).toISOString()

  assert.strictEqual(tiempoRelativo(hace(5), 'es', ahora), 'ahora')
  assert.strictEqual(tiempoRelativo(hace(5), 'en', ahora), 'now')
  assert.strictEqual(tiempoRelativo(hace(5 * 60), 'es', ahora), 'hace 5 minutos')
  assert.strictEqual(tiempoRelativo(hace(2 * 3600), 'es', ahora), 'hace 2 horas')
  assert.strictEqual(tiempoRelativo(hace(2 * 3600), 'en', ahora), '2 hours ago')
  assert.strictEqual(tiempoRelativo(hace(24 * 3600), 'es', ahora), 'ayer')
  assert.strictEqual(tiempoRelativo(hace(3 * 24 * 3600), 'es', ahora), 'hace 3 días')
  assert.strictEqual(tiempoRelativo(hace(14 * 24 * 3600), 'en', ahora), '2 weeks ago')
  assert.strictEqual(tiempoRelativo(hace(400 * 24 * 3600), 'es', ahora), 'el año pasado')
})

// Todo texto que el código pide con t('clave') tiene que existir en los dos diccionarios:
// una clave que falte se vería como la propia clave en pantalla. Las claves que se
// construyen (t(`social.tab.${id}`)) se comprueban por su prefijo: tiene que haber alguna.
test('toda clave de texto que usa el código existe en es.js y en en.js', () => {
  const carpeta = path.resolve(import.meta.dirname, '../src')
  const fijas = new Set()
  const prefijos = new Set()

  for (const archivo of fs.readdirSync(carpeta).filter((f) => /\.(jsx?|js)$/.test(f))) {
    const codigo = fs.readFileSync(path.join(carpeta, archivo), 'utf8')
    for (const m of codigo.matchAll(/\bt\('([A-Za-z0-9_]+\.[A-Za-z0-9_.]+)'/g)) fijas.add(m[1])
    for (const m of codigo.matchAll(/\bt\(`([A-Za-z0-9_.]+)\.\$\{/g)) prefijos.add(m[1] + '.')
  }

  assert.ok(fijas.size > 100, `solo encontré ${fijas.size} claves: ¿cambió el formato?`)
  for (const clave of fijas) {
    assert.ok(clave in es, `falta en es.js: ${clave}`)
    assert.ok(clave in en, `falta en en.js: ${clave}`)
  }
  for (const prefijo of prefijos) {
    assert.ok(Object.keys(es).some((k) => k.startsWith(prefijo)), `ninguna clave empieza por ${prefijo}`)
  }
})

// Las claves de los ajustes de privacidad y de los estados se construyen con ${...}: aquí
// se comprueba que existen todas las combinaciones que se pueden pedir.
test('existen los textos de cada ajuste de privacidad, de cada nivel y de cada política', () => {
  const claves = [
    ...GRUPOS_PRIVACIDAD.flatMap((g) => [`privacidad.grupo.${g.id}`, `privacidad.grupo.${g.id}.ayuda`]),
    ...GRUPOS_PRIVACIDAD.flatMap((g) => g.campos.flatMap((c) => [`privacidad.campo.${c}`, `privacidad.campo.${c}.ayuda`])),
    ...VISIBILIDADES.map((v) => `privacidad.${v}`),
    ...POLITICAS_SOLICITUD.map((p) => `privacidad.politica.${p}`),
    ...['jugando', 'completado', 'abandonado', 'pendiente'].map((s) => `social.actividad.verbo.${s}`),
    ...['actividad', 'amigos', 'solicitudes', 'descubrir', 'bloqueados'].flatMap((id) => [`social.tab.${id}`, `social.ayuda.${id}`]),
    ...['resumen', 'biblioteca', 'amigos'].map((id) => `publico.tab.${id}`),
  ]
  for (const clave of claves) {
    assert.ok(clave in es, `falta en es.js: ${clave}`)
    assert.ok(clave in en, `falta en en.js: ${clave}`)
  }
})

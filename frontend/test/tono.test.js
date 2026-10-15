// Pruebas de las utilidades de la parte social: el color de cada persona, la agrupación de
// la actividad por días y las filas del "cara a cara". npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { tonoDe, estiloTono } from '../src/tono.js'
import { tramoDia } from '../src/tiempo.js'
import { compararBibliotecas } from '../src/comparar.js'

test('tonoDe: siempre el mismo para el mismo nombre y dentro de 0 a 359', () => {
  const nombres = ['ana', 'demo_gus', 'x', 'jesus_gallego', 'a'.repeat(20), '', 'ñandu']
  for (const n of nombres) {
    const t = tonoDe(n)
    assert.strictEqual(t, tonoDe(n))
    assert.ok(Number.isInteger(t) && t >= 0 && t < 360, `${n} -> ${t}`)
  }
  assert.deepStrictEqual(estiloTono('ana'), { '--tono': tonoDe('ana') })
})

test('tonoDe: nombres parecidos dan tonos distintos (no se amontonan)', () => {
  const tonos = new Set(['demo_ana', 'demo_beto', 'demo_carla', 'demo_dani', 'demo_eva', 'demo_fran', 'demo_gus', 'demo_hugo'].map(tonoDe))
  assert.ok(tonos.size >= 7, `solo ${tonos.size} tonos distintos de 8`)
})

test('tramoDia: hoy, ayer, semana, mes y antes (por días de calendario)', () => {
  const ahora = new Date(2026, 9, 15, 12, 0).getTime() // 15 oct 2026, mediodía
  const hace = (dias, h = 12) => new Date(2026, 9, 15 - dias, h, 0).getTime()

  assert.strictEqual(tramoDia(hace(0, 0), ahora), 'hoy')
  assert.strictEqual(tramoDia(ahora - 60_000, ahora), 'hoy')
  // Las 23:50 de ayer son "ayer" aunque hagan solo 12 horas
  assert.strictEqual(tramoDia(hace(1, 23), ahora), 'ayer')
  assert.strictEqual(tramoDia(hace(2), ahora), 'semana')
  assert.strictEqual(tramoDia(hace(8), ahora), 'semana')
  assert.strictEqual(tramoDia(hace(9), ahora), 'mes')
  assert.strictEqual(tramoDia(hace(38), ahora), 'mes')
  assert.strictEqual(tramoDia(hace(39), ahora), 'antes')
  // Una fecha en el futuro (relojes desajustados) cuenta como hoy
  assert.strictEqual(tramoDia(ahora + 3_600_000 * 30, ahora), 'hoy')
})

test('compararBibliotecas: quién gana en cada fila y la escala de las barras', () => {
  const filas = compararBibliotecas(
    { total: 4, completado: 2, nota_media: 7.5 },
    { total: 9, completado: 2, nota_media: 9.7 },
  )
  assert.deepStrictEqual(filas.map((f) => [f.id, f.gana]), [['juegos', 'suyo'], ['completados', 'empate'], ['nota', 'suyo']])
  assert.strictEqual(filas[0].maximo, 9)
  assert.strictEqual(filas[2].maximo, 10)
})

test('compararBibliotecas: sin datos de alguno no hay comparación; sin notas es empate', () => {
  assert.strictEqual(compararBibliotecas(null, { total: 1 }), null)
  assert.strictEqual(compararBibliotecas({ total: 1 }, undefined), null)
  const filas = compararBibliotecas(
    { total: 0, completado: 0, nota_media: null },
    { total: 3, completado: 1, nota_media: 8 },
  )
  assert.strictEqual(filas[2].gana, 'empate')
  assert.strictEqual(filas[0].gana, 'suyo')
  // Dos bibliotecas vacías: la escala nunca es 0 (evita dividir entre cero al pintar)
  const vacias = compararBibliotecas({ total: 0, completado: 0, nota_media: null }, { total: 0, completado: 0, nota_media: null })
  assert.ok(vacias.every((f) => f.maximo >= 1))
})

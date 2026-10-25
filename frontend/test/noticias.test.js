// Pruebas de la lógica de las noticias en la interfaz: motivos, portales por idioma, juntar
// páginas, el cursor de Siguiendo, la noticia más reciente, la cola de sucesos y que no falte ningún
// logo de portal. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import {
  claveMotivo, portalesPorIdioma, preseleccion, juntarNoticias, cursorSiguiente, masReciente, crearCola,
} from '../src/logicaNoticias.js'
import es from '../src/textos/es.js'
import en from '../src/textos/en.js'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const n = (id, slug = 'a', fecha = '2026-10-24T10:00:00Z') => ({ id, published_at: fecha, source: { slug } })

test('cada motivo del servidor tiene su texto en los dos idiomas', () => {
  for (const kind of ['juego', 'amigos', 'similar', 'portal', 'descubrir', 'reciente']) {
    const clave = claveMotivo({ kind })
    assert.ok(es[clave] && en[clave], clave)
  }
  assert.strictEqual(claveMotivo(null), null)
})

test('portales por idioma, el de la interfaz primero, y la primera propuesta', () => {
  const portales = [{ slug: 'ign', lang: 'en' }, { slug: 'vandal', lang: 'es' }, { slug: 'pcg', lang: 'en' }]
  assert.deepStrictEqual(portalesPorIdioma(portales, 'en').map((g) => [g.lang, g.portales.map((p) => p.slug)]), [
    ['en', ['ign', 'pcg']], ['es', ['vandal']],
  ])
  assert.deepStrictEqual(portalesPorIdioma(portales, 'es')[0].lang, 'es')
  assert.deepStrictEqual(preseleccion(portales, 'es'), ['vandal'])
  assert.deepStrictEqual(portalesPorIdioma([], 'es'), [])
})

test('juntar páginas sin repetir y el cursor de la siguiente', () => {
  assert.deepStrictEqual(juntarNoticias([n(1), n(2)], [n(2), n(3)]).map((x) => x.id), [1, 2, 3])
  assert.strictEqual(cursorSiguiente([n(1), n(7, 'a', '2026-10-20T08:00:00.000Z')]), 'before=2026-10-20T08%3A00%3A00.000Z&before_id=7')
  assert.strictEqual(cursorSiguiente([]), '')
})

test('la noticia más reciente, también contra la que ya había', () => {
  const ns = [n(1, 'a', '2026-10-24T09:00:00Z'), n(2, 'a', '2026-10-24T11:00:00Z')]
  assert.strictEqual(masReciente(ns), '2026-10-24T11:00:00Z')
  assert.strictEqual(masReciente(ns, '2026-10-24T12:00:00Z'), '2026-10-24T12:00:00Z', 'la previa es más nueva')
  assert.strictEqual(masReciente([], '2026-10-24T08:00:00Z'), '2026-10-24T08:00:00Z')
  assert.strictEqual(masReciente(undefined), null)
})

test('la cola: una impresión por noticia y pestaña, los clics siempre, y por tandas', () => {
  const cola = crearCola(2)
  assert.strictEqual(cola.impresion(n(1), 'para_ti', 0), true)
  assert.strictEqual(cola.impresion(n(1), 'para_ti', 0), false, 'la misma no se repite')
  assert.strictEqual(cola.impresion(n(1), 'siguiendo', 3), true, 'en la otra pestaña sí cuenta')
  cola.clic(n(1), 'para_ti', 0)
  cola.clic(n(1), 'para_ti', 0)
  assert.strictEqual(cola.pendientes, 4)
  assert.deepStrictEqual(cola.tomar(), [
    { article_id: 1, kind: 'impression', feed: 'para_ti', position: 0 },
    { article_id: 1, kind: 'impression', feed: 'siguiendo', position: 3 },
  ])
  assert.strictEqual(cola.tomar().length, 2)
  assert.strictEqual(cola.pendientes, 0)
})

test('cada portal del catálogo tiene su logo en src/logos-portales', () => {
  // El catálogo es del backend (CommonJS): se carga con require
  const portales = createRequire(import.meta.url)('../../backend/src/config/portales.js')
  const sinLogo = portales.filter((p) => !existsSync(new URL(`../src/logos-portales/${p.slug}.png`, import.meta.url)))
  assert.deepStrictEqual(sinLogo.map((p) => p.slug), [], 'falta el PNG de estos portales')
})

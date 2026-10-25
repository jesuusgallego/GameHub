// Pruebas de la app instalada (PWA): reconocer el iPhone y el iPad, saber si ya está instalada,
// detectar una versión nueva, y que el manifiesto, los iconos y las pantallas de arranque de
// index.html existan y encajen. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import {
  esIOS, esAppInstalada, puedeInstalarseEnIOS, instalarDescartado, descartarInstalar, scriptPrincipal, hayVersionNueva,
} from '../src/pwa.js'
import { avisosDisponibles } from '../src/avisos.js'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
const ventana = ({ ua, toques = 0, standalone, modo = false }) => ({
  navigator: { userAgent: ua, maxTouchPoints: toques, standalone },
  matchMedia: () => ({ matches: modo }),
})

test('reconoce el iPhone y el iPad (que dice ser un Mac, pero táctil), y no un Mac ni Windows', () => {
  assert.strictEqual(esIOS({ userAgent: IPHONE }), true)
  assert.strictEqual(esIOS({ userAgent: IPAD, maxTouchPoints: 5 }), true)
  assert.strictEqual(esIOS({ userAgent: IPAD, maxTouchPoints: 0 }), false, 'un Mac de verdad')
  assert.strictEqual(esIOS({ userAgent: WINDOWS }), false)
  assert.strictEqual(esIOS(undefined), false)
})

test('instalada: por navigator.standalone (Safari) o por display-mode; y solo entonces no se explica', () => {
  assert.strictEqual(esAppInstalada(ventana({ ua: IPHONE, standalone: true })), true)
  assert.strictEqual(esAppInstalada(ventana({ ua: WINDOWS, modo: true })), true)
  assert.strictEqual(esAppInstalada(ventana({ ua: IPHONE, standalone: false })), false)
  assert.strictEqual(puedeInstalarseEnIOS(ventana({ ua: IPHONE, standalone: false })), true)
  assert.strictEqual(puedeInstalarseEnIOS(ventana({ ua: IPHONE, standalone: true })), false, 'ya instalada')
  assert.strictEqual(puedeInstalarseEnIOS(ventana({ ua: WINDOWS })), false, 'no es iOS')
})

test('cerrar la explicación se recuerda, y sin almacenamiento no falla', () => {
  const datos = new Map()
  const almacen = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) }
  assert.strictEqual(instalarDescartado(almacen), false)
  descartarInstalar(almacen)
  assert.strictEqual(instalarDescartado(almacen), true)
  const roto = { getItem() { throw new Error('privado') }, setItem() { throw new Error('privado') } }
  assert.strictEqual(instalarDescartado(roto), false)
  assert.doesNotThrow(() => descartarInstalar(roto))
})

test('versión nueva: compara el script principal con huella de las dos páginas', () => {
  const html = (h) => `<head><script type="module" crossorigin src="/GameHub/assets/index-${h}.js"></script></head>`
  assert.strictEqual(scriptPrincipal(html('abc123')), '/GameHub/assets/index-abc123.js')
  assert.strictEqual(scriptPrincipal('<p>sin script</p>'), null)
  assert.strictEqual(hayVersionNueva(scriptPrincipal(html('a')), scriptPrincipal(html('b'))), true)
  assert.strictEqual(hayVersionNueva(scriptPrincipal(html('a')), scriptPrincipal(html('a'))), false)
  assert.strictEqual(hayVersionNueva('/assets/index-a.js', null), false, 'si no se sabe, no se avisa')
})

test('en iOS no se ofrecen los avisos del chat (allí solo llegarían por push)', () => {
  const Notification = function () {}
  assert.strictEqual(avisosDisponibles({ navigator: { userAgent: IPHONE }, Notification }), false)
  assert.strictEqual(avisosDisponibles({ navigator: { userAgent: WINDOWS }, Notification }), true)
})

test('el manifiesto y sus iconos existen y son los que pide la instalación', () => {
  const manifiesto = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)))
  assert.strictEqual(manifiesto.display, 'standalone')
  assert.strictEqual(manifiesto.start_url, './', 'relativo: la app vive en una subcarpeta')
  const tamanos = manifiesto.icons.map((i) => `${i.sizes}:${i.purpose}`)
  for (const t of ['192x192:any', '512x512:any', '512x512:maskable']) assert.ok(tamanos.includes(t), t)
  for (const icono of manifiesto.icons) assert.ok(existsSync(new URL(`../public/${icono.src}`, import.meta.url)), icono.src)
  assert.ok(existsSync(new URL('../public/iconos/apple-touch-icon.png', import.meta.url)))
})

test('cada pantalla de arranque de index.html existe, y no sobra ninguna', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const enlazadas = [...html.matchAll(/rel="apple-touch-startup-image"[^>]*href="\/arranque\/([^"]+)"/g)].map((m) => m[1]).sort()
  const archivos = readdirSync(new URL('../public/arranque/', import.meta.url)).filter((f) => f.endsWith('.png')).sort()
  assert.ok(enlazadas.length >= 10)
  assert.deepStrictEqual(enlazadas, archivos)
  // El ancho y el alto del nombre de cada una coinciden con su media query (puntos × densidad)
  for (const m of html.matchAll(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)[^>]*href="\/arranque\/arranque-(\d+)x(\d+)\.png"/g)) {
    const [, w, h, d, pw, ph] = m.map(Number)
    assert.deepStrictEqual([w * d, h * d], [pw, ph], m[0])
  }
})

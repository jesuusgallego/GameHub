// Los dos diccionarios de textos (es.js y en.js) deben tener exactamente las mismas claves:
// una clave que falte en un idioma se vería como el texto en español, o como la propia
// clave, sin avisar. Se ejecutan con: npm test
import { test } from 'node:test'
import assert from 'node:assert'
import es from '../src/textos/es.js'
import en from '../src/textos/en.js'

test('es.js y en.js tienen las mismas claves', () => {
  const soloEs = Object.keys(es).filter((k) => !(k in en))
  const soloEn = Object.keys(en).filter((k) => !(k in es))
  assert.deepStrictEqual(soloEs, [], `faltan en en.js: ${soloEs.join(', ')}`)
  assert.deepStrictEqual(soloEn, [], `faltan en es.js: ${soloEn.join(', ')}`)
})

test('ningún texto está vacío y los huecos {nombre} coinciden entre idiomas', () => {
  const huecos = (t) => (t.match(/\{\w+\}/g) ?? []).sort().join(',')
  for (const [clave, texto] of Object.entries(es)) {
    assert.ok(texto.trim() !== '', `${clave} está vacío en es.js`)
    assert.ok(en[clave]?.trim() !== '', `${clave} está vacío en en.js`)
    assert.strictEqual(huecos(en[clave] ?? ''), huecos(texto), `${clave}: los {huecos} no coinciden`)
  }
})

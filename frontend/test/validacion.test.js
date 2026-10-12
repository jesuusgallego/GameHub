// Pruebas de las reglas de validación de los formularios. Se ejecutan con: npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'
import { emailRegex, passwordRegex } from '../src/validacion.js'

test('emailRegex acepta emails normales y rechaza los mal formados', () => {
  for (const ok of ['ana@x.com', 'ana.perez+gh@correo.example.com']) assert.ok(emailRegex.test(ok), ok)
  for (const mal of ['', 'ana', 'ana@', 'ana@x', 'a na@x.com', '@x.com']) assert.ok(!emailRegex.test(mal), mal)
})

test('passwordRegex exige 8 caracteres, mayúscula, minúscula y número', () => {
  for (const ok of ['Clave1234', 'Ñandú-Fuerte9']) assert.ok(passwordRegex.test(ok), ok)
  for (const mal of ['', 'corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeros']) assert.ok(!passwordRegex.test(mal), mal)
})

// Si el formulario y el servidor discreparan, el formulario dejaría pasar cosas que el
// servidor rechaza (o al revés). Las reglas viven en dos sitios porque son dos paquetes;
// esta prueba hace que no se separen sin avisar.
test('las reglas coinciden con las del backend', () => {
  const require = createRequire(import.meta.url)
  const servidor = require('../../backend/src/config/validacion.js')
  assert.strictEqual(emailRegex.source, servidor.EMAIL_REGEX.source)
  assert.strictEqual(passwordRegex.source, servidor.PASSWORD_REGEX.source)
})

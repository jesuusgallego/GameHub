// Pruebas de las reglas de validación de los formularios. Se ejecutan con: npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'
import { emailRegex, passwordRegex, usernameRegex, normalizarUsername, USERNAME_MAX } from '../src/validacion.js'
import { erroresApi } from '../src/textos/en.js'

test('emailRegex acepta emails normales y rechaza los mal formados', () => {
  for (const ok of ['ana@x.com', 'ana.perez+gh@correo.example.com']) assert.ok(emailRegex.test(ok), ok)
  for (const mal of ['', 'ana', 'ana@', 'ana@x', 'a na@x.com', '@x.com']) assert.ok(!emailRegex.test(mal), mal)
})

test('passwordRegex exige 8 caracteres, mayúscula, minúscula y número', () => {
  for (const ok of ['Clave1234', 'Ñandú-Fuerte9']) assert.ok(passwordRegex.test(ok), ok)
  for (const mal of ['', 'corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeros']) assert.ok(!passwordRegex.test(mal), mal)
})

test('usernameRegex exige 3 a 20 caracteres en mayúsculas, números o guion bajo', () => {
  for (const ok of ['ANA', 'JESUS_GALLEGO', 'XX_PRO_99', 'A'.repeat(20), '123', '___']) assert.ok(usernameRegex.test(ok), ok)
  for (const mal of ['', 'AB', 'ana', 'Ana', 'AN A', 'ANA!', 'ÑANDU', 'JOSÉ', 'ANA-B', 'A@B', 'A'.repeat(21), 'ANA\n']) {
    assert.ok(!usernameRegex.test(mal), JSON.stringify(mal))
  }
  assert.strictEqual(USERNAME_MAX, 20)
})

test('normalizarUsername deja el texto listo para el campo', () => {
  const casos = {
    'ana': 'ANA', 'José Ñandú': 'JOSENANDU', 'xX_Pro-Gamer.99': 'XX_PROGAMER99',
    '  espacios  ': 'ESPACIOS', '日本語': '', 'ya_válido_1': 'YA_VALIDO_1', '': '',
  }
  for (const [entrada, salida] of Object.entries(casos)) {
    assert.strictEqual(normalizarUsername(entrada), salida, entrada)
  }
  // Lo que sale del campo es lo que el servidor acepta (si tiene 3 o más caracteres)
  assert.ok(usernameRegex.test(normalizarUsername('Jesús Gallego')))
})

// Si el formulario y el servidor discreparan, el formulario dejaría pasar cosas que el
// servidor rechaza (o al revés). Las reglas viven en dos sitios porque son dos paquetes;
// esta prueba hace que no se separen sin avisar.
test('las reglas coinciden con las del backend', () => {
  const require = createRequire(import.meta.url)
  const servidor = require('../../backend/src/config/validacion.js')
  assert.strictEqual(emailRegex.source, servidor.EMAIL_REGEX.source)
  assert.strictEqual(passwordRegex.source, servidor.PASSWORD_REGEX.source)
  assert.strictEqual(usernameRegex.source, servidor.USERNAME_REGEX.source)
})

// El error del servidor llega en español y se traduce buscando su texto exacto en
// erroresApi: si el mensaje cambia en un sitio y no en el otro, en inglés saldría en español.
test('el mensaje de nombre de usuario del servidor tiene traducción', () => {
  const require = createRequire(import.meta.url)
  const { MENSAJE_USERNAME } = require('../../backend/src/config/validacion.js')
  assert.ok(erroresApi[MENSAJE_USERNAME], 'falta en erroresApi de en.js')
})

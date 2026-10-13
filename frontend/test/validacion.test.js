// Pruebas de las reglas de validación de los formularios. Se ejecutan con: npm test
import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'node:module'
import {
  emailRegex, passwordRegex, usernameRegex, normalizarUsername, USERNAME_MAX,
  SEXOS, LIMITES_PERFIL, EDAD_MAX, limitesFechaNacimiento, telefonoRegex, normalizarTelefono,
} from '../src/validacion.js'
import { PAISES, nombrePais, opcionesPaises } from '../src/paises.js'
import es from '../src/textos/es.js'
import en from '../src/textos/en.js'
import { erroresApi } from '../src/textos/en.js'

test('emailRegex acepta emails normales y rechaza los mal formados', () => {
  for (const ok of ['ana@x.com', 'ana.perez+gh@correo.example.com']) assert.ok(emailRegex.test(ok), ok)
  for (const mal of ['', 'ana', 'ana@', 'ana@x', 'a na@x.com', '@x.com']) assert.ok(!emailRegex.test(mal), mal)
})

test('passwordRegex exige 8 caracteres, mayúscula, minúscula y número', () => {
  for (const ok of ['Clave1234', 'Ñandú-Fuerte9']) assert.ok(passwordRegex.test(ok), ok)
  for (const mal of ['', 'corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeros']) assert.ok(!passwordRegex.test(mal), mal)
})

test('usernameRegex exige 3 a 20 caracteres en minúsculas, números o guion bajo', () => {
  for (const ok of ['ana', 'jesus_gallego', 'xx_pro_99', 'a'.repeat(20), '123', '___']) assert.ok(usernameRegex.test(ok), ok)
  for (const mal of ['', 'ab', 'ANA', 'Ana', 'an a', 'ana!', 'ñandu', 'josé', 'ana-b', 'a@b', 'a'.repeat(21), 'ana\n']) {
    assert.ok(!usernameRegex.test(mal), JSON.stringify(mal))
  }
  assert.strictEqual(USERNAME_MAX, 20)
})

test('normalizarUsername deja el texto listo para el campo', () => {
  const casos = {
    'ANA': 'ana', 'José Ñandú': 'josenandu', 'xX_Pro-Gamer.99': 'xx_progamer99',
    '  espacios  ': 'espacios', '日本語': '', 'YA_VÁLIDO_1': 'ya_valido_1', '': '',
  }
  for (const [entrada, salida] of Object.entries(casos)) {
    assert.strictEqual(normalizarUsername(entrada), salida, entrada)
  }
  // Lo que sale del campo es lo que el servidor acepta (si tiene 3 o más caracteres)
  assert.ok(usernameRegex.test(normalizarUsername('Jesús Gallego')))
})

test('limitesFechaNacimiento: de hoy a hace 120 años, en formato AAAA-MM-DD', () => {
  assert.deepStrictEqual(limitesFechaNacimiento(new Date(2026, 9, 13)), { min: '1906-10-13', max: '2026-10-13' })
  assert.deepStrictEqual(limitesFechaNacimiento(new Date(2026, 0, 5)), { min: '1906-01-05', max: '2026-01-05' })
})

test('telefonoRegex y normalizarTelefono: formato internacional sin separadores', () => {
  const casos = {
    '+34 600 123 456': '+34600123456', '0034-600.123.456': '+34600123456', '(+34) 600123456': '+34600123456',
    '+1 (415) 555-0132': '+14155550132', '600123456': '600123456', '': '',
  }
  for (const [entrada, salida] of Object.entries(casos)) {
    assert.strictEqual(normalizarTelefono(entrada), salida, entrada)
  }
  for (const ok of ['+34600123456', '+14155550132', '+1234567']) assert.ok(telefonoRegex.test(ok), ok)
  for (const mal of ['', '600123456', '+0123456789', '+34 600', '+3460012345678901', '+34abc123456', '34600123456']) {
    assert.ok(!telefonoRegex.test(mal), mal)
  }
})

test('la lista de países: 250 códigos únicos, con nombre en español e inglés', () => {
  assert.strictEqual(PAISES.length, 250)
  assert.strictEqual(new Set(PAISES).size, PAISES.length, 'hay códigos repetidos')
  for (const codigo of PAISES) {
    assert.match(codigo, /^[A-Z]{2}$/)
    for (const idioma of ['es', 'en']) {
      assert.notStrictEqual(nombrePais(codigo, idioma), codigo, `${codigo} sin nombre en ${idioma}`)
    }
  }
  assert.strictEqual(nombrePais('ES', 'es'), 'España')
  assert.strictEqual(nombrePais('ES', 'en'), 'Spain')
  assert.strictEqual(nombrePais('DE', 'es'), 'Alemania')
})

test('opcionesPaises ordena por el nombre en el idioma de la interfaz', () => {
  const es = opcionesPaises('es').map((o) => o.etiqueta)
  const en = opcionesPaises('en').map((o) => o.etiqueta)
  assert.strictEqual(es.length, 250)
  assert.ok(es.indexOf('Alemania') < es.indexOf('España'))
  assert.ok(es.indexOf('España') < es.indexOf('Francia'))
  assert.ok(en.indexOf('Spain') < en.indexOf('Sweden'))
  assert.ok(opcionesPaises('es').some((o) => o.valor === 'ES' && o.etiqueta === 'España'))
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
  assert.deepStrictEqual(SEXOS, servidor.SEXOS)
  assert.strictEqual(EDAD_MAX, servidor.EDAD_MAX)
  for (const [campo, max] of Object.entries(LIMITES_PERFIL)) {
    assert.strictEqual(max, servidor.TEXTOS_PERFIL[campo].max, campo)
  }
  assert.deepStrictEqual(Object.keys(LIMITES_PERFIL), Object.keys(servidor.TEXTOS_PERFIL))
  assert.strictEqual(telefonoRegex.source, servidor.TELEFONO_REGEX.source)
  assert.deepStrictEqual(PAISES, servidor.PAISES)
  // Misma normalización del teléfono en los dos lados
  for (const t of ['+34 600 123 456', '0034-600.123.456', '(+34) 600123456', '600 123 456', '', ' +1 415 555 0132 ']) {
    assert.strictEqual(normalizarTelefono(t), servidor.normalizarTelefono(t), JSON.stringify(t))
  }
})

test('cada opción de sexo tiene texto en los dos idiomas', () => {
  for (const sexo of SEXOS) {
    assert.ok(es[`sexo.${sexo}`], `sexo.${sexo} en es.js`)
    assert.ok(en[`sexo.${sexo}`], `sexo.${sexo} en en.js`)
  }
})

// El error del servidor llega en español y se traduce buscando su texto exacto en
// erroresApi: si el mensaje cambia en un sitio y no en el otro, en inglés saldría en español.
test('los mensajes de validación del servidor tienen traducción', () => {
  const require = createRequire(import.meta.url)
  const servidor = require('../../backend/src/config/validacion.js')
  const mensajes = [
    servidor.MENSAJE_USERNAME, servidor.MENSAJE_SEXO, servidor.MENSAJE_FECHA_NACIMIENTO,
    servidor.MENSAJE_PAIS, servidor.MENSAJE_TELEFONO,
    ...Object.values(servidor.TEXTOS_PERFIL).map((c) => c.mensaje),
  ]
  for (const mensaje of mensajes) assert.ok(erroresApi[mensaje], `falta en erroresApi de en.js: ${mensaje}`)
})

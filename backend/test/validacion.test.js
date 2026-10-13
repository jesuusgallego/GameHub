// Pruebas de la validación del registro y de las reglas compartidas (sin base de datos:
// si alguna entrada inválida llegara a consultarla, la prueba falla). npm test
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

const rutaDb = require.resolve('../src/config/db');
let consultas = 0;
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: { query: async () => { consultas++; throw new Error('no debería consultar la BD'); } },
};

const { register } = require('../src/controllers/authController');
const { EMAIL_REGEX, PASSWORD_REGEX, USERNAME_REGEX, MENSAJE_USERNAME } = require('../src/config/validacion');

async function registrar(body) {
  const res = { status(c) { this.c = c; return this; }, json(o) { this.o = o; } };
  await register({ body }, res);
  return { status: res.c, error: res.o?.error };
}

const valido = { username: 'ANA', email: 'ana@x.com', password: 'Clave1234' };

test('el registro rechaza lo que no es texto o está vacío', async () => {
  for (const malo of [
    {}, { ...valido, username: '' }, { ...valido, username: '   ' }, { ...valido, email: 5 },
    { ...valido, password: { $ne: 1 } }, { ...valido, password: undefined },
  ]) {
    const r = await registrar(malo);
    assert.strictEqual(r.status, 400, JSON.stringify(malo));
    assert.strictEqual(r.error, 'Faltan campos obligatorios');
  }
  assert.strictEqual(consultas, 0);
});

test('el registro rechaza un email mal formado', async () => {
  for (const email of ['ana', 'ana@', 'ana@x', 'a na@x.com', '@x.com']) {
    const r = await registrar({ ...valido, email });
    assert.strictEqual(r.status, 400, email);
    assert.strictEqual(r.error, 'El email no tiene un formato válido');
  }
  assert.strictEqual(consultas, 0);
});

test('el registro rechaza contraseñas débiles', async () => {
  for (const password of ['a', 'corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeros']) {
    const r = await registrar({ ...valido, password });
    assert.strictEqual(r.status, 400, password);
    assert.match(r.error, /contraseña debe tener al menos 8 caracteres/);
  }
  assert.strictEqual(consultas, 0);
});

test('el registro rechaza un nombre de usuario que no cumple la regla', async () => {
  const malos = [
    'ana', 'Ana', 'AnA', // minúsculas
    'AB', 'A', // demasiado corto
    'A'.repeat(21), // demasiado largo
    'ANA GOMEZ', ' ANA', 'ANA ', // espacios (el servidor no recorta)
    'ANA!', 'ANA-B', 'ANA.B', 'ANA@X', 'ÑANDU', 'JOSÉ', '日本語', 'ANA\n',
  ];
  for (const username of malos) {
    const r = await registrar({ ...valido, username });
    assert.strictEqual(r.status, 400, JSON.stringify(username));
    assert.strictEqual(r.error, MENSAJE_USERNAME, JSON.stringify(username));
  }
  assert.strictEqual(consultas, 0);
});

test('el nombre de usuario acepta mayúsculas, números y guion bajo (3 a 20)', () => {
  for (const ok of ['ANA', 'JESUS_GALLEGO', 'XX_PRO_99', 'A'.repeat(20), '123', '___']) {
    assert.ok(USERNAME_REGEX.test(ok), ok);
  }
});

test('las reglas aceptan lo normal', () => {
  assert.ok(EMAIL_REGEX.test('ana.perez+gh@correo.example.com'));
  assert.ok(PASSWORD_REGEX.test('Clave1234'));
  assert.ok(PASSWORD_REGEX.test('Ñandú-Fuerte9'));
});

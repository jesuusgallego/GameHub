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
const {
  EMAIL_REGEX, PASSWORD_REGEX, USERNAME_REGEX, MENSAJE_USERNAME,
  limpiarTextoPerfil, fechaNacimientoValida,
} = require('../src/config/validacion');

async function registrar(body) {
  const res = { status(c) { this.c = c; return this; }, json(o) { this.o = o; } };
  await register({ body }, res);
  return { status: res.c, error: res.o?.error };
}

const valido = { username: 'ana', email: 'ana@x.com', password: 'Clave1234' };

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
    'ANA', 'Ana', 'aNa', // mayúsculas
    'ab', 'a', // demasiado corto
    'a'.repeat(21), // demasiado largo
    'ana gomez', ' ana', 'ana ', // espacios (el servidor no recorta)
    'ana!', 'ana-b', 'ana.b', 'ana@x', 'ñandu', 'josé', '日本語', 'ana\n',
  ];
  for (const username of malos) {
    const r = await registrar({ ...valido, username });
    assert.strictEqual(r.status, 400, JSON.stringify(username));
    assert.strictEqual(r.error, MENSAJE_USERNAME, JSON.stringify(username));
  }
  assert.strictEqual(consultas, 0);
});

test('el nombre de usuario acepta minúsculas, números y guion bajo (3 a 20)', () => {
  for (const ok of ['ana', 'jesus_gallego', 'xx_pro_99', 'a'.repeat(20), '123', '___']) {
    assert.ok(USERNAME_REGEX.test(ok), ok);
  }
});

test('limpiarTextoPerfil recorta, convierte el vacío en null y rechaza lo que no vale', () => {
  assert.strictEqual(limpiarTextoPerfil('first_name', '  Ana María '), 'Ana María');
  assert.strictEqual(limpiarTextoPerfil('first_name', ''), null);
  assert.strictEqual(limpiarTextoPerfil('first_name', '   '), null);
  assert.strictEqual(limpiarTextoPerfil('first_name', null), null);
  assert.strictEqual(limpiarTextoPerfil('last_name', "O'Brien-Ñúñez"), "O'Brien-Ñúñez");
  // Los límites cuentan caracteres, no unidades UTF-16 (un emoji ocupa dos)
  assert.strictEqual(limpiarTextoPerfil('first_name', '😀'.repeat(50)), '😀'.repeat(50));
  for (const malo of ['a'.repeat(51), 'a\nb', 'a\u0000b', 5, {}, ['a'], true]) {
    assert.strictEqual(limpiarTextoPerfil('first_name', malo), undefined, JSON.stringify(malo));
  }
  assert.strictEqual(limpiarTextoPerfil('last_name', 'a'.repeat(100)), 'a'.repeat(100));
  assert.strictEqual(limpiarTextoPerfil('last_name', 'a'.repeat(101)), undefined);
  assert.strictEqual(limpiarTextoPerfil('location', 'a'.repeat(101)), undefined);
});

test('fechaNacimientoValida acepta fechas reales y plausibles', () => {
  const hoy = new Date(Date.UTC(2026, 9, 13)); // 13 de octubre de 2026
  for (const ok of ['1990-06-15', '2026-10-13', '2000-02-29', '1906-10-13']) {
    assert.ok(fechaNacimientoValida(ok, hoy), ok);
  }
  for (const mal of [
    '2026-10-14', '2999-01-01', // futuras
    '1906-10-12', '1800-01-01', // de hace más de 120 años
    '2020-02-30', '2001-02-29', '1990-13-01', '1990-00-10', '1990-06-31', // no existen
    '15/06/1990', '1990-6-5', '', 'ayer', '0050-01-01', '1990-06-15T00:00:00Z',
  ]) {
    assert.ok(!fechaNacimientoValida(mal, hoy), mal);
  }
});

test('las reglas aceptan lo normal', () => {
  assert.ok(EMAIL_REGEX.test('ana.perez+gh@correo.example.com'));
  assert.ok(PASSWORD_REGEX.test('Clave1234'));
  assert.ok(PASSWORD_REGEX.test('Ñandú-Fuerte9'));
});

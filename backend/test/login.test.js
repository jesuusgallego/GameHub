// Pruebas del inicio de sesión con email o nombre de usuario (base de datos simulada).
// Se ejecutan con: npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

// La "base de datos": una sola cuenta. La consulta del login se resuelve como lo haría
// Postgres: coincide si alguno de los dos parámetros es el email o el nombre.
const CUENTA = { id: 7, username: 'ANA', email: 'ana@x.com', token_version: 2 };
const consultas = [];
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: { query: async (sql, params) => {
    consultas.push({ sql, params });
    const [email, username] = params;
    const coincide = email === CUENTA.email || username === CUENTA.username;
    return { rows: coincide ? [{ ...CUENTA, password_hash }] : [] };
  } },
};

let password_hash;
const { login } = require('../src/controllers/authController');

beforeEach(async () => {
  consultas.length = 0;
  password_hash ??= await bcrypt.hash('Clave1234', 4);
});

async function entrar(body) {
  const res = { status(c) { this.c = c; return this; }, json(o) { this.o = o; } };
  await login({ body }, res);
  return { status: res.c ?? 200, cuerpo: res.o };
}

test('se puede entrar con el email', async () => {
  const r = await entrar({ identifier: 'ana@x.com', password: 'Clave1234' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.cuerpo.user.username, 'ANA');
  const token = jwt.verify(r.cuerpo.token, process.env.JWT_SECRET);
  assert.strictEqual(token.userId, 7);
  assert.strictEqual(token.v, 2);
});

test('se puede entrar con el nombre de usuario, también escrito en minúsculas', async () => {
  for (const identifier of ['ANA', 'ana', 'Ana', '  ana  ']) {
    const r = await entrar({ identifier, password: 'Clave1234' });
    assert.strictEqual(r.status, 200, identifier);
    assert.strictEqual(r.cuerpo.user.email, 'ana@x.com');
  }
});

test('el campo antiguo "email" sigue valiendo (apps de escritorio ya instaladas)', async () => {
  const r = await entrar({ email: 'ana@x.com', password: 'Clave1234' });
  assert.strictEqual(r.status, 200);
  const r2 = await entrar({ email: 'ANA', password: 'Clave1234' });
  assert.strictEqual(r2.status, 200);
});

test('el email no se pasa a mayúsculas: se busca tal cual, y el nombre en mayúsculas', async () => {
  await entrar({ identifier: 'Ana@X.com', password: 'Clave1234' });
  assert.deepStrictEqual(consultas[0].params, ['Ana@X.com', 'ANA@X.COM']);
});

test('contraseña incorrecta o cuenta inexistente dan el mismo error', async () => {
  const mala = await entrar({ identifier: 'ana', password: 'Otra12345' });
  const noExiste = await entrar({ identifier: 'nadie', password: 'Clave1234' });
  assert.strictEqual(mala.status, 401);
  assert.strictEqual(noExiste.status, 401);
  assert.deepStrictEqual(mala.cuerpo, noExiste.cuerpo);
  assert.strictEqual(mala.cuerpo.error, 'Credenciales inválidas');
});

test('rechaza lo que no es texto o está vacío sin consultar la base de datos', async () => {
  for (const malo of [
    {}, { password: 'x' }, { identifier: 'ana' }, { identifier: '   ', password: 'x' },
    { identifier: { $ne: 1 }, password: 'x' }, { identifier: 'ana', password: { $ne: 1 } },
    { identifier: 5, password: 'x' }, { identifier: 'ana', password: '' },
  ]) {
    const r = await entrar(malo);
    assert.strictEqual(r.status, 400, JSON.stringify(malo));
    assert.strictEqual(r.cuerpo.error, 'Faltan campos obligatorios');
  }
  assert.strictEqual(consultas.length, 0);
});

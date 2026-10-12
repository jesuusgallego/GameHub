// Pruebas de la validación de sesiones: el middleware compara la versión del token con la
// de la base de datos (simulada). Se ejecutan con: npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const path = require('node:path');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

// Sustituyo la conexión a la base de datos por una que devuelve lo que cada prueba prepara
let filas = [];
let fallo = null;
const consultas = [];
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: { query: async (sql, params) => {
    consultas.push({ sql, params });
    if (fallo) throw fallo;
    return { rows: filas };
  } },
};

const verifyToken = require('../src/middleware/authMiddleware');
const { emitirToken } = require('../src/services/sesion');

// Ejecuta el middleware y devuelve { status, body, siguio }
async function pasar(authorization) {
  const res = {
    status(c) { this.codigo = c; return this; },
    json(o) { this.cuerpo = o; },
  };
  const req = { headers: authorization ? { authorization } : {} };
  let siguio = false;
  await verifyToken(req, res, () => { siguio = true; });
  return { status: res.codigo, body: res.cuerpo, siguio, user: req.user };
}

const conToken = (payload, opciones) => `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, opciones)}`;

beforeEach(() => { filas = [{ token_version: 0 }]; fallo = null; consultas.length = 0; });

test('un token con la versión vigente pasa y deja el usuario en req.user', async () => {
  filas = [{ token_version: 3 }];
  const r = await pasar(conToken({ userId: 7, username: 'ana', v: 3 }));
  assert.strictEqual(r.siguio, true);
  assert.deepStrictEqual(r.user, { id: 7, username: 'ana' });
  assert.deepStrictEqual(consultas[0].params, [7], 'consulta por el id del token');
});

test('tras cambiar la contraseña (versión nueva) el token anterior deja de valer', async () => {
  filas = [{ token_version: 4 }];
  const r = await pasar(conToken({ userId: 7, username: 'ana', v: 3 }));
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.siguio, false);
});

test('un token anterior a la versión (sin v) vale mientras la versión sea 0', async () => {
  const r = await pasar(conToken({ userId: 7, username: 'ana' }));
  assert.strictEqual(r.siguio, true);

  filas = [{ token_version: 1 }];
  const r2 = await pasar(conToken({ userId: 7, username: 'ana' }));
  assert.strictEqual(r2.status, 401, 'tras el primer cambio de contraseña ya no vale');
});

test('cuenta borrada: 401 "La cuenta no existe"', async () => {
  filas = [];
  const r = await pasar(conToken({ userId: 7, username: 'ana', v: 0 }));
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.body.error, 'La cuenta no existe');
});

test('sin cabecera, mal firmado o caducado: 401 sin tocar la base de datos', async () => {
  assert.strictEqual((await pasar(undefined)).status, 401);
  assert.strictEqual((await pasar('Bearer basura')).status, 401);
  assert.strictEqual((await pasar(`Bearer ${jwt.sign({ userId: 7, v: 0 }, 'otro-secreto')}`)).status, 401);
  assert.strictEqual((await pasar(conToken({ userId: 7, v: 0 }, { expiresIn: -10 }))).status, 401);
  assert.strictEqual(consultas.length, 0);
});

test('si la base de datos falla responde 500 (no deja pasar)', async () => {
  fallo = new Error('conexión caída');
  const log = console.error;
  console.error = () => {};
  let r;
  try { r = await pasar(conToken({ userId: 7, v: 0 })); } finally { console.error = log; }
  assert.strictEqual(r.status, 500);
  assert.strictEqual(r.siguio, false);
});

test('emitirToken firma el id, el nombre y la versión, y caduca', () => {
  const t = jwt.verify(emitirToken({ id: 7, username: 'ana', token_version: 5 }), process.env.JWT_SECRET);
  assert.strictEqual(t.userId, 7);
  assert.strictEqual(t.username, 'ana');
  assert.strictEqual(t.v, 5);
  assert.ok(t.exp > t.iat);
});

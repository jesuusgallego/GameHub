// Pruebas de la validación de las rutas sociales (buscar, perfil público, solicitudes y
// bloqueos): lo que no es válido se rechaza sin llegar a la base de datos. La lógica con
// base de datos se comprobó contra Postgres real; ver docs/DESARROLLO.md. npm test
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

let consultas = 0;
let ultimaConsulta = null; // { sql, valores } de la última consulta a la base de datos
let filas = []; // lo que devuelve la base de datos simulada
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: {
    query: async (sql, valores) => {
      consultas++;
      ultimaConsulta = { sql, valores };
      return { rows: filas, rowCount: filas.length };
    },
  },
};

const U = require('../src/controllers/userController');
const F = require('../src/controllers/friendController');

async function llamar(fn, { body = {}, params = {}, query = {} } = {}) {
  const res = {
    codigo: 200,
    status(c) { this.codigo = c; return this; },
    json(o) { this.cuerpo = o; return this; },
    end() { return this; },
  };
  await fn({ body, params, query, user: { id: 1 } }, res);
  return res;
}

test('la búsqueda exige 2 a 20 caracteres de nombre de usuario', async () => {
  for (const q of [undefined, '', ' ', 'a', 'a b', 'a%', "a'--", 'ñandu', 'x'.repeat(21), ['an'], { $ne: 1 }]) {
    const r = await llamar(U.searchUsers, { query: { q } });
    assert.strictEqual(r.codigo, 400, JSON.stringify(q));
  }
  assert.strictEqual(consultas, 0);
});

test('la búsqueda acepta mayúsculas (las pasa a minúsculas) y pregunta a la base de datos', async () => {
  const r = await llamar(U.searchUsers, { query: { q: ' Ana ' } });
  assert.strictEqual(r.codigo, 200);
  assert.deepStrictEqual(r.cuerpo, { results: [] });
  assert.strictEqual(consultas, 1);
});

test('un perfil o una foto con un nombre que no puede existir responde 404 sin consultar', async () => {
  consultas = 0;
  for (const username of ['ANA', 'a', 'an a', 'ana!', '../etc', 'x'.repeat(21)]) {
    assert.strictEqual((await llamar(U.getUserProfile, { params: { username } })).codigo, 404, username);
    assert.strictEqual((await llamar(U.getUserGames, { params: { username } })).codigo, 404, username);
    assert.strictEqual((await llamar(U.getUserFriends, { params: { username } })).codigo, 404, username);
    assert.strictEqual((await llamar(U.getAvatar, { params: { username } })).codigo, 404, username);
  }
  assert.strictEqual(consultas, 0);
});

test('enviar solicitud: sin nombre, o que no es texto, es 400', async () => {
  consultas = 0;
  for (const username of [undefined, '', 5, { $ne: 1 }, ['ana']]) {
    const r = await llamar(F.sendRequest, { body: { username } });
    assert.strictEqual(r.codigo, 400, JSON.stringify(username));
  }
  assert.strictEqual(consultas, 0);
});

test('un nombre que no puede existir en solicitudes y bloqueos es 404 sin consultar', async () => {
  consultas = 0;
  assert.strictEqual((await llamar(F.sendRequest, { body: { username: 'No Valido' } })).codigo, 404);
  assert.strictEqual((await llamar(F.blockUser, { body: { username: 'No Valido' } })).codigo, 404);
  assert.strictEqual((await llamar(F.unblockUser, { params: { username: 'No Valido' } })).codigo, 404);
  assert.strictEqual((await llamar(F.removeFriend, { params: { username: 'No Valido' } })).codigo, 404);
  assert.strictEqual(consultas, 0);
});

test('el id de una solicitud tiene que ser un entero positivo', async () => {
  consultas = 0;
  for (const id of ['abc', '-1', '0', '1.5', '', '1e3', undefined]) {
    assert.strictEqual((await llamar(F.acceptRequest, { params: { id } })).codigo, 404, String(id));
    assert.strictEqual((await llamar(F.deleteRequest, { params: { id } })).codigo, 404, String(id));
  }
  assert.strictEqual(consultas, 0);
});

test('contar solicitudes: una sola consulta que devuelve solo el número de las recibidas', async () => {
  consultas = 0;
  filas = [{ received: 3 }];
  const r = await llamar(F.countRequests);
  filas = [];
  assert.strictEqual(r.codigo, 200);
  assert.deepStrictEqual(r.cuerpo, { received: 3 });
  assert.strictEqual(consultas, 1);
  assert.deepStrictEqual(ultimaConsulta.valores, [1]);
  assert.match(ultimaConsulta.sql, /addressee_id = \$1/);
});

test('logros de un juego ajeno: un id que no es un entero positivo es 404 y un idioma raro es 400, sin consultar', async () => {
  consultas = 0;
  for (const igdbId of ['abc', '-1', '0', '1.5', '', '1e3', undefined]) {
    const r = await llamar(U.getUserGameAchievements, { params: { username: 'ana', igdbId } });
    assert.strictEqual(r.codigo, 404, String(igdbId));
  }
  for (const lang of ['fr', '', ['es'], { a: 1 }]) {
    const r = await llamar(U.getUserGameAchievements, { params: { username: 'ana', igdbId: '7346' }, query: { lang } });
    assert.strictEqual(r.codigo, 400, JSON.stringify(lang));
  }
  assert.strictEqual(consultas, 0);
});

test('en común y logros con un nombre que no puede existir responden 404 sin consultar', async () => {
  consultas = 0;
  for (const username of ['ANA', 'a', 'an a', '../etc', 'x'.repeat(21)]) {
    assert.strictEqual((await llamar(U.getCommon, { params: { username } })).codigo, 404, username);
    const r = await llamar(U.getUserGameAchievements, { params: { username, igdbId: '7346' } });
    assert.strictEqual(r.codigo, 404, username);
  }
  assert.strictEqual(consultas, 0);
});

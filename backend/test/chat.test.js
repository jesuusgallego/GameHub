// Pruebas del chat que no necesitan base de datos: limpieza del texto de un mensaje y
// validaciones que se rechazan sin consultar. El SQL (conversaciones, no leídos, visto,
// borrado, amistad y bloqueos) se comprobó contra un Postgres real; ver docs/DESARROLLO.md.
// npm test
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

let consultas = 0;
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: {
    query: async () => {
      consultas++;
      return { rows: [], rowCount: 0 };
    },
  },
};

const C = require('../src/controllers/chatController');
const { MENSAJE_MAX } = require('../src/config/validacion');

async function llamar(fn, { body = {}, params = {}, query = {} } = {}) {
  const res = {
    codigo: 200,
    status(c) { this.codigo = c; return this; },
    json(o) { this.cuerpo = o; return this; },
  };
  await fn({ body, params, query, user: { id: 1 } }, res);
  return res;
}

test('limpiarMensaje: recorta, unifica saltos y quita caracteres de control', () => {
  assert.strictEqual(C.limpiarMensaje('  hola  '), 'hola');
  assert.strictEqual(C.limpiarMensaje('a\r\nb\rc'), 'a\nb\nc');
  assert.strictEqual(C.limpiarMensaje('a\n\n\n\n\nb'), 'a\n\nb');
  assert.strictEqual(C.limpiarMensaje('ho\u0000la\u0007'), 'hola');
  assert.strictEqual(C.limpiarMensaje('col1\tcol2'), 'col1\tcol2');
  assert.strictEqual(C.limpiarMensaje('¿Jugamos? 🎮'), '¿Jugamos? 🎮');
});

test('limpiarMensaje: rechaza lo vacío, lo que no es texto y lo demasiado largo', () => {
  for (const malo of [undefined, null, 5, {}, ['hola'], '', '   ', '\n\n', '\u0000\u0007']) {
    assert.strictEqual(C.limpiarMensaje(malo), null, JSON.stringify(malo));
  }
  assert.strictEqual(C.limpiarMensaje('x'.repeat(MENSAJE_MAX)).length, MENSAJE_MAX);
  assert.strictEqual(C.limpiarMensaje('x'.repeat(MENSAJE_MAX + 1)), null);
  // Los espacios de los extremos no cuentan para el tope
  assert.strictEqual(C.limpiarMensaje(`  ${'x'.repeat(MENSAJE_MAX)}  `).length, MENSAJE_MAX);
});

test('enviar: un texto no válido es 400 sin consultar la base de datos', async () => {
  for (const body of [undefined, '', '   ', 7, { $ne: 1 }, 'x'.repeat(MENSAJE_MAX + 1)]) {
    const r = await llamar(C.sendMessage, { params: { username: 'ana' }, body: { body } });
    assert.strictEqual(r.codigo, 400, JSON.stringify(body));
  }
  assert.strictEqual((await llamar(C.sendMessage, { params: { username: 'ana' }, body: undefined })).codigo, 400);
  assert.strictEqual(consultas, 0);
});

test('un nombre que no puede existir es 404 sin consultar', async () => {
  for (const username of ['ANA', 'a', 'an a', 'ana!', '../etc', 'x'.repeat(21)]) {
    assert.strictEqual((await llamar(C.getConversation, { params: { username } })).codigo, 404, username);
    assert.strictEqual((await llamar(C.sendMessage, { params: { username }, body: { body: 'hola' } })).codigo, 404, username);
    assert.strictEqual((await llamar(C.markRead, { params: { username } })).codigo, 404, username);
    assert.strictEqual((await llamar(C.deleteMessage, { params: { username, id: '1' } })).codigo, 404, username);
  }
  assert.strictEqual(consultas, 0);
});

test('un id de mensaje que no es un entero válido es 404 sin consultar', async () => {
  for (const id of ['0', '-1', 'abc', '1.5', '', '99999999999', '2147483648', ['1'], undefined]) {
    assert.strictEqual((await llamar(C.deleteMessage, { params: { username: 'ana', id } })).codigo, 404, String(id));
  }
  assert.strictEqual(consultas, 0);
});

test('leer una conversación: after y before tienen que ser enteros válidos', async () => {
  for (const query of [{ after: 'x' }, { before: '-3' }, { after: '1', before: 'y' }, { after: ['1', '2'] }, { before: '0' }]) {
    const r = await llamar(C.getConversation, { params: { username: 'ana' }, query });
    assert.strictEqual(r.codigo, 400, JSON.stringify(query));
  }
  assert.strictEqual(consultas, 0);
});

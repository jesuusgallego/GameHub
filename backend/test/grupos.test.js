// Pruebas de los chats de grupo y del "escribiendo" que no necesitan base de datos: lo que se
// rechaza antes de consultar, la limpieza del nombre y los avisos en memoria. El SQL (crear,
// añadir, sacar, vaciar, no leídos, traspaso al borrar una cuenta) se comprobó contra un
// Postgres real; ver docs/DESARROLLO.md.
// npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

let consultas = 0;
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: {
    query: async () => { consultas++; return { rows: [], rowCount: 0 }; },
    connect: async () => { consultas++; throw new Error('no debería abrir una transacción'); },
  },
};

const G = require('../src/controllers/gruposController');
const { limpiarNombreGrupo } = require('../src/services/chatComun');
const escribiendo = require('../src/services/escribiendo');
const { GRUPO_MAX_MIEMBROS, MENSAJE_NOMBRE_GRUPO, MENSAJE_MIEMBROS_GRUPO } = require('../src/config/validacion');

beforeEach(() => {
  consultas = 0;
  escribiendo.vaciar();
});

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

test('limpiarNombreGrupo: una línea, espacios juntados y de 1 a 50 caracteres', () => {
  assert.strictEqual(limpiarNombreGrupo('  Los   del  viernes '), 'Los del viernes');
  assert.strictEqual(limpiarNombreGrupo('🎮 Squad'), '🎮 Squad');
  assert.strictEqual(limpiarNombreGrupo('x'.repeat(50)), 'x'.repeat(50));
  // Los emojis cuentan como un carácter, igual que en VARCHAR
  assert.strictEqual(limpiarNombreGrupo('🎮'.repeat(50)), '🎮'.repeat(50));
  for (const malo of [undefined, null, 7, {}, '', '   ', 'x'.repeat(51), 'a\nb', 'a\u0000b']) {
    assert.strictEqual(limpiarNombreGrupo(malo), null, JSON.stringify(malo));
  }
});

test('leerNombres: lista de nombres válidos, sin repetir y por debajo del máximo', () => {
  assert.deepStrictEqual(G.leerNombres(['ana', 'luis']), ['ana', 'luis']);
  const nueve = Array.from({ length: GRUPO_MAX_MIEMBROS - 1 }, (_, i) => `amigo${i}`);
  assert.deepStrictEqual(G.leerNombres(nueve), nueve);
  for (const mala of [undefined, 'ana', [], ['ana', 'ana'], ['Ana'], ['ana', 5], [...nueve, 'otro']]) {
    assert.strictEqual(G.leerNombres(mala), null, JSON.stringify(mala));
  }
});

test('crear grupo: nombre o miembros que no valen son 400 sin tocar la base de datos', async () => {
  let r = await llamar(G.createGroup, { body: { name: '', members: ['ana', 'luis'] } });
  assert.deepStrictEqual([r.codigo, r.cuerpo.error], [400, MENSAJE_NOMBRE_GRUPO]);
  for (const members of [undefined, [], ['ana'], ['ana', 'ana'], ['ana', 'NO VALE']]) {
    r = await llamar(G.createGroup, { body: { name: 'Grupo', members } });
    assert.deepStrictEqual([r.codigo, r.cuerpo.error], [400, MENSAJE_MIEMBROS_GRUPO], JSON.stringify(members));
  }
  assert.strictEqual(consultas, 0);
});

test('rutas de grupo con un id que no es un número: 404 sin consultar', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
    for (const fn of [G.getGroup, G.markGroupRead, G.clearGroup, G.groupTyping]) {
      const r = await llamar(fn, { params: { id } });
      assert.strictEqual(r.codigo, 404, `${fn.name} ${id}`);
    }
  }
  const r = await llamar(G.getGroup, { params: { id: '3' }, query: { after: 'x' } });
  assert.strictEqual(r.codigo, 400);
  assert.strictEqual(consultas, 0);
});

test('escribiendo: dura unos segundos, no me incluye a mí y se borra al dejar de escribir', () => {
  const clave = escribiendo.claveDosPersonas(8, 3);
  assert.strictEqual(clave, escribiendo.claveDosPersonas(3, 8), 'misma clave en los dos sentidos');
  escribiendo.marcar(clave, 3, true, 1000);
  assert.deepStrictEqual(escribiendo.quienes(clave, 8, 1000 + escribiendo.DURACION_MS - 1), [3]);
  assert.deepStrictEqual(escribiendo.quienes(clave, 3, 1000), [], 'yo no me veo');
  assert.deepStrictEqual(escribiendo.quienes(clave, 8, 1000 + escribiendo.DURACION_MS), [], 'caducado');

  const grupo = escribiendo.claveGrupo(5);
  escribiendo.marcar(grupo, 1, true, 0);
  escribiendo.marcar(grupo, 2, true, 0);
  escribiendo.marcar(grupo, 1, false);
  assert.deepStrictEqual(escribiendo.quienes(grupo, 9, 10), [2]);
});

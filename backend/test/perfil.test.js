// Pruebas de la edición del perfil: validación de los campos y consulta que se genera
// (base de datos simulada). Se ejecutan con: npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

const consultas = [];
let filas = [{ id: 1, username: 'ana' }];
let fallo = null;
const rutaDb = require.resolve('../src/config/db');
require.cache[rutaDb] = {
  id: rutaDb, filename: rutaDb, loaded: true,
  exports: { query: async (sql, params) => {
    consultas.push({ sql, params });
    if (fallo) throw fallo;
    return { rows: filas };
  } },
};

const { updateProfile } = require('../src/controllers/profileController');
const { MENSAJE_USERNAME, MENSAJE_SEXO, MENSAJE_FECHA_NACIMIENTO, TEXTOS_PERFIL } = require('../src/config/validacion');

beforeEach(() => { consultas.length = 0; filas = [{ id: 1, username: 'ana' }]; fallo = null; });

async function editar(body) {
  const res = { status(c) { this.c = c; return this; }, json(o) { this.o = o; } };
  await updateProfile({ body, user: { id: 7 } }, res);
  return { status: res.c ?? 200, cuerpo: res.o };
}

test('guarda solo los campos que llegan, con parámetros y el id al final', async () => {
  const r = await editar({
    first_name: '  Ana ', last_name: 'García', birth_date: '1990-06-15', gender: 'mujer', location: 'Sevilla',
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(consultas.length, 1);
  const { sql, params } = consultas[0];
  assert.match(sql, /SET first_name = \$1, last_name = \$2, location = \$3, birth_date = \$4, gender = \$5 WHERE id = \$6/);
  assert.deepStrictEqual(params, ['Ana', 'García', 'Sevilla', '1990-06-15', 'mujer', 7]);
  assert.match(sql, /EXTRACT\(YEAR FROM age\(birth_date\)\)::int AS age/, 'devuelve también la edad');
});

test('null y vacío borran el dato (NULL); el resto de campos no se toca', async () => {
  await editar({ gender: null, last_name: '   ', birth_date: null, location: '' });
  const { sql, params } = consultas[0];
  assert.match(sql, /SET last_name = \$1, location = \$2, birth_date = \$3, gender = \$4 WHERE id = \$5/);
  assert.deepStrictEqual(params, [null, null, null, null, 7]);
  assert.doesNotMatch(sql, /first_name = /);
});

test('el nombre de usuario sigue siendo obligatorio y en minúsculas', async () => {
  for (const username of ['', '   ', null, 5]) {
    const r = await editar({ username });
    assert.strictEqual(r.status, 400, JSON.stringify(username));
    assert.strictEqual(r.cuerpo.error, 'El nombre de usuario es obligatorio');
  }
  for (const username of ['Ana', 'ANA', 'an', 'ana gomez', 'a'.repeat(21)]) {
    const r = await editar({ username });
    assert.strictEqual(r.status, 400, username);
    assert.strictEqual(r.cuerpo.error, MENSAJE_USERNAME);
  }
  assert.strictEqual(consultas.length, 0);
});

test('rechaza datos personales que no valen, sin consultar la base de datos', async () => {
  const casos = [
    [{ first_name: 'a'.repeat(51) }, TEXTOS_PERFIL.first_name.mensaje],
    [{ first_name: 'a\nb' }, TEXTOS_PERFIL.first_name.mensaje],
    [{ last_name: 5 }, TEXTOS_PERFIL.last_name.mensaje],
    [{ last_name: 'a'.repeat(101) }, TEXTOS_PERFIL.last_name.mensaje],
    [{ location: { x: 1 } }, TEXTOS_PERFIL.location.mensaje],
    [{ birth_date: '2999-01-01' }, MENSAJE_FECHA_NACIMIENTO],
    [{ birth_date: '2020-02-30' }, MENSAJE_FECHA_NACIMIENTO],
    [{ birth_date: 19900615 }, MENSAJE_FECHA_NACIMIENTO],
    [{ birth_date: '' }, MENSAJE_FECHA_NACIMIENTO],
    [{ gender: 'xyz' }, MENSAJE_SEXO],
    [{ gender: '' }, MENSAJE_SEXO],
    [{ gender: 'Hombre' }, MENSAJE_SEXO],
  ];
  for (const [body, error] of casos) {
    const r = await editar(body);
    assert.strictEqual(r.status, 400, JSON.stringify(body));
    assert.strictEqual(r.cuerpo.error, error, JSON.stringify(body));
  }
  assert.strictEqual(consultas.length, 0);
});

test('un campo que no existe se ignora y nunca llega al SQL', async () => {
  await editar({ 'username = 1; --': 'x', password_hash: 'x', first_name: 'Ana' });
  const { sql, params } = consultas[0];
  assert.match(sql, /SET first_name = \$1 WHERE id = \$2/);
  assert.deepStrictEqual(params, ['Ana', 7]);
});

test('sin ningún campo devuelve el perfil sin escribir', async () => {
  const r = await editar({});
  assert.strictEqual(r.status, 200);
  assert.match(consultas[0].sql, /^\s*SELECT/);
  assert.doesNotMatch(consultas[0].sql, /UPDATE/);
});

test('nombre de usuario repetido: 409; cuenta borrada: 401', async () => {
  fallo = Object.assign(new Error('duplicado'), { code: '23505' });
  assert.strictEqual((await editar({ username: 'otro' })).status, 409);
  fallo = null;
  filas = [];
  const r = await editar({ first_name: 'Ana' });
  assert.strictEqual(r.status, 401);
});

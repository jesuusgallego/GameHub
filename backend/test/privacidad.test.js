// Pruebas de las reglas de privacidad: qué ve cada persona del perfil de otra. Es lo que
// decide qué datos salen de la API, así que se prueba toda la tabla. npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { relacionEntre, puedeVer, datosPersonalesVisibles } = require('../src/services/privacidad');

test('relacionEntre distingue yo, amigos, enviada, recibida y ninguna', () => {
  assert.strictEqual(relacionEntre({ esYo: true, amistad: null, yo: 1 }), 'self');
  assert.strictEqual(relacionEntre({ esYo: false, amistad: null, yo: 1 }), 'ninguna');
  assert.strictEqual(relacionEntre({ esYo: false, amistad: { status: 'aceptada', requester_id: 1 }, yo: 1 }), 'amigos');
  assert.strictEqual(relacionEntre({ esYo: false, amistad: { status: 'aceptada', requester_id: 2 }, yo: 1 }), 'amigos');
  assert.strictEqual(relacionEntre({ esYo: false, amistad: { status: 'pendiente', requester_id: 1 }, yo: 1 }), 'enviada');
  assert.strictEqual(relacionEntre({ esYo: false, amistad: { status: 'pendiente', requester_id: 2 }, yo: 1 }), 'recibida');
});

test('puedeVer: toda la tabla de niveles por relación', () => {
  const relaciones = ['self', 'amigos', 'enviada', 'recibida', 'ninguna'];
  const esperado = {
    nadie: { self: true, amigos: false, enviada: false, recibida: false, ninguna: false },
    amigos: { self: true, amigos: true, enviada: false, recibida: false, ninguna: false },
    todos: { self: true, amigos: true, enviada: true, recibida: true, ninguna: true },
  };
  for (const [nivel, fila] of Object.entries(esperado)) {
    for (const relacion of relaciones) {
      assert.strictEqual(puedeVer(nivel, relacion), fila[relacion], `${nivel} / ${relacion}`);
    }
  }
});

test('puedeVer: un nivel desconocido cuenta como "nadie" (salvo para uno mismo)', () => {
  for (const raro of [undefined, null, '', 'publico', 'TODOS', 5]) {
    assert.strictEqual(puedeVer(raro, 'amigos'), false, String(raro));
    assert.strictEqual(puedeVer(raro, 'ninguna'), false, String(raro));
    assert.strictEqual(puedeVer(raro, 'self'), true, String(raro));
  }
});

test('una solicitud pendiente no da acceso a lo que es solo para amigos', () => {
  assert.strictEqual(puedeVer('amigos', 'enviada'), false);
  assert.strictEqual(puedeVer('amigos', 'recibida'), false);
});

// Una persona con todos los datos rellenos y un nivel distinto en cada uno
const persona = {
  first_name: 'Ana', last_name: 'García', age: 34, gender: 'mujer', location: 'Sevilla', country: 'ES',
  visibility_name: 'todos', visibility_age: 'amigos', visibility_gender: 'nadie', visibility_location: 'amigos',
};

test('datosPersonalesVisibles: cada dato con su nivel, y lo oculto ni aparece', () => {
  assert.deepStrictEqual(datosPersonalesVisibles(persona, 'ninguna'), { first_name: 'Ana', last_name: 'García' });
  assert.deepStrictEqual(datosPersonalesVisibles(persona, 'enviada'), { first_name: 'Ana', last_name: 'García' });
  assert.deepStrictEqual(datosPersonalesVisibles(persona, 'amigos'), {
    first_name: 'Ana', last_name: 'García', age: 34, location: 'Sevilla', country: 'ES',
  });
  // El sexo está en "nadie": solo lo ve ella
  assert.ok(!('gender' in datosPersonalesVisibles(persona, 'amigos')));
  assert.strictEqual(datosPersonalesVisibles(persona, 'self').gender, 'mujer');
});

test('datosPersonalesVisibles: la localización y el país van juntos', () => {
  const d = datosPersonalesVisibles({ ...persona, visibility_location: 'todos' }, 'ninguna');
  assert.strictEqual(d.location, 'Sevilla');
  assert.strictEqual(d.country, 'ES');
});

test('datosPersonalesVisibles: nunca devuelve más campos que los cuatro grupos', () => {
  const todo = { ...persona, email: 'a@x.com', phone: '+34600', birth_date: '1990-06-15', password_hash: 'h' };
  for (const nivel of ['nadie', 'amigos', 'todos']) {
    const abierto = { ...todo, visibility_name: nivel, visibility_age: nivel, visibility_gender: nivel, visibility_location: nivel };
    for (const relacion of ['self', 'amigos', 'ninguna']) {
      const claves = Object.keys(datosPersonalesVisibles(abierto, relacion));
      for (const k of claves) {
        assert.ok(['first_name', 'last_name', 'age', 'gender', 'location', 'country'].includes(k), `${nivel}/${relacion}: ${k}`);
      }
    }
  }
});

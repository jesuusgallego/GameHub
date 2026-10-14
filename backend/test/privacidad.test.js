// Pruebas de las reglas de privacidad: qué ve cada persona del perfil de otra. Es lo que
// decide qué datos salen de la API, así que se prueba toda la tabla. npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { relacionEntre, puedeVer } = require('../src/services/privacidad');

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

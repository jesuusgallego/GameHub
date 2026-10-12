// Pruebas de los avisos de actualización. Se ejecutan con: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { NOVEDADES, textos, novedades, avisoTrasActualizar } = require('../actualizaciones');

test('instalación nueva: no hay nada que avisar', () => {
  assert.strictEqual(
    avisoTrasActualizar({ versionGuardada: null, versionActual: '1.1.0', hayEstadoPrevio: false }),
    null
  );
});

test('viene de la 1.0.0 (sin versión guardada pero ya usada): avisa', () => {
  assert.deepStrictEqual(
    avisoTrasActualizar({ versionGuardada: null, versionActual: '1.1.0', hayEstadoPrevio: true }),
    { anterior: null }
  );
});

test('misma versión que la última vez: no avisa', () => {
  assert.strictEqual(
    avisoTrasActualizar({ versionGuardada: '1.1.0', versionActual: '1.1.0', hayEstadoPrevio: true }),
    null
  );
});

test('versión distinta de la guardada: avisa e indica la anterior', () => {
  assert.deepStrictEqual(
    avisoTrasActualizar({ versionGuardada: '1.1.0', versionActual: '1.2.0', hayEstadoPrevio: true }),
    { anterior: '1.1.0' }
  );
});

test('el idioma sale del sistema: es* en español, el resto en inglés', () => {
  assert.strictEqual(textos('es-ES').reiniciar, 'Reiniciar ahora');
  assert.strictEqual(textos('es').masTarde, 'Más tarde');
  assert.strictEqual(textos('en-US').reiniciar, 'Restart now');
  assert.strictEqual(textos('fr').reiniciar, 'Restart now');
  assert.strictEqual(textos(undefined).reiniciar, 'Restart now');
});

test('los textos con versión la incluyen', () => {
  assert.ok(textos('es').descargada('1.2.0').includes('1.2.0'));
  assert.ok(textos('en').actualizada('1.2.0').includes('1.2.0'));
});

test('novedades de la 1.1.0 en los dos idiomas y vacío si no hay entrada', () => {
  assert.ok(novedades('1.1.0', 'es-ES').length > 0);
  assert.strictEqual(novedades('1.1.0', 'es-ES').length, novedades('1.1.0', 'en-US').length);
  assert.deepStrictEqual(novedades('9.9.9', 'es-ES'), []);
});

test('cada entrada de novedades tiene español e inglés', () => {
  for (const [version, e] of Object.entries(NOVEDADES)) {
    assert.ok(e.es?.length > 0, `${version}: faltan las novedades en español`);
    assert.strictEqual(e.en?.length, e.es.length, `${version}: en inglés debe tener las mismas`);
  }
});

// Pruebas de la nota de las Releases (scripts/notas-release.js). Se ejecutan con: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { extraerSeccion, quitarSecciones, construirNotas, comprobarVersiones } = require('../scripts/notas-release');

const CHANGELOG = `# Cambios

## [Sin publicar]

## [1.2.0] - 2026-11-01

Resumen de la 1.2.0.

### Añadido
- **Cosa nueva:** algo.

### Interno
- Cambio solo para quien desarrolla.

### Seguridad
- Un arreglo.

## [1.1.0] - 2026-10-12

### Añadido
- Lo de la 1.1.0.
`;

test('extraerSeccion devuelve solo la de esa versión, con o sin fecha', () => {
  const s = extraerSeccion(CHANGELOG, '1.2.0');
  assert.ok(s.startsWith('Resumen de la 1.2.0.'));
  assert.ok(s.includes('Un arreglo.'));
  assert.ok(!s.includes('Lo de la 1.1.0.'), 'no se cuela la versión siguiente');
  assert.strictEqual(extraerSeccion(CHANGELOG, '1.1.0'), '### Añadido\n- Lo de la 1.1.0.');
  assert.strictEqual(extraerSeccion(CHANGELOG, '9.9.9'), null);
});

test('no confunde 1.2.0 con otra versión que empiece igual', () => {
  const cl = '## [1.2.0] - x\n\ncuerpo A\n\n## [1.2.01] - y\n\ncuerpo B\n';
  assert.strictEqual(extraerSeccion(cl, '1.2.0'), 'cuerpo A');
});

test('quitarSecciones omite "Interno" hasta la siguiente sección', () => {
  const t = quitarSecciones(extraerSeccion(CHANGELOG, '1.2.0'), ['Interno']);
  assert.ok(!t.includes('Interno'));
  assert.ok(!t.includes('solo para quien desarrolla'));
  assert.ok(t.includes('### Seguridad') && t.includes('Un arreglo.'));
});

test('construirNotas: cuerpo, separador y bloque de instalación con el nombre del instalador', () => {
  const n = construirNotas(CHANGELOG, '1.2.0');
  assert.ok(n.startsWith('Resumen de la 1.2.0.'));
  assert.ok(n.includes('\n---\n'));
  assert.ok(n.includes('### Instalación'));
  assert.ok(n.includes('**GameHub-Setup-1.2.0.exe**'));
  assert.ok(!n.includes('solo para quien desarrolla'));
});

test('construirNotas falla con mensaje claro si la sección no existe o está vacía', () => {
  assert.throws(() => construirNotas(CHANGELOG, '3.0.0'), /no tiene una sección "## \[3\.0\.0\]"/);
  assert.throws(() => construirNotas('## [1.0.0]\n\n### Interno\n- x\n', '1.0.0'), /está vacía/);
});

test('comprobarVersiones avisa de los archivos que no coinciden', () => {
  assert.deepStrictEqual(comprobarVersiones('1.2.0', { a: '1.2.0', b: '1.2.0' }), []);
  const e = comprobarVersiones('1.2.0', { 'desktop/package.json': '1.1.0', 'frontend/package.json': '1.2.0' });
  assert.strictEqual(e.length, 1);
  assert.match(e[0], /desktop\/package\.json dice 1\.1\.0/);
});

test('el CHANGELOG real: toda versión publicada genera su nota', () => {
  // Si alguien escribe mal un título del CHANGELOG, esto lo detecta antes de publicar
  const cl = fs.readFileSync(path.join(__dirname, '..', '..', 'CHANGELOG.md'), 'utf8');
  const versiones = [...cl.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
  assert.ok(versiones.length >= 2, 'esperaba al menos la 1.0.0 y la 1.1.0');
  for (const v of versiones) {
    const n = construirNotas(cl, v);
    assert.ok(n.includes(`GameHub-Setup-${v}.exe`), v);
    assert.ok(!n.includes('### Interno'), v);
  }
});

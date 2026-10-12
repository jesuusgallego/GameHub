// El instalador solo lleva los archivos de "build.files" (package.json). Si main.js
// necesita un archivo local que no está en esa lista, la app instalada NO arranca, y la
// prueba de humo no lo ve porque corre desde el código fuente. Esta prueba lo vigila.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const incluidos = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8')).build.files;
const main = fs.readFileSync(path.join(raiz, 'main.js'), 'utf8');

test('todo archivo local que main.js carga con require va en build.files', () => {
  const locales = [...main.matchAll(/require\('\.\/([\w.-]+)'\)/g)].map((m) => m[1]);
  assert.ok(locales.length > 0, 'esperaba al menos un require local');

  for (const nombre of locales) {
    const archivo = nombre.endsWith('.js') ? nombre : `${nombre}.js`;
    assert.ok(fs.existsSync(path.join(raiz, archivo)), `${archivo} no existe`);
    assert.ok(incluidos.includes(archivo), `${archivo} lo carga main.js pero no está en build.files: la app instalada no arrancaría`);
  }
});

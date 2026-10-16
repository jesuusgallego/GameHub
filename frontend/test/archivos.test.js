// Dos archivos de src/ no pueden llamarse igual si solo se distinguen por mayúsculas o por la
// extensión (Chat.jsx y chat.js). En Linux conviven, pero Windows no distingue mayúsculas y, al
// resolver `import Chat from './Chat'`, prueba antes .js que .jsx: se quedaba con chat.js y la
// compilación de escritorio (que se hace en un runner de Windows) fallaba. En Linux el fallo no se
// ve, por eso lo vigila esta prueba. npm test
import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

function archivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? archivos(path.join(dir, e.name)) : [path.join(dir, e.name)]
  ))
}

test('en src/ no hay dos archivos con el mismo nombre salvo mayúsculas o extensión', () => {
  const porNombre = new Map()
  for (const f of archivos(path.join(import.meta.dirname, '../src'))) {
    if (!/\.(js|jsx)$/.test(f)) continue
    const clave = path.join(path.dirname(f), path.basename(f).replace(/\.(js|jsx)$/, '').toLowerCase())
    porNombre.set(clave, [...(porNombre.get(clave) ?? []), path.basename(f)])
  }
  const repetidos = [...porNombre.values()].filter((l) => l.length > 1)
  assert.deepStrictEqual(repetidos, [], `nombres que chocan en Windows: ${repetidos.map((l) => l.join(' / ')).join('; ')}`)
})

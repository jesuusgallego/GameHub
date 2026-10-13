// Construye la nota de una Release (lo que se ve en la página de GitHub) a partir de
// CHANGELOG.md, y comprueba que la versión esté lista para publicarse.
//
//   node scripts/notas-release.js 1.2.0 notas.md
//
// La nota es la sección "## [1.2.0]" del CHANGELOG más un bloque de instalación, igual
// que la de la 1.0.0. La sección "### Interno" (cambios para quien desarrolla) se queda
// en el CHANGELOG y no sale en la nota. El flujo de publicación (release.yml) usa esto
// ANTES de compilar nada: si falta la sección o las versiones no coinciden, falla pronto.
const fs = require('node:fs')
const path = require('node:path')

// Secciones del CHANGELOG que no van en la nota de la Release
const SECCIONES_OMITIDAS = ['Interno']

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// El contenido de "## [version]" hasta el siguiente "## [", o null si no existe
function extraerSeccion(changelog, version) {
  const lineas = changelog.split('\n')
  const cabecera = new RegExp(`^## \\[${escaparRegex(version)}\\]`)
  const inicio = lineas.findIndex((l) => cabecera.test(l))
  if (inicio === -1) return null

  let fin = lineas.findIndex((l, i) => i > inicio && l.startsWith('## ['))
  if (fin === -1) fin = lineas.length
  return lineas.slice(inicio + 1, fin).join('\n').trim()
}

// Quita las secciones "### <nombre>" indicadas (hasta la siguiente "###" o el final)
function quitarSecciones(texto, nombres) {
  const salida = []
  let omitiendo = false
  for (const linea of texto.split('\n')) {
    const titulo = linea.match(/^###\s+(.+?)\s*$/)
    if (titulo) omitiendo = nombres.includes(titulo[1])
    if (!omitiendo) salida.push(linea)
  }
  return salida.join('\n').trim()
}

function bloqueInstalacion(version) {
  return `### Instalación

1. Descarga **GameHub-Setup-${version}.exe** (abajo, en *Assets*) y ejecútalo.
2. Windows mostrará *"Windows protegió su PC"* porque el instalador no está firmado:
   pulsa **Más información → Ejecutar de todos modos**.
3. Abre GameHub y crea tu cuenta.

**¿Ya tienes GameHub instalado?** No tienes que hacer nada: la próxima vez que abras la app
descargará esta versión y la instalará al cerrarla.

La primera petición tras un rato sin uso puede tardar hasta un minuto (el servidor gratuito se duerme):
la app lo avisa en pantalla.`
}

// La nota completa. Lanza un Error con un mensaje claro si no se puede construir.
function construirNotas(changelog, version) {
  const seccion = extraerSeccion(changelog, version)
  if (seccion === null) {
    throw new Error(`El CHANGELOG.md no tiene una sección "## [${version}]". Escríbela antes de publicar.`)
  }

  const cuerpo = quitarSecciones(seccion, SECCIONES_OMITIDAS)
  if (cuerpo === '') {
    throw new Error(`La sección "## [${version}]" del CHANGELOG.md está vacía.`)
  }

  return `${cuerpo}\n\n---\n\n${bloqueInstalacion(version)}\n`
}

// Mensajes de error si alguno de los archivos con versión no coincide con la que se publica
// (p. ej. etiqueta v1.2.0 pero package.json aún dice 1.1.0: saldría un instalador mal numerado)
function comprobarVersiones(version, versiones) {
  return Object.entries(versiones)
    .filter(([, v]) => v !== version)
    .map(([archivo, v]) => `${archivo} dice ${v} y se está publicando la ${version}`)
}

module.exports = { extraerSeccion, quitarSecciones, construirNotas, comprobarVersiones, SECCIONES_OMITIDAS }

// ---- Uso desde la línea de comandos ------------------------------------------------
if (require.main === module) {
  const [, , argVersion, salida] = process.argv
  const version = String(argVersion ?? '').replace(/^v/, '')

  if (!/^\d+\.\d+\.\d+$/.test(version) || !salida) {
    console.error('Uso: node scripts/notas-release.js <versión, p. ej. 1.2.0 o v1.2.0> <archivo de salida>')
    process.exit(2)
  }

  const raiz = path.join(__dirname, '..', '..')
  const leerVersion = (ruta) => JSON.parse(fs.readFileSync(path.join(raiz, ruta), 'utf8')).version

  const errores = comprobarVersiones(version, {
    'desktop/package.json': leerVersion('desktop/package.json'),
    'frontend/package.json': leerVersion('frontend/package.json'),
  })

  let notas = ''
  try {
    notas = construirNotas(fs.readFileSync(path.join(raiz, 'CHANGELOG.md'), 'utf8'), version)
  } catch (err) {
    errores.push(err.message)
  }

  if (errores.length > 0) {
    console.error(`No se puede publicar la ${version}:`)
    for (const e of errores) console.error(`  - ${e}`)
    process.exit(1)
  }

  fs.writeFileSync(salida, notas)
  console.log(`Notas de la ${version} escritas en ${salida} (${notas.split('\n').length} líneas)`)
}

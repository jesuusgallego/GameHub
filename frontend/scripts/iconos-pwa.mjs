// Genera las imágenes de la app instalada (PWA) a partir de public/iconos/icono*.svg:
//  - public/iconos/*.png: el icono a los tamaños que piden iOS (180) y Android (192, 512 y la
//    variante "maskable")
//  - public/arranque/*.png: las pantallas de arranque del iPhone, una por tamaño de pantalla
//    (iOS no las genera solo: sin ellas, la app abre con un fogonazo blanco)
//  - en la consola, las etiquetas <link> de esas pantallas, para pegarlas en index.html
// Se ejecuta a mano cuando cambie el icono (las PNG van en el repositorio). Necesita Chromium y
// el paquete playwright-core (no son dependencias de la app):
//   CHROMIUM=/ruta/a/chrome NODE_PATH=/ruta/a/node_modules node scripts/iconos-pwa.mjs
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLICO = path.join(RAIZ, 'public')

// Pantallas de iPhone en vertical: ancho y alto en puntos (px de CSS) y densidad
const IPHONES = [
  ['16 Pro Max', 440, 956, 3],
  ['16 Pro', 402, 874, 3],
  ['14 Pro Max, 15 Pro Max, 15 Plus, 16 Plus', 430, 932, 3],
  ['14 Pro, 15, 15 Pro, 16', 393, 852, 3],
  ['12 Pro Max, 13 Pro Max, 14 Plus', 428, 926, 3],
  ['12, 12 Pro, 13, 13 Pro, 14, 16e', 390, 844, 3],
  ['XS Max, 11 Pro Max', 414, 896, 3],
  ['XR, 11', 414, 896, 2],
  ['X, XS, 11 Pro, 12 mini, 13 mini', 375, 812, 3],
  ['SE (2.ª y 3.ª), 8', 375, 667, 2],
]

const svg = readFileSync(path.join(PUBLICO, 'iconos/icono.svg'), 'utf8')
const svgMaskable = readFileSync(path.join(PUBLICO, 'iconos/icono-maskable.svg'), 'utf8')
// La tipografía va incrustada: una página creada con setContent no puede cargar archivos del disco
const fuente = readFileSync(path.join(RAIZ, 'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2')).toString('base64')

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM })

async function foto(html, ancho, alto, densidad, salida) {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: densidad })
  await p.setContent(html)
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: salida })
  await p.close()
}

const soloSvg = (s, lado) => `<!doctype html><style>*{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${s}`
mkdirSync(path.join(PUBLICO, 'arranque'), { recursive: true })
await foto(soloSvg(svg, 180), 180, 180, 1, path.join(PUBLICO, 'iconos/apple-touch-icon.png'))
await foto(soloSvg(svg, 192), 192, 192, 1, path.join(PUBLICO, 'iconos/icono-192.png'))
await foto(soloSvg(svg, 512), 512, 512, 1, path.join(PUBLICO, 'iconos/icono-512.png'))
await foto(soloSvg(svgMaskable, 512), 512, 512, 1, path.join(PUBLICO, 'iconos/icono-maskable-512.png'))

// La pantalla de arranque: el fondo oscuro de la app, el icono con sus esquinas y el nombre
const arranque = (ancho) => `<!doctype html><style>
  @font-face { font-family: Barlow; src: url(data:font/woff2;base64,${fuente}); font-weight: 700; }
  * { margin: 0 }
  body { display: grid; place-items: center; height: 100vh; background: #111a27; }
  div { display: flex; flex-direction: column; align-items: center; gap: ${Math.round(ancho * 0.06)}px; margin-top: -8vh; }
  svg { width: ${Math.round(ancho * 0.26)}px; height: ${Math.round(ancho * 0.26)}px; border-radius: 22.5%; box-shadow: 0 18px 50px rgba(91, 61, 245, .35); }
  p { font: 700 ${Math.round(ancho * 0.085)}px Barlow, sans-serif; letter-spacing: .08em; color: #f3f6fb; }
</style><div>${svg}<p>GAMEHUB</p></div>`

const enlaces = []
for (const [modelos, ancho, alto, densidad] of IPHONES) {
  const archivo = `arranque-${ancho * densidad}x${alto * densidad}.png`
  await foto(arranque(ancho), ancho, alto, densidad, path.join(PUBLICO, 'arranque', archivo))
  enlaces.push(`    <!-- iPhone ${modelos} -->\n    <link rel="apple-touch-startup-image" media="(device-width: ${ancho}px) and (device-height: ${alto}px) and (-webkit-device-pixel-ratio: ${densidad}) and (orientation: portrait)" href="/arranque/${archivo}" />`)
}
console.log(enlaces.join('\n'))
await navegador.close()
console.log('Hecho:', IPHONES.length, 'pantallas de arranque y 4 iconos')

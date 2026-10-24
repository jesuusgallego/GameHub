// Proceso principal de la app de escritorio (Electron). Electron junta dos mundos:
//  - este archivo corre en Node, con acceso al sistema (ventanas, archivos...)
//  - la interfaz (la misma app React de la web) corre dentro de la ventana, aislada
//    como una página web normal, sin acceso al sistema.
// Este archivo solo abre la ventana, sirve la interfaz y protege la navegación. La
// app NO lleva backend dentro: llama por internet al servidor cuya dirección se fijó
// al compilar (VITE_API_URL, ver scripts/build-web.mjs).
const { app, BrowserWindow, Menu, protocol, net, shell, session, screen, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const actualizaciones = require('./actualizaciones')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// La interfaz compilada vive en desktop/app (la deja ahí scripts/build-web.mjs)
const RAIZ_WEB = path.join(__dirname, 'app')

// La interfaz se sirve con un protocolo propio, app://gamehub/..., en vez de abrir el
// index.html como archivo (file://). Un archivo local tiene "origen nulo" y los
// navegadores le limitan cosas básicas (módulos ES, fetch, almacenamiento); con un
// protocolo propio la interfaz se comporta como una web normal.
const ESQUEMA = 'app'
const ORIGEN = `${ESQUEMA}://gamehub`

// En desarrollo se puede apuntar a un servidor de Vite: GAMEHUB_DEV_URL=http://localhost:5173
const URL_DESARROLLO = app.isPackaged ? null : process.env.GAMEHUB_DEV_URL

// "Prueba de humo": con --smoke-test la app arranca sin enseñar la ventana, comprueba que
// la interfaz carga y se cierra con código 0 (bien) o 1 (mal). La usa el flujo de GitHub
// Actions para no generar un instalador de una app que ni siquiera arranca.
const PRUEBA_HUMO = process.argv.includes('--smoke-test')

// En Windows, las notificaciones (los avisos de mensajes del chat) se asocian a la app por su
// "AppUserModelID". Tiene que ser el mismo appId con el que el instalador crea el acceso
// directo (package.json, build.appId); si no, Windows no las enseña o las pone a nombre de
// Electron.
if (process.platform === 'win32') app.setAppUserModelId('com.jesuusgallego.gamehub')

// Esto tiene que ir ANTES de que la app esté lista
protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

// ---- Instancia única -----------------------------------------------------------
// Si el usuario abre la app por segunda vez, no se abre otra ventana: se enfoca la
// que ya hay.
let ventana = null
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!ventana) return
    if (ventana.isMinimized()) ventana.restore()
    ventana.focus()
  })
}

// Al pulsar el aviso de un mensaje, la interfaz pide traer la ventana al frente (preload.js).
// Solo se hace caso a la ventana de la app.
ipcMain.on('gamehub:enfocar', (evento) => {
  if (!ventana || ventana.isDestroyed() || evento.sender !== ventana.webContents) return
  if (ventana.isMinimized()) ventana.restore()
  ventana.show()
  ventana.focus()
})

// ---- Tamaño y posición de la ventana, recordados entre ejecuciones ---------------
const ARCHIVO_ESTADO = () => path.join(app.getPath('userData'), 'ventana.json')
// Versión que se estaba ejecutando la última vez: sirve para saber que la app se ha
// actualizado y enseñar "se ha actualizado a la versión X" (ver avisarSiSeActualizo)
const ARCHIVO_VERSION = () => path.join(app.getPath('userData'), 'version.json')

function leerEstadoVentana() {
  const porDefecto = { width: 1280, height: 820 }
  try {
    const guardado = JSON.parse(fs.readFileSync(ARCHIVO_ESTADO(), 'utf8'))
    // Si el monitor donde estaba ya no existe, la ventana podría quedar fuera de la
    // pantalla: compruebo que cae dentro de alguno de los que hay ahora.
    const visible = screen.getAllDisplays().some(({ bounds: b }) =>
      guardado.x >= b.x && guardado.y >= b.y && guardado.x < b.x + b.width && guardado.y < b.y + b.height
    )
    return { ...porDefecto, ...guardado, ...(visible ? {} : { x: undefined, y: undefined }) }
  } catch {
    return porDefecto
  }
}

function guardarEstadoVentana() {
  if (!ventana || ventana.isDestroyed()) return
  try {
    // getNormalBounds es el tamaño "normal", aunque ahora esté maximizada
    const estado = { ...ventana.getNormalBounds(), maximizada: ventana.isMaximized() }
    fs.writeFileSync(ARCHIVO_ESTADO(), JSON.stringify(estado))
  } catch {
    // No guardar el tamaño no es grave
  }
}

// ---- Política de contenido (CSP) ---------------------------------------------------
// Le dice a la ventana de qué sitios puede cargar cosas. Es una segunda barrera: aunque
// algún día se colara código ajeno en la interfaz, no podría cargar scripts de fuera ni
// mandar datos a un sitio cualquiera.
function direccionApi() {
  try {
    return new URL(JSON.parse(fs.readFileSync(path.join(RAIZ_WEB, 'config.json'), 'utf8')).apiUrl).origin
  } catch {
    return null
  }
}

// index.html lleva un <script> en línea (aplica el tema antes de pintar, para que no
// parpadee). Una CSP estricta lo bloquearía, así que le doy permiso por su huella
// (hash): solo ese texto exacto puede ejecutarse.
function huellaScriptEnLinea() {
  try {
    const html = fs.readFileSync(path.join(RAIZ_WEB, 'index.html'), 'utf8')
    const guion = html.match(/<script>([\s\S]*?)<\/script>/)
    if (!guion) return null
    // El navegador convierte \r\n (Windows) y \r en \n al leer el HTML, y la huella se
    // compara con ese texto ya convertido. Si hasheo el archivo tal cual en un Windows,
    // con saltos \r\n, la huella no coincide y la CSP bloquea el script.
    const texto = guion[1].replace(/\r\n?/g, '\n')
    return `'sha256-${crypto.createHash('sha256').update(texto).digest('base64')}'`
  } catch {
    return null
  }
}

function construirCsp() {
  const api = direccionApi()
  const huella = huellaScriptEnLinea()
  return [
    "default-src 'self'",
    `script-src 'self' ${huella ?? ''}`.trim(),
    // Los estilos en línea los usa React en atributos style (barras de progreso...)
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // Portadas, capturas e iconos vienen de IGDB y Steam (https); data: y blob: son la
    // foto de perfil y el recortador
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${api ?? 'https:'} https://images.igdb.com`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

// ---- Avisos de actualización ---------------------------------------------------------
// Un diálogo del sistema, colgado de la ventana si existe
function mostrarDialogo(opciones) {
  return ventana ? dialog.showMessageBox(ventana, opciones) : dialog.showMessageBox(opciones)
}

// Primera vez que se abre una versión distinta de la anterior: "se ha actualizado a la
// versión X" con las novedades. La versión se guarda enseguida, así se enseña una sola
// vez aunque el diálogo se cierre sin leerlo.
function avisarSiSeActualizo() {
  let guardada = null
  try {
    guardada = JSON.parse(fs.readFileSync(ARCHIVO_VERSION(), 'utf8')).version ?? null
  } catch {
    // Sin archivo (instalación nueva o venimos de la 1.0.0, que no lo guardaba)
  }

  const aviso = actualizaciones.avisoTrasActualizar({
    versionGuardada: guardada,
    versionActual: app.getVersion(),
    hayEstadoPrevio: fs.existsSync(ARCHIVO_ESTADO()),
  })

  try {
    fs.writeFileSync(ARCHIVO_VERSION(), JSON.stringify({ version: app.getVersion() }))
  } catch {
    // Si no se puede guardar, el aviso se repetiría al abrir; no es grave
  }

  if (!aviso) return

  const x = actualizaciones.textos(app.getLocale())
  const lista = actualizaciones.novedades(app.getVersion(), app.getLocale())
  mostrarDialogo({
    type: 'info',
    title: 'GameHub',
    message: x.actualizada(app.getVersion()),
    detail: lista.length > 0 ? `${x.novedades}\n\n${lista.map((n) => `• ${n}`).join('\n')}` : undefined,
    buttons: [x.entendido],
  }).catch(() => {})
}

// La actualización ya está descargada (la app sigue abierta): pregunto si reinicia ya.
// "Más tarde" no hace falta gestionarlo: la librería la instala sola al cerrar la app.
function avisarDeActualizacionDescargada(info) {
  const x = actualizaciones.textos(app.getLocale())
  mostrarDialogo({
    type: 'info',
    title: 'GameHub',
    message: x.descargada(info.version),
    detail: x.detalleDescargada,
    buttons: [x.reiniciar, x.masTarde],
    defaultId: 0,
    cancelId: 1,
  })
    .then(({ response }) => {
      // (true, true): instala en silencio y vuelve a abrir la app
      if (response === 0) autoUpdater.quitAndInstall(true, true)
    })
    .catch(() => {})
}

// ---- La ventana ------------------------------------------------------------------
function crearVentana() {
  const estado = leerEstadoVentana()

  ventana = new BrowserWindow({
    x: estado.x,
    y: estado.y,
    width: estado.width,
    height: estado.height,
    minWidth: 900,
    minHeight: 600,
    title: 'GameHub',
    icon: path.join(__dirname, 'build', 'icon.png'),
    // Mismo color que el fondo del tema oscuro: así no hay un fogonazo blanco antes
    // de que cargue la interfaz
    backgroundColor: '#111a27',
    show: false,
    webPreferences: {
      contextIsolation: true, // la página no ve las APIs de Electron
      nodeIntegration: false, // ni puede usar Node
      sandbox: true,
      // Solo deja en la página window.gamehubEscritorio.enfocar() (ver preload.js)
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (estado.maximizada) ventana.maximize()
  // La enseño cuando ya hay algo que pintar, no en blanco
  ventana.once('ready-to-show', () => { if (!PRUEBA_HUMO) ventana.show() })
  // Y, ya visible, aviso si la app acaba de actualizarse (solo instalada, no en desarrollo)
  ventana.once('show', () => { if (app.isPackaged) avisarSiSeActualizo() })

  // Cualquier enlace que intente abrir una ventana nueva (los de IGDB, Steam...) va al
  // navegador del usuario, no a una ventana de Electron
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // La ventana nunca navega a otro sitio: solo se queda en la interfaz de la app
  ventana.webContents.on('will-navigate', (evento, url) => {
    const interno = url.startsWith(ORIGEN) || (URL_DESARROLLO && url.startsWith(URL_DESARROLLO))
    if (interno) return
    evento.preventDefault()
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })

  ventana.on('close', guardarEstadoVentana)
  ventana.on('closed', () => { ventana = null })

  ventana.loadURL(URL_DESARROLLO ?? `${ORIGEN}/index.html`)
  if (PRUEBA_HUMO) ejecutarPruebaHumo(ventana)
}

// Termina el proceso con "bien" solo si la interfaz ha cargado, React ha pintado algo y
// la CSP no ha bloqueado nada. Cualquier otra cosa, o pasar de 60 s, es un fallo.
function ejecutarPruebaHumo(win) {
  const problemas = []
  const terminar = (codigo, texto) => {
    console.log(`PRUEBA DE HUMO ${codigo === 0 ? 'OK' : 'FALLO'}: ${texto}`)
    app.exit(codigo)
  }
  setTimeout(() => terminar(1, 'la interfaz no terminó de cargar en 60 s'), 60000)

  // Según la versión de Electron el mensaje llega en un objeto o como tercer argumento
  win.webContents.on('console-message', (...args) => {
    const mensaje = String(args[0]?.message ?? args[2] ?? '')
    if (/Content Security Policy|Refused to/i.test(mensaje)) problemas.push(mensaje.slice(0, 200))
  })
  win.webContents.on('did-fail-load', (_e, codigo, descripcion, url) => {
    terminar(1, `no se pudo cargar ${url} (${codigo} ${descripcion})`)
  })
  win.webContents.on('render-process-gone', (_e, detalles) => {
    terminar(1, `el proceso de la interfaz se cerró (${detalles.reason})`)
  })

  win.webContents.once('did-finish-load', async () => {
    try {
      // Doy un respiro para que React termine de pintar
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const hijos = await win.webContents.executeJavaScript(
        'document.getElementById("root") ? document.getElementById("root").children.length : -1'
      )
      if (hijos < 1) return terminar(1, `React no pintó nada (hijos de #root: ${hijos})`)
      if (problemas.length > 0) return terminar(1, `la CSP bloqueó algo: ${problemas[0]}`)
      terminar(0, `interfaz cargada (${hijos} elemento(s) en #root, sin violaciones de la CSP)`)
    } catch (err) {
      terminar(1, `error al comprobar: ${err.message}`)
    }
  })
}

// ---- Arranque --------------------------------------------------------------------
app.whenReady().then(() => {
  // Sirvo los archivos de desktop/app para las direcciones app://gamehub/...
  protocol.handle(ESQUEMA, (peticion) => {
    let ruta = decodeURIComponent(new URL(peticion.url).pathname)
    if (ruta === '/') ruta = '/index.html'

    // Evito que una dirección con "../" salga de la carpeta de la interfaz
    const archivo = path.normalize(path.join(RAIZ_WEB, ruta))
    if (!archivo.startsWith(RAIZ_WEB + path.sep)) {
      return new Response('Prohibido', { status: 403 })
    }
    return net.fetch(pathToFileURL(archivo).toString())
  })

  // Añado la CSP a lo que sirve la propia app (no toca a IGDB ni al servidor de la API)
  const csp = construirCsp()
  session.defaultSession.webRequest.onHeadersReceived((detalles, devolver) => {
    const cabeceras = { ...detalles.responseHeaders }
    if (detalles.url.startsWith(ORIGEN)) cabeceras['Content-Security-Policy'] = [csp]
    devolver({ responseHeaders: cabeceras })
  })

  // Sin menú de aplicación al instalarla; en desarrollo se conserva (tiene las
  // herramientas de desarrollador)
  if (app.isPackaged) Menu.setApplicationMenu(null)

  crearVentana()

  // Actualizaciones automáticas: mira las Releases de GitHub (ver "publish" en
  // package.json). Si no hay conexión o no hay versión nueva, simplemente no hace nada.
  // Al terminar de descargar una versión nueva pregunto si reiniciar (en vez del
  // aviso del sistema de checkForUpdatesAndNotify, que no deja elegir).
  if (app.isPackaged && !PRUEBA_HUMO) {
    autoUpdater.on('update-downloaded', avisarDeActualizacionDescargada)
    autoUpdater.checkForUpdates().catch(() => {})
  }
})

app.on('window-all-closed', () => app.quit())

// "Preload": un trocito de código que Electron ejecuta en la ventana ANTES que la interfaz, con
// acceso a una parte mínima de Electron. Con contextBridge deja en la página
// `window.gamehubEscritorio` con una sola cosa: enfocar(), que pide al proceso principal que
// traiga la ventana al frente (la usa el aviso de un mensaje nuevo al pulsarlo, ver
// frontend/src/avisos.js). Desde la página, window.focus() no saca una ventana minimizada.
// La página sigue sin ver Electron ni Node: solo esa función.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gamehubEscritorio', {
  enfocar: () => ipcRenderer.send('gamehub:enfocar'),
})

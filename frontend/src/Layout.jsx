import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Menu from './Menu'
import ChatDock from './ChatDock'
import PedirFechaNacimiento from './PedirFechaNacimiento'
import { apiFetch } from './api'
import { borrarToken } from './sesion'
import { iniciarSondeo } from './sondeo'
import { avisosNuevos, mostrarAviso } from './avisos'
import { useAvisos } from './useAvisos'
import { useIdioma } from './IdiomaContext'

// Estructura común de las páginas con sesión: barra arriba y contenido centrado.
// <Outlet /> es donde React Router pinta la página hija (Biblioteca, Buscar o
// Perfil). El Layout no se desmonta al cambiar de página, así que la barra no se
// vuelve a crear.
//
// Aquí vive el perfil del usuario (nombre y foto): lo necesitan a la vez la barra
// (el avatar) y la página Perfil (donde se edita). Lo guardo en el padre común y
// lo reparto: la barra lo recibe por props, y las páginas hijas lo leen con
// useOutletContext(), que es el "props" de <Outlet />.
//
// El chat también vive aquí: su botón y su panel flotante están en TODAS las páginas con sesión, y
// siguen abiertos mientras navegas. Las páginas lo abren con `abrirChat(usuario)` del contexto
// (el botón Mensaje del carnet o del perfil de un amigo).
//
// Con las solicitudes de amistad pasa lo mismo: la barra enseña cuántas hay pendientes
// (la insignia de "Social") y la página Social las cambia al aceptarlas o rechazarlas. Y con
// los mensajes sin leer: la insignia de "Chat" y la página Chat, que los marca como leídos.
//
// También salen de aquí los avisos del sistema de los mensajes nuevos (ver avisos.js) y, si la
// cuenta es de antes de que hubiera edad mínima, la ventana que pide la fecha de nacimiento.
function Layout({ setToken }) {
  const { t } = useIdioma()
  const { activos: avisosActivos } = useAvisos()
  const [perfil, setPerfil] = useState(null)
  // Cuántas solicitudes de amistad me han enviado y aún no he respondido
  const [solicitudes, setSolicitudes] = useState(0)
  // Cuántos mensajes del chat tengo sin leer
  const [mensajes, setMensajes] = useState(0)
  // El panel del chat: si está abierto y qué conversación tiene delante (null = la lista). `con`
  // es la clave de la conversación: el nombre de la persona o "g:<id>" para un grupo (ver
  // logicaChat.js). Al cerrarlo se recuerda, para que al abrirlo siga donde estaba.
  const [chat, setChat] = useState({ abierto: false, con: null })
  // Lo que había escrito a medias en cada conversación; sobrevive a cerrar el panel
  const borradores = useRef(new Map())
  // Con una clave (un usuario o un grupo), abre esa conversación; sin ella, abre el panel
  // donde estaba
  const abrirChat = useCallback((clave) => {
    setChat((previo) => ({ abierto: true, con: clave ?? previo.con }))
  }, [])
  const cerrarChat = useCallback(() => setChat((previo) => ({ ...previo, abierto: false })), [])
  // Cambiar de conversación dentro del panel (null = volver a la lista)
  const elegirConversacion = useCallback((clave) => setChat({ abierto: true, con: clave }), [])
  // Los mensajes de los que ya se avisó (ver avisos.js) y si ya hubo una primera consulta
  const avisadosRef = useRef(new Set())
  const sembradoRef = useRef(false)
  const avisosActivosRef = useRef(avisosActivos)
  useEffect(() => { avisosActivosRef.current = avisosActivos }, [avisosActivos])
  const { pathname } = useLocation()

  // Pide el número de solicitudes recibidas. Si falla no hago nada: es solo un número
  // en la barra, y el error (si lo hay) ya saldrá en la página Social. Devuelve la
  // promesa para que el sondeo sepa cuándo ha terminado, y avisoLento: false porque aquí
  // un servidor que tarda en despertar no merece el aviso de "servidor lento".
  const refrescarSolicitudes = useCallback(() => {
    return apiFetch('/friends/requests/count', { avisoLento: false })
      .then((data) => setSolicitudes(data.received))
      .catch(() => {})
  }, [])

  // Igual con los mensajes sin leer. Dentro de la página Chat no hace falta preguntar: la lista de
  // conversaciones ya trae cuántos hay en cada una y la página fija el total con `ponerMensajes`.
  // Además, con lo que trae (`latest`, los últimos sin leer) decide si hay que avisar de algo
  // nuevo: solo si los avisos están activos y la ventana no está delante.
  const refrescarMensajes = useCallback(() => {
    return apiFetch('/chat/unread', { avisoLento: false })
      .then((data) => {
        setMensajes(data.unread)
        const delante = document.visibilityState === 'visible' && document.hasFocus()
        const avisos = avisosNuevos(data.latest ?? [], avisadosRef.current, { primeraVez: !sembradoRef.current, delante })
        sembradoRef.current = true
        if (!avisosActivosRef.current) return
        for (const aviso of avisos) mostrarAviso(aviso, t, elegirConversacion)
      })
      .catch(() => {})
  }, [t, elegirConversacion])

  // Las dos cuentas de la barra a la vez
  const refrescarAvisos = useCallback(
    () => Promise.all([refrescarSolicitudes(), refrescarMensajes()]),
    [refrescarSolicitudes, refrescarMensajes]
  )

  // Al entrar y cada vez que cambio de página: así llegan las solicitudes y los mensajes
  // nuevos sin esperar al sondeo
  useEffect(() => {
    refrescarAvisos()
  }, [pathname, refrescarAvisos])

  // Y mientras estoy en una página, sondeo cada minuto. Solo corre si la pestaña se ve y
  // hay actividad (ver sondeo.js): así una ventana olvidada no mantiene despiertos el
  // servidor ni la base de datos gratuitos.
  // Con los avisos del sistema activos, cada medio minuto y también con la ventana oculta o
  // minimizada (si no, nunca avisaría de nada), pero solo hasta 15 minutos después de la última
  // vez que tocaste la app. Es el precio de los avisos: ese rato el servidor no se duerme.
  useEffect(() => iniciarSondeo(refrescarAvisos, avisosActivos
    ? { cada: 30_000, seguirOculto: true, inactividad: 15 * 60_000 }
    : {}), [refrescarAvisos, avisosActivos])

  // Con mensajes sin leer, el título de la pestaña lo dice: "(2) GameHub"
  useEffect(() => {
    document.title = mensajes > 0 ? `(${mensajes > 99 ? '99+' : mensajes}) GameHub` : 'GameHub'
    return () => { document.title = 'GameHub' }
  }, [mensajes])

  useEffect(() => {
    let cancelado = false

    apiFetch('/profile')
      .then((data) => {
        if (!cancelado) setPerfil(data.user)
      })
      .catch((err) => {
        if (cancelado) return

        // Token caducado o cuenta borrada: cierro sesión. Cualquier otro fallo no
        // es grave aquí: la barra se queda sin avatar y ya se verá en la página.
        if (err.status === 401) {
          borrarToken()
          setToken("")
        }
      })

    return () => { cancelado = true }
  }, [setToken])

  return (
    <>
      <Menu setToken={setToken} perfil={perfil} solicitudes={solicitudes} mensajes={mensajes} />
      <main className="contenedor">
        <Outlet context={{ perfil, setPerfil, solicitudes, refrescarSolicitudes, abrirChat }} />
      </main>

      {perfil && !perfil.birth_date && (
        <PedirFechaNacimiento setToken={setToken} onGuardado={setPerfil} />
      )}

      <ChatDock
        abierto={chat.abierto}
        sinLeer={mensajes}
        clave={chat.con}
        yo={perfil?.username ?? null}
        borradores={borradores}
        setToken={setToken}
        ponerMensajes={setMensajes}
        onAbrir={() => abrirChat()}
        onCerrar={cerrarChat}
        onElegir={elegirConversacion}
      />
    </>
  )
}

export default Layout

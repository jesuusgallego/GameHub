import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Menu from './Menu'
import { apiFetch } from './api'
import { borrarToken } from './sesion'
import { iniciarSondeo } from './sondeo'

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
// Con las solicitudes de amistad pasa lo mismo: la barra enseña cuántas hay pendientes
// (la insignia de "Social") y la página Social las cambia al aceptarlas o rechazarlas.
function Layout({ setToken }) {
  const [perfil, setPerfil] = useState(null)
  // Cuántas solicitudes de amistad me han enviado y aún no he respondido
  const [solicitudes, setSolicitudes] = useState(0)
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

  // Al entrar y cada vez que cambio de página: así llegan las solicitudes nuevas sin
  // esperar al sondeo
  useEffect(() => {
    refrescarSolicitudes()
  }, [pathname, refrescarSolicitudes])

  // Y mientras estoy en una página, sondeo cada minuto. Solo corre si la pestaña se ve y
  // hay actividad (ver sondeo.js): así una ventana olvidada no mantiene despiertos el
  // servidor ni la base de datos gratuitos.
  useEffect(() => iniciarSondeo(refrescarSolicitudes), [refrescarSolicitudes])

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
      <Menu setToken={setToken} perfil={perfil} solicitudes={solicitudes} />
      <main className="contenedor">
        <Outlet context={{ perfil, setPerfil, solicitudes, refrescarSolicitudes }} />
      </main>
    </>
  )
}

export default Layout

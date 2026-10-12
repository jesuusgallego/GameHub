import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Menu from './Menu'
import { apiFetch } from './api'
import { borrarToken } from './sesion'

// Estructura común de las páginas con sesión: barra arriba y contenido centrado.
// <Outlet /> es donde React Router pinta la página hija (Biblioteca, Buscar o
// Perfil). El Layout no se desmonta al cambiar de página, así que la barra no se
// vuelve a crear.
//
// Aquí vive el perfil del usuario (nombre y foto): lo necesitan a la vez la barra
// (el avatar) y la página Perfil (donde se edita). Lo guardo en el padre común y
// lo reparto: la barra lo recibe por props, y las páginas hijas lo leen con
// useOutletContext(), que es el "props" de <Outlet />.
function Layout({ setToken }) {
  const [perfil, setPerfil] = useState(null)

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
      <Menu setToken={setToken} perfil={perfil} />
      <main className="contenedor">
        <Outlet context={{ perfil, setPerfil }} />
      </main>
    </>
  )
}

export default Layout

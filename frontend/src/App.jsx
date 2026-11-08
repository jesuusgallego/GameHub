import { useState, useEffect } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Biblioteca from './Biblioteca'
import Buscar from './Buscar'
import Perfil from './Perfil'
import Social from './Social'
import Noticias from './Noticias'
import PerfilPublico from './PerfilPublico'
import Layout from './Layout'
import RutaProtegida from './RutaProtegida'
import Registro from './Registro'
import Recuperar from './Recuperar'
import { leerToken, alCambiarSesionEnOtraPestana } from './sesion'

// La versión web usa direcciones normales (/biblioteca). La de escritorio carga la
// interfaz desde un archivo, y ahí una dirección como /biblioteca no existe: al recargar
// daría pantalla en blanco. Con HashRouter la ruta va detrás de # (index.html#/biblioteca)
// y siempre se sirve el mismo archivo. Se elige al compilar (VITE_DESKTOP=1).
const Router = import.meta.env.VITE_DESKTOP ? HashRouter : BrowserRouter
// La web publicada vive en una subcarpeta (/GameHub/, ver vite.config.js): el router tiene que
// saberlo para que /GameHub/noticias sea su ruta /noticias. BASE_URL la pone Vite ("/" si no).
const BASENAME = import.meta.env.VITE_DESKTOP ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

function App() {
  const [token, setToken] = useState(leerToken())

  // Si otra pestaña inicia sesión con otra cuenta (o la cierra), recargo: así esta pestaña no se
  // queda enseñando a medias los datos de la cuenta anterior (ver sesion.js)
  useEffect(() => alCambiarSesionEnOtraPestana(() => window.location.reload()), [])

  return (
    <Router basename={BASENAME}>
      <Routes>
        {/* Lo primero que se ve al entrar son las noticias, con cuenta o sin ella */}
        <Route path="/" element={<Navigate to="/noticias" replace />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        {/* Esta ruta no tiene path: envuelve a sus hijas con la barra (Layout). Noticias y Buscar se
            usan sin cuenta (como invitado); las demás piden iniciar sesión (RutaProtegida enseña
            entonces una invitación a entrar o registrarse, sin salir de la app). */}
        <Route element={<Layout token={token} setToken={setToken} />}>
          <Route path="/noticias" element={<Noticias setToken={setToken} />} />
          <Route path="/buscar" element={<Buscar setToken={setToken} />} />
          <Route path="/biblioteca" element={<RutaProtegida token={token} seccion="biblioteca"><Biblioteca setToken={setToken} /></RutaProtegida>} />
          <Route path="/perfil" element={<RutaProtegida token={token} seccion="perfil"><Perfil setToken={setToken} /></RutaProtegida>} />
          <Route path="/social" element={<RutaProtegida token={token} seccion="social"><Social setToken={setToken} /></RutaProtegida>} />
          <Route path="/usuarios/:username" element={<RutaProtegida token={token} seccion="usuarios"><PerfilPublico setToken={setToken} /></RutaProtegida>} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
import { useState, useEffect } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Login from './Login'
import Biblioteca from './Biblioteca'
import Buscar from './Buscar'
import Perfil from './Perfil'
import Social from './Social'
import PerfilPublico from './PerfilPublico'
import Layout from './Layout'
import RutaProtegida from './RutaProtegida'
import Registro from './Registro'
import Recuperar from './Recuperar'
import { leerToken, alCambiarSesionEnOtraPestana } from './sesion'
import { rutaChat } from './chat'

// La versión web usa direcciones normales (/biblioteca). La de escritorio carga la
// interfaz desde un archivo, y ahí una dirección como /biblioteca no existe: al recargar
// daría pantalla en blanco. Con HashRouter la ruta va detrás de # (index.html#/biblioteca)
// y siempre se sirve el mismo archivo. Se elige al compilar (VITE_DESKTOP=1).
const Router = import.meta.env.VITE_DESKTOP ? HashRouter : BrowserRouter

// /chat y /chat/ana (el chat tuvo página propia) llevan a la pestaña Chat de Social
function RedirigirChat() {
  const { username } = useParams()
  return <Navigate to={rutaChat(username)} replace />
}

function App() {
  const [token, setToken] = useState(leerToken())

  // Si otra pestaña inicia sesión con otra cuenta (o la cierra), recargo: así esta pestaña no se
  // queda enseñando a medias los datos de la cuenta anterior (ver sesion.js)
  useEffect(() => alCambiarSesionEnOtraPestana(() => window.location.reload()), [])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar" element={<Recuperar />} />
        {/* Esta ruta no tiene path: la uso para proteger a sus hijas y envolverlas con la barra */}
        <Route
          element={
            <RutaProtegida token={token}>
              <Layout setToken={setToken} />
            </RutaProtegida>
          }
        >
          <Route path="/biblioteca" element={<Biblioteca setToken={setToken} />} />
          <Route path="/buscar" element={<Buscar setToken={setToken} />} />
          <Route path="/perfil" element={<Perfil setToken={setToken} />} />
          <Route path="/social" element={<Social setToken={setToken} />} />
          {/* El chat es ahora una pestaña de Social; las direcciones antiguas siguen valiendo */}
          <Route path="/chat/:username?" element={<RedirigirChat />} />
          <Route path="/usuarios/:username" element={<PerfilPublico setToken={setToken} />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
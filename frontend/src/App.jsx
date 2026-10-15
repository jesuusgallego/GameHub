import { useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { leerToken } from './sesion'

// La versión web usa direcciones normales (/biblioteca). La de escritorio carga la
// interfaz desde un archivo, y ahí una dirección como /biblioteca no existe: al recargar
// daría pantalla en blanco. Con HashRouter la ruta va detrás de # (index.html#/biblioteca)
// y siempre se sirve el mismo archivo. Se elige al compilar (VITE_DESKTOP=1).
const Router = import.meta.env.VITE_DESKTOP ? HashRouter : BrowserRouter

function App() {
  const [token, setToken] = useState(leerToken())

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
          <Route path="/usuarios/:username" element={<PerfilPublico setToken={setToken} />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
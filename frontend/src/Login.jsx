import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { apiFetch } from './api'
import Marca from './Marca'
import MenuAjustes from './MenuAjustes'
import { useIdioma } from './IdiomaContext'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { escribirToken } from './sesion'

function Login({ setToken }) {
  const { t } = useIdioma()
  // Email o nombre de usuario: el servidor distingue cuál es
  const [identificador, setIdentificador] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()
  // Recuperar llega aquí con state.passwordRestablecida al cambiar la contraseña
  const { state } = useLocation()

  function handleLogin(e) {
    e.preventDefault()
    setError("")

    if (identificador.trim() === "") {
      setError(t('auth.login.identificadorVacio'))
      return
    }

    if (password === "") {
      setError(t('auth.login.passwordVacia'))
      return
    }

    setEnviando(true)
    apiFetch('/auth/login', { method: 'POST', body: { identifier: identificador.trim(), password } })
      .then(data => {
        setToken(data.token)
        escribirToken(data.token)
        navigate('/noticias')
      })
      .catch(err => setError(err.message))
      .finally(() => setEnviando(false))
  }

  return (
    <main className="auth">
      <div className="auth__tema">
        <MenuAjustes />
      </div>

      <div className="auth__tarjeta">
        <Marca grande />
        <h1 className="auth__titulo">{t('auth.login.titulo')}</h1>

        <form className="formulario" onSubmit={handleLogin}>
          <label className="campo">
            <span>{t('auth.login.identificador')}</span>
            <input
              type="text"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <label className="campo">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <Link to="/recuperar" className="auth__olvido">{t('auth.login.olvidaste')}</Link>

          <Mensaje texto={error} />
          <Mensaje tipo="ok" texto={state?.passwordRestablecida && !error ? t('auth.login.passwordRestablecida') : ""} />

          <button type="submit" className="btn btn--primario btn--block" disabled={enviando}>
            {enviando ? <><Cargando tamano="pequeno" /> {t('auth.login.entrando')}</> : t('auth.login.titulo')}
          </button>
        </form>

        <p className="auth__pie">
          {t('auth.login.sinCuenta')} <Link to="/registro">{t('auth.login.registrate')}</Link>
        </p>
      </div>
    </main>
  )
}

export default Login

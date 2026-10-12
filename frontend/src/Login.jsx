import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { apiFetch } from './api'
import Marca from './Marca'
import MenuAjustes from './MenuAjustes'
import { useIdioma } from './IdiomaContext'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { escribirToken } from './sesion'
import { emailRegex } from './validacion'

function Login({ setToken }) {
  const { t } = useIdioma()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()
  // Recuperar llega aquí con state.passwordRestablecida al cambiar la contraseña
  const { state } = useLocation()

  function handleLogin(e) {
    e.preventDefault()
    setError("")

    if (!emailRegex.test(email)) {
      setError(t('validacion.emailInvalido'))
      return
    }

    if (password === "") {
      setError(t('auth.login.passwordVacia'))
      return
    }

    setEnviando(true)
    apiFetch('/auth/login', { method: 'POST', body: { email, password } })
      .then(data => {
        setToken(data.token)
        escribirToken(data.token)
        navigate('/biblioteca')
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
            <span>{t('auth.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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

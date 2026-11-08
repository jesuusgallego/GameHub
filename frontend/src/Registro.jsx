import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import SeguirSinCuenta from './SeguirSinCuenta'
import { rutaDeVuelta } from './invitado'
import { apiFetch } from './api'
import Marca from './Marca'
import MenuAjustes from './MenuAjustes'
import { useIdioma } from './IdiomaContext'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import CampoFecha from './CampoFecha'
import {
  emailRegex, passwordRegex, usernameRegex, normalizarUsername, USERNAME_MAX,
  EDAD_MINIMA, limitesFechaNacimiento, problemaFechaNacimiento,
} from './validacion'

function Registro() {
  const { t } = useIdioma()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // "AAAA-MM-DD". Es obligatoria: hay que tener al menos EDAD_MINIMA años (14)
  const [nacimiento, setNacimiento] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()
  // La página de la app a la que volver al terminar (sin cuenta, se llega con state.desde)
  const { state } = useLocation()
  const desde = rutaDeVuelta(state?.desde)
  const { min: nacimientoMin, max: nacimientoMax } = limitesFechaNacimiento()

  function handleRegistro(e) {
    e.preventDefault()
    setError("")

    if (username === "") {
      setError(t('validacion.usernameObligatorio'))
      return
    }

    if (!usernameRegex.test(username)) {
      setError(t('validacion.usernameInvalido'))
      return
    }

    if (!emailRegex.test(email)) {
      setError(t('validacion.emailInvalido'))
      return
    }

    if (!passwordRegex.test(password)) {
      setError(t('validacion.passwordRequisitos'))
      return
    }

    const problemaFecha = problemaFechaNacimiento(nacimiento)
    if (problemaFecha) {
      setError(t(`edad.error.${problemaFecha}`, { n: EDAD_MINIMA }))
      return
    }

    setEnviando(true)
    apiFetch('/auth/register', {
      method: 'POST',
      body: { username, email, password, birth_date: nacimiento }
    })
      // La cuenta está creada: al login, con el nombre ya escrito y la página a la que volver
      .then(() => navigate('/login', { state: { cuentaCreada: true, usuario: username, desde } }))
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
        <h1 className="auth__titulo">{t('auth.registro.titulo')}</h1>

        <form className="formulario" onSubmit={handleRegistro}>
          <label className="campo">
            <span>{t('auth.registro.username')}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(normalizarUsername(e.target.value))}
              maxLength={USERNAME_MAX}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <small>{t('validacion.usernameAyuda')}</small>
          </label>
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
              autoComplete="new-password"
              required
            />
            <small>{t('auth.registro.passwordAyuda')}</small>
          </label>
          <label className="campo">
            <span>{t('editarPerfil.nacimiento')}</span>
            <CampoFecha
              value={nacimiento}
              onChange={(e) => setNacimiento(e.target.value)}
              min={nacimientoMin}
              max={nacimientoMax}
              autoComplete="bday"
              required
            />
            <small>{t('auth.registro.nacimientoAyuda', { n: EDAD_MINIMA })}</small>
          </label>

          <Mensaje texto={error} />

          <button type="submit" className="btn btn--primario btn--block" disabled={enviando}>
            {enviando ? <><Cargando tamano="pequeno" /> {t('auth.registro.registrando')}</> : t('auth.registro.boton')}
          </button>
        </form>

        <p className="auth__pie">
          {t('auth.registro.yaCuenta')} <Link to="/login" state={{ desde }}>{t('auth.registro.iniciaSesion')}</Link>
        </p>

        <p className="auth__pie">
          <SeguirSinCuenta desde={desde} />
        </p>
      </div>
    </main>
  )
}

export default Registro

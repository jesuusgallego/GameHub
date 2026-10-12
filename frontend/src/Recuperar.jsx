import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from './api'
import Marca from './Marca'
import MenuAjustes from './MenuAjustes'
import CampoContrasena from './CampoContrasena'
import RequisitosContrasena from './RequisitosContrasena'
import { useIdioma } from './IdiomaContext'
import { useCambioVista } from './useCambioVista'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { emailRegex, passwordRegex } from './validacion'


// Lo que espera el backend entre un código y el siguiente (ESPERA_SEGUNDOS en
// backend/src/services/recuperacion.js). Aquí solo sirve para desactivar el botón
// de reenviar: el que lo impone de verdad es el servidor.
const ESPERA_REENVIO = 60

// Recuperar la contraseña en dos pasos, en la misma tarjeta:
//  1. "correo": escribo mi email y el servidor me envía un código de 6 dígitos.
//  2. "codigo": escribo el código y la contraseña nueva.
// Se usa un código y no un enlace porque la app de escritorio no tiene una
// dirección web a la que mandar al usuario desde el correo.
function Recuperar() {
  const { t, idioma } = useIdioma()
  const navigate = useNavigate()
  const { saliendo, cambiar } = useCambioVista()

  const [paso, setPaso] = useState("correo") // "correo" o "codigo"
  const [email, setEmail] = useState("")
  const [codigo, setCodigo] = useState("")
  const [nueva, setNueva] = useState("")
  const [repetida, setRepetida] = useState("")
  const [error, setError] = useState("")
  const [reenviado, setReenviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Segundos que faltan para poder pedir otro código (0 = ya se puede)
  const [espera, setEspera] = useState(0)

  // Cuenta atrás de un segundo en un segundo. Cada cambio de `espera` programa el
  // siguiente; si salgo de la pantalla, el cleanup lo cancela.
  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  // Pide el código. Sirve para el primer envío y para reenviar.
  async function pedirCodigo() {
    await apiFetch('/auth/forgot-password', { method: 'POST', body: { email: email.trim(), idioma } })
    setEspera(ESPERA_REENVIO)
  }

  async function handleCorreo(e) {
    e.preventDefault()
    setError("")

    if (!emailRegex.test(email.trim())) {
      setError(t('validacion.emailInvalido'))
      return
    }

    setEnviando(true)
    try {
      await pedirCodigo()
      cambiar(() => setPaso("codigo"))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleReenviar() {
    setError("")
    setReenviado(false)
    setEnviando(true)
    try {
      await pedirCodigo()
      setReenviado(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleCambiar(e) {
    e.preventDefault()
    setError("")
    setReenviado(false)

    if (!/^\d{6}$/.test(codigo)) {
      setError(t('auth.recuperar.codigoInvalido'))
      return
    }

    if (!passwordRegex.test(nueva)) {
      setError(t('cuenta.passwordNuevaRequisitos'))
      return
    }

    if (nueva !== repetida) {
      setError(t('cuenta.passwordNoCoinciden'))
      return
    }

    setEnviando(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim(), code: codigo, new_password: nueva },
      })
      navigate('/login', { state: { passwordRestablecida: true } })
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  function volverACorreo() {
    cambiar(() => {
      setPaso("correo")
      setError("")
      setReenviado(false)
      setCodigo("")
      setNueva("")
      setRepetida("")
    })
  }

  const repiteAviso = repetida === "" ? "" : (nueva === repetida ? t('password.coinciden') : t('cuenta.passwordNoCoinciden'))

  return (
    <main className="auth">
      <div className="auth__tema">
        <MenuAjustes />
      </div>

      <div className="auth__tarjeta">
        <Marca grande />
        <h1 className="auth__titulo">{t('auth.recuperar.titulo')}</h1>

        {/* key: al cambiar de paso la vista nueva entra con su animación */}
        <div key={paso} className={saliendo ? "vista vista--saliendo" : "vista"}>
          {paso === "correo" ? (
            <form className="formulario" onSubmit={handleCorreo}>
              <p className="auth__ayuda">{t('auth.recuperar.ayudaCorreo')}</p>

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

              <Mensaje texto={error} />

              <button type="submit" className="btn btn--primario btn--block" disabled={enviando}>
                {enviando ? <><Cargando tamano="pequeno" /> {t('auth.recuperar.enviando')}</> : t('auth.recuperar.enviar')}
              </button>
            </form>
          ) : (
            <form className="formulario" onSubmit={handleCambiar}>
              <p className="auth__ayuda">{t('auth.recuperar.ayudaCodigo', { email: email.trim() })}</p>

              <label className="campo">
                <span>{t('auth.recuperar.codigo')}</span>
                {/* Solo dígitos y 6 como mucho; one-time-code deja que el móvil
                    ofrezca el código del correo. Sin maxLength a propósito: el
                    navegador recortaría "123 456" (pegado con espacio) antes de
                    que lo filtre onChange y se perdería un dígito. */}
                <input
                  className="campo-codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </label>

              <CampoContrasena
                etiqueta={t('cuenta.passwordNueva')}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                autoComplete="new-password"
              >
                <RequisitosContrasena valor={nueva} />
              </CampoContrasena>
              <CampoContrasena
                etiqueta={t('cuenta.passwordRepite')}
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                autoComplete="new-password"
              >
                <Mensaje tipo={nueva === repetida ? "ok" : "aviso"} texto={repiteAviso} className="mensaje--compacto" />
              </CampoContrasena>

              <Mensaje texto={error} />
              <Mensaje tipo="ok" texto={reenviado ? t('auth.recuperar.reenviado') : ""} />

              <button type="submit" className="btn btn--primario btn--block" disabled={enviando}>
                {enviando ? <><Cargando tamano="pequeno" /> {t('auth.recuperar.cambiando')}</> : t('auth.recuperar.cambiar')}
              </button>

              <div className="auth__secundarias">
                <button type="button" className="btn btn--secundario" onClick={handleReenviar} disabled={enviando || espera > 0}>
                  {espera > 0 ? t('auth.recuperar.reenviarEn', { segundos: espera }) : t('auth.recuperar.reenviar')}
                </button>
                <button type="button" className="btn btn--secundario" onClick={volverACorreo} disabled={enviando}>
                  {t('auth.recuperar.otroEmail')}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="auth__pie">
          <Link to="/login">{t('auth.recuperar.volver')}</Link>
        </p>
      </div>
    </main>
  )
}

export default Recuperar

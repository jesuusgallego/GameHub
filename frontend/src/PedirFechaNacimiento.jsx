import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import { borrarToken } from './sesion'
import Cargando from './Cargando'
import Mensaje from './Mensaje'
import { useVentana } from './useVentana'
import { useIdioma } from './IdiomaContext'
import { EDAD_MINIMA, limitesFechaNacimiento, problemaFechaNacimiento } from './validacion'

// Ventana que pide la fecha de nacimiento a las cuentas creadas antes de que hubiera edad
// mínima (14 años, ver EDAD_MINIMA). Sale sobre cualquier página hasta que se guarda una fecha
// válida y no se puede cerrar con Esc ni pulsando fuera: es un requisito para seguir. Quien no
// llega a la edad mínima no puede continuar; puede cerrar sesión.
//  - onGuardado(usuario): con el perfil ya actualizado (lo guarda Layout)
//  - setToken: para cerrar sesión
function PedirFechaNacimiento({ onGuardado, setToken }) {
  const { t } = useIdioma()
  const dialogRef = useRef(null)
  const campoRef = useRef(null)
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Guardado: sale con su animación y entonces avisa a Layout (que la quita)
  const guardadoRef = useRef(null)
  const { saliendo, cerrar } = useVentana(() => onGuardado(guardadoRef.current))
  const { min, max } = limitesFechaNacimiento()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    campoRef.current.focus()
  }, [])

  async function guardar(e) {
    e.preventDefault()
    const problema = problemaFechaNacimiento(fecha)
    if (problema) {
      setError(t(`edad.error.${problema}`, { n: EDAD_MINIMA }))
      return
    }
    setError('')
    setEnviando(true)
    try {
      const data = await apiFetch('/profile', { method: 'PATCH', body: { birth_date: fecha } })
      guardadoRef.current = data.user
      cerrar()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  function cerrarSesion() {
    borrarToken()
    setToken('')
  }

  return (
    <dialog
      ref={dialogRef}
      className={saliendo ? 'dialogo dialogo--edad ventana--saliendo' : 'dialogo dialogo--edad'}
      aria-labelledby="edad-titulo"
      aria-describedby="edad-texto"
      // Esc no la cierra: hace falta la fecha para seguir
      onCancel={(e) => e.preventDefault()}
    >
      <div className="dialogo--edad__icono" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path className="dialogo--edad__marca" d="m9 15 2 2 4-4" />
        </svg>
      </div>
      <h2 id="edad-titulo" className="dialogo__titulo">{t('edad.titulo')}</h2>
      <p id="edad-texto" className="dialogo__mensaje">{t('edad.texto', { n: EDAD_MINIMA })}</p>

      <form className="formulario" onSubmit={guardar} noValidate>
        <label className="campo">
          <span>{t('editarPerfil.nacimiento')}</span>
          <input
            ref={campoRef}
            type="date"
            value={fecha}
            min={min}
            max={max}
            required
            onChange={(e) => setFecha(e.target.value)}
          />
          <small>{t('edad.privacidad')}</small>
        </label>

        <Mensaje texto={error} />

        <div className="dialogo__acciones">
          <button type="button" className="btn btn--secundario" onClick={cerrarSesion}>
            {t('menu.cerrarSesion')}
          </button>
          <button type="submit" className="btn btn--primario" disabled={enviando}>
            {enviando ? <><Cargando tamano="pequeno" /> {t('edad.guardando')}</> : t('edad.guardar')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default PedirFechaNacimiento

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useVentana } from './useVentana'
import { useIdioma } from './IdiomaContext'

// La ventana que sale cuando, sin cuenta, se pulsa algo que la necesita (de momento, "Añadir a mi
// biblioteca" en Buscar y en la ficha de un juego). Explica para qué hace falta y ofrece crearla o
// iniciar sesión; al terminar se vuelve a esta misma página (state.desde, ver Login.jsx).
// Entra y sale con animación, como las demás ventanas (useVentana).
//  - mensaje: por qué hace falta la cuenta ("Para guardar Hades en tu biblioteca...")
//  - onCerrar(): "Ahora no", Esc o un clic fuera
function VentanaCuenta({ mensaje, onCerrar }) {
  const { t } = useIdioma()
  const dialogRef = useRef(null)
  const registroRef = useRef(null)
  const { saliendo, cerrar, alCancelar } = useVentana(onCerrar)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    registroRef.current.focus()
  }, [])

  // Primero sale la ventana con su animación y después se cambia de página
  function ir(ruta) {
    cerrar(() => navigate(ruta, { state: { desde: pathname + search } }))
  }

  return (
    <dialog
      ref={dialogRef}
      className={saliendo ? 'dialogo ventana-cuenta ventana--saliendo' : 'dialogo ventana-cuenta'}
      aria-labelledby="ventana-cuenta-titulo"
      aria-describedby="ventana-cuenta-mensaje"
      onCancel={alCancelar}
      onClose={onCerrar}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}
    >
      <span className="pide-cuenta__icono" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="18" rx="1" />
          <path d="M7 3v18" />
          <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
        </svg>
      </span>
      <h2 id="ventana-cuenta-titulo" className="dialogo__titulo">{t('invitado.ventana.titulo')}</h2>
      <p id="ventana-cuenta-mensaje" className="dialogo__mensaje">{mensaje}</p>

      <div className="ventana-cuenta__acciones">
        <button ref={registroRef} type="button" className="btn btn--primario" onClick={() => ir('/registro')}>
          {t('invitado.crearCuenta')}
        </button>
        <button type="button" className="btn btn--secundario" onClick={() => ir('/login')}>
          {t('invitado.yaTengoCuenta')}
        </button>
        <button type="button" className="ventana-cuenta__despues" onClick={() => cerrar()}>
          {t('invitado.ahoraNo')}
        </button>
      </div>
    </dialog>
  )
}

export default VentanaCuenta

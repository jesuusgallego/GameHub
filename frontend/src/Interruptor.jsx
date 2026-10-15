// Interruptor (encendido / apagado) para un ajuste que es un sí o un no. Es un botón con
// role="switch": los lectores de pantalla lo anuncian como "activado/desactivado" y se
// maneja con Espacio o Enter. La bolita se desliza con una transición.
//  - activado: boolean
//  - onChange(nuevoValor)
//  - etiqueta: nombre accesible (cuando no hay una <label> con su texto alrededor)
//  - disabled
function Interruptor({ activado, onChange, etiqueta, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activado}
      aria-label={etiqueta}
      disabled={disabled}
      className={activado ? "interruptor interruptor--activo" : "interruptor"}
      onClick={() => onChange(!activado)}
    >
      <span className="interruptor__bola" aria-hidden="true" />
    </button>
  )
}

export default Interruptor

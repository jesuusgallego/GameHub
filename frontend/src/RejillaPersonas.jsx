import TarjetaPersona from './TarjetaPersona'

// Una rejilla de tarjetas de personas. Se adapta al ancho: de una columna en el móvil a
// varias en pantallas anchas.
//  - personas: [{ username, ... }]; onCambio(persona) y cerrarSesion() se pasan a cada tarjeta
function RejillaPersonas({ personas, onCambio, cerrarSesion }) {
  return (
    <ul className="rejilla-personas">
      {personas.map((persona, i) => (
        <TarjetaPersona
          key={persona.username}
          persona={persona}
          orden={i}
          onCambio={onCambio}
          cerrarSesion={cerrarSesion}
        />
      ))}
    </ul>
  )
}

export default RejillaPersonas

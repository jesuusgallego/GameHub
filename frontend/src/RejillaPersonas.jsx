import Carnet from './Carnet'

// Una rejilla de carnets de personas. Se adapta al ancho: de una columna en el móvil a
// varias en pantallas anchas.
//  - personas: [{ username, ... }]; onCambio(persona) y cerrarSesion() se pasan a cada carnet
function RejillaPersonas({ personas, onCambio, cerrarSesion }) {
  return (
    <ul className="rejilla-personas">
      {personas.map((persona, i) => (
        <Carnet
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

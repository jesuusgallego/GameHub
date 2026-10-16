import { useState } from 'react'
import { usePresencia } from './usePresencia'

// Un bloque que se despliega al aparecer y se pliega al desaparecer, en lugar de aparecer de
// golpe y empujar de un salto todo lo que tiene debajo (por ejemplo, la fila "Jugando ahora" de la
// biblioteca cuando pones tu primer juego en "jugando"). Anima la altura con grid-template-rows,
// de 0fr a 1fr; el hueco de debajo va dentro (padding-bottom), así también se pliega con él.
//  - abierto: si se ve
//  - hueco: el espacio que deja debajo (una medida CSS; por defecto 2.25rem). Va dentro del
//    bloque para que se pliegue con él.
//  - children: el contenido; mientras se pliega se conserva el último que hubo
// Si ya está abierto cuando se pinta la página por primera vez, no se anima.
function Plegable({ abierto, hueco, children }) {
  const { montado, saliendo } = usePresencia(abierto, 320)
  const [ultimo, setUltimo] = useState(children)
  const [quieto, setQuieto] = useState(abierto)

  if (abierto && children !== ultimo) setUltimo(children)
  // Cuando se ha plegado del todo, la próxima vez sí se anima
  if (!montado && quieto) setQuieto(false)

  if (!montado) return null

  const clases = ['plegable', saliendo && 'plegable--saliendo', quieto && 'plegable--quieto'].filter(Boolean).join(' ')
  return (
    <div className={clases} style={hueco ? { '--plegable-hueco': hueco } : undefined}>
      <div className="plegable__interior">{abierto ? children : ultimo}</div>
    </div>
  )
}

export default Plegable

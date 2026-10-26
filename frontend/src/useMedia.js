import { useState, useEffect } from 'react'

// Si la pantalla cumple una media query de CSS ('(max-width: 820px)'...), y se actualiza al girar
// el móvil o cambiar el tamaño de la ventana. Sirve para pintar un componente distinto en el móvil
// cuando no basta con cambiar el CSS (por ejemplo, otros controles).
export function useMedia(consulta) {
  const [cumple, setCumple] = useState(() => window.matchMedia(consulta).matches)

  useEffect(() => {
    const media = window.matchMedia(consulta)
    const alCambiar = () => setCumple(media.matches)
    alCambiar()
    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [consulta])

  return cumple
}

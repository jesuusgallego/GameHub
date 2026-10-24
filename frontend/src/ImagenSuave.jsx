import { useState } from 'react'

// Una imagen que aparece con un fundido cuando termina de cargar, en lugar de saltar de golpe
// (las portadas se cargan según se ven: con `loading="lazy"` llegan una a una al hacer scroll).
// Hasta entonces se ve el fondo del contenedor. Si la imagen ya estaba en la caché del navegador
// se ve al instante, sin fundido. Acepta lo mismo que un <img>.
function ImagenSuave({ className = "", alt = "", onError, ...resto }) {
  const [cargada, setCargada] = useState(false)

  return (
    <img
      {...resto}
      alt={alt}
      className={`${className} imagen-suave${cargada ? " imagen-suave--cargada" : ""}`.trim()}
      // Si ya estaba cargada cuando React la crea (caché), el evento load puede haber pasado
      ref={(el) => { if (el?.complete && el.naturalWidth > 0) setCargada(true) }}
      onLoad={() => setCargada(true)}
      // Si falla también se da por "cargada" (para no dejar el hueco a medias) y se avisa a quien la
      // usa, que puede poner otra cosa en su lugar
      onError={(e) => { setCargada(true); onError?.(e) }}
    />
  )
}

export default ImagenSuave

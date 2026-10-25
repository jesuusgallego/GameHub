import { EscenaNoticias, EscenaBiblioteca, EscenaSala } from './EscenasCabecera'

// El fondo de las cabeceras grandes de la app (Social, Noticias y Mi biblioteca). Las tres comparten
// la forma (la tarjeta .banner-perfil, el título, las pastillas de cristal) y el mismo tratamiento
// del fondo, pero cada una tiene su color y una escena ilustrada que cuenta de qué va su apartado
// (ver EscenasCabecera.jsx):
//  - 'sala' (Social): violeta y cian; amigos jugando juntos en el sofá
//  - 'noticias': rojo y ámbar; periódicos y una revista de videojuegos
//  - 'biblioteca': esmeralda y azul; una estantería con tu colección de juegos
// Va dentro de un <header className="banner-perfil ...">; el contenido de la cabecera va después,
// por encima (z-index 1). Los colores están en estilos/perfil-cabecera-y-pestanas.css y las escenas
// en estilos/escenas-cabecera.css.
//  - estilo: 'sala', 'noticias' o 'biblioteca'
//  - imagenes: las fotos de la escena (lo que juegan tus amigos, las de las noticias, tus portadas)
const ESCENAS = { sala: EscenaSala, noticias: EscenaNoticias, biblioteca: EscenaBiblioteca }

function FondoCabecera({ estilo = 'sala', imagenes = [] }) {
  const Escena = ESCENAS[estilo]
  return (
    <>
      <div className={`banner-perfil__fondo fondo--${estilo}`} aria-hidden="true" />
      <Escena imagenes={imagenes} />
      {estilo === 'sala' && <div className="cabecera-rayas" aria-hidden="true" />}
    </>
  )
}

export default FondoCabecera

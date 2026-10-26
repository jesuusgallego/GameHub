import { EscenaNoticias, EscenaBiblioteca, EscenaSala, EscenaBuscar } from './EscenasCabecera'

// El fondo de las cabeceras grandes de la app (Social, Noticias, Mi biblioteca y Buscar). Todas
// comparten la forma (la tarjeta .banner-perfil, el título, las pastillas de cristal) y el mismo
// tratamiento del fondo, pero cada una tiene su color y una escena ilustrada que cuenta de qué va su apartado
// (ver EscenasCabecera.jsx):
//  - 'sala' (Social): violeta y cian; amigos jugando juntos en el sofá
//  - 'noticias': rojo y ámbar; periódicos y una revista de videojuegos
//  - 'biblioteca': esmeralda y azul; una estantería con tu colección de juegos
//  - 'buscar': fucsia e índigo; portadas en abanico y una lupa de cristal
// Va dentro de un <header className="banner-perfil ...">; el contenido de la cabecera va después,
// por encima (z-index 1). Los colores están en estilos/perfil-cabecera-y-pestanas.css y las escenas
// en estilos/escenas-cabecera.css.
//  - estilo: 'sala', 'noticias', 'biblioteca' o 'buscar'
//  - imagenes: las fotos de la escena (lo que juegan tus amigos, las de las noticias, tus portadas,
//    lo que buscas)
const ESCENAS = { sala: EscenaSala, noticias: EscenaNoticias, biblioteca: EscenaBiblioteca, buscar: EscenaBuscar }

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

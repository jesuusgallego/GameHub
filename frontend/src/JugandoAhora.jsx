import { useIdioma } from './IdiomaContext'
import IconoResena from './IconoResena'
import InsigniaSteam from './InsigniaSteam'
import IconoPlataforma from './IconoPlataforma'
import ImagenSuave from './ImagenSuave'
import { useAnimacionLista } from './useAnimacionLista'
import VentanasJuego from './VentanasJuego'
import { useAccionesJuego } from './useAccionesJuego'
import { useMenuJuego } from './useMenuJuego'
import { esDeSteam } from './steam'

// Una tarjeta ancha de "Jugando ahora".
// Toda la tarjeta es clicable, pero solo hay UN botón de verdad (el del título):
// su ::after (ver estilos/biblioteca.css) se estira por toda la tarjeta. Así no anido botones
// y el teclado y los lectores de pantalla ven un único enlace por juego.
// Igual que en la biblioteca, el clic derecho abre el menú con "Editar" y "Quitar".
function TarjetaJugando({ juego, onVerDetalle, onActualizar, onBorrar }) {
  const { t } = useIdioma()
  const acciones = useAccionesJuego(onBorrar)
  const { abrirMenu, menu } = useMenuJuego(juego, acciones, acciones.borrando)

  return (
    <li className="jugando__tarjeta" data-clave={juego.id} onContextMenu={abrirMenu}>
      {/* La misma portada, agrandada y desenfocada, hace de fondo de la tarjeta */}
      {juego.cover_url && (
        <ImagenSuave className="jugando__fondo" src={juego.cover_url} aria-hidden="true" loading="lazy" />
      )}

      <div className="jugando__portada">
        <button
          type="button"
          className="boton-portada boton-portada--llena"
          onClick={() => onVerDetalle(juego)}
          tabIndex={-1}
          aria-hidden="true"
        >
          {juego.cover_url
            ? <ImagenSuave src={juego.cover_url} loading="lazy" />
            : <span className="portada__vacia">{t('comun.sinPortada')}</span>}
        </button>
        <InsigniaSteam juego={juego} pequena />
      </div>

      <div className="jugando__cuerpo">
        <div className="tarjeta__estado">
          <span className="chip chip--jugando">{t('estado.jugando')}</span>
          {juego.review && <IconoResena />}
        </div>

        <h3 className="jugando__titulo">
          <button type="button" className="enlace-titulo" onClick={() => onVerDetalle(juego)}>
            {juego.name}
          </button>
        </h3>

        <div className="jugando__datos">
          <IconoPlataforma nombre={juego.platform} tamano={18} className="icono-plataforma--fila" ocultarSteam={esDeSteam(juego)} />
          {juego.rating && <span className="contador">★ {juego.rating}/10</span>}
        </div>
      </div>

      <VentanasJuego juego={juego} acciones={acciones} onActualizar={onActualizar} />

      {menu}
    </li>
  )
}

// Fila "Jugando ahora" de Mi biblioteca: una tarjeta ancha por cada juego con
// estado "jugando". Solo enseño lo que guardo en la BD (portada, icono de la
// plataforma, nota y la insignia si viene de Steam); no dibujo horas ni progreso.
// La reseña no se escribe aquí: un icono junto al estado avisa de que existe y se
// lee en la ficha.
//  - juegos: los juegos con estado "jugando"
//  - onVerDetalle(juego): abre la ficha del juego
//  - onActualizar(id, cambios) / onBorrar(id): funciones async del padre (lanzan un
//    Error si el backend falla)
function JugandoAhora({ juegos, onVerDetalle, onActualizar, onBorrar }) {
  const { t } = useIdioma()
  const listaRef = useAnimacionLista()

  return (
    <section aria-labelledby="titulo-jugando">
      <h2 id="titulo-jugando" className="titulo-seccion jugando__encabezado">
        <span className="pulso" aria-hidden="true" />
        {t('jugando.titulo')}
        <span className="contador">{juegos.length}</span>
      </h2>

      <ul className="jugando" ref={listaRef}>
        {juegos.map((juego) => (
          <TarjetaJugando
            key={juego.id}
            juego={juego}
            onVerDetalle={onVerDetalle}
            onActualizar={(cambios) => onActualizar(juego.id, cambios)}
            onBorrar={() => onBorrar(juego.id)}
          />
        ))}
      </ul>
    </section>
  )
}

export default JugandoAhora

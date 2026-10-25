import BotonAnadir from './BotonAnadir'
import ImagenSuave from './ImagenSuave'
import { useIdioma } from './IdiomaContext'

// Tarjeta de un resultado de la búsqueda. El botón de añadir vive en BotonAnadir
// y el padre (la ventana AnadirJuegos) me pasa yaGuardado y onAnadir.
// Toda la tarjeta abre la ficha: el ::after del botón del título se estira por
// ella (ver estilos/tarjetas.css) y el botón de añadir va por encima.
//  - clave: id estable del juego; lo lee useAnimacionLista (data-clave) para deslizar y animar
//    las tarjetas cuando cambian los resultados
function GameCard({ clave, nombre, portada, yaGuardado, onAnadir, onVerDetalle }) {
  const { t } = useIdioma()

  return (
    <li className="tarjeta" data-clave={clave}>
      <div className="portada">
        <button
          type="button"
          className="boton-portada boton-portada--llena"
          onClick={onVerDetalle}
          tabIndex={-1}
          aria-hidden="true"
        >
          {portada
            ? <ImagenSuave src={portada} loading="lazy" />
            : <span className="portada__vacia">{t('comun.sinPortada')}</span>}
        </button>
      </div>

      <div className="tarjeta__cuerpo">
        <h3 className="tarjeta__titulo">
          <button type="button" className="enlace-titulo" onClick={onVerDetalle}>{nombre}</button>
        </h3>

        <BotonAnadir yaGuardado={yaGuardado} onAnadir={onAnadir} />
      </div>
    </li>
  )
}

export default GameCard

import { useState } from 'react'
import { ESTADOS } from './estados'
import { useIdioma } from './IdiomaContext'
import VentanasJuego from './VentanasJuego'
import { useAccionesJuego } from './useAccionesJuego'
import { useMenuJuego } from './useMenuJuego'
import Mensaje from './Mensaje'
import Desplegable from './Desplegable'
import IconoResena from './IconoResena'
import ProgresoSteam from './ProgresoSteam'
import InsigniaSteam from './InsigniaSteam'
import IconoPlataforma from './IconoPlataforma'
import ImagenSuave from './ImagenSuave'
import { esDeSteam } from './steam'

// Tarjeta de un juego que ya está en mi biblioteca. onActualizar y onBorrar son
// funciones async del padre que lanzan un Error si el backend falla.
// El chip de estado es un desplegable: cambiar el estado guarda al momento, sin
// pasar por la ventana de edición.
// "Editar" y "Quitar" no tienen botón en la tarjeta (se veían en todas y repetidos):
// salen con el clic derecho (useMenuJuego) y en la ficha que abre un clic normal.
// Toda la tarjeta es clicable, pero solo hay UN botón de verdad (el del título):
// su ::after (ver estilos/tarjetas.css) se estira por toda la tarjeta. El control de
// dentro (el estado) va por encima con z-index, así no anido botones.

function JuegoGuardado({ juego, onActualizar, onBorrar, onVerDetalle }) {
  const { t } = useIdioma()
  const opcionesEstado = ESTADOS.map((valor) => ({ valor, etiqueta: t(`estado.${valor}`), punto: valor }))
  const [error, setError] = useState("")
  // Editar y quitar (las ventanas y su estado) y el menú del clic derecho que las abre
  const acciones = useAccionesJuego(onBorrar)
  const { abrirMenu, menu } = useMenuJuego(juego, acciones, acciones.borrando)
  const ocupado = acciones.borrando
  // Estado elegido en el chip mientras se guarda (null = no hay cambio en curso).
  // Lo enseño ya en el chip y, si el backend falla, vuelvo al que tenía.
  const [estadoPendiente, setEstadoPendiente] = useState(null)

  async function handleCambiarEstado(status) {
    if (status === juego.status) return
    setEstadoPendiente(status)
    setError("")
    try {
      await onActualizar({ status })
    } catch (err) {
      setError(err.message)
    } finally {
      setEstadoPendiente(null)
    }
  }

  return (
    <li className="tarjeta" data-clave={juego.id} onContextMenu={abrirMenu}>
      <div className="portada">
        {/* La portada no lleva foco propio: el botón del título ya abre la ficha */}
        <button
          type="button"
          className="boton-portada boton-portada--llena"
          onClick={onVerDetalle}
          tabIndex={-1}
          aria-hidden="true"
        >
          {juego.cover_url
            ? <ImagenSuave src={juego.cover_url} loading="lazy" />
            : <span className="portada__vacia">{t('comun.sinPortada')}</span>}
        </button>
        <InsigniaSteam juego={juego} />
        {juego.rating && <span className="nota">★ {juego.rating}</span>}
        <IconoPlataforma nombre={juego.platform} tamano={16} className="icono-plataforma--portada" ocultarSteam={esDeSteam(juego)} />
      </div>

      <div className="tarjeta__cuerpo">
        <h3 className="tarjeta__titulo">
          <button type="button" className="enlace-titulo" onClick={onVerDetalle}>{juego.name}</button>
        </h3>

        <ProgresoSteam juego={juego} />

        <Mensaje texto={error || acciones.error} />

        {/* El estado va siempre abajo del todo, así el chip queda en el mismo sitio
            en todas las tarjetas */}
        <div className="tarjeta__pie">
          <div className="tarjeta__estado">
            <Desplegable
              variante="chip"
              etiqueta={t('juego.estadoDe', { nombre: juego.name })}
              opciones={opcionesEstado}
              valor={estadoPendiente ?? juego.status}
              onChange={handleCambiarEstado}
              disabled={ocupado}
              cargando={estadoPendiente !== null}
            />

            {juego.review && <IconoResena />}
          </div>
        </div>
      </div>

      <VentanasJuego juego={juego} acciones={acciones} onActualizar={onActualizar} />

      {menu}
    </li>
  )
}

export default JuegoGuardado

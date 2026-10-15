import { useState, useEffect, useRef } from 'react'
import { apiFetch } from './api'
import { useIdioma } from './IdiomaContext'
import { nombreGenero, nombreModo } from './terminosIgdb'
import BotonAnadir from './BotonAnadir'
import VisorCapturas from './VisorCapturas'
import Cargando from './Cargando'
import { useVentana } from './useVentana'
import Mensaje from './Mensaje'
import ProgresoSteam from './ProgresoSteam'
import LogrosSteam from './LogrosSteam'
import IconoPlataforma from './IconoPlataforma'
import IconoSteam from './IconoSteam'
import VentanasJuego from './VentanasJuego'
import SeccionAjena from './SeccionAjena'
import { useAccionesJuego } from './useAccionesJuego'

// "2015-05-19" -> "19 de mayo de 2015" (o "19 May 2015", según el idioma). Con
// timeZone UTC evito que, según la zona horaria del usuario, la fecha salga un
// día antes.
function formatearFecha(iso, locale) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Una baldosa de la ficha técnica: la etiqueta pequeña arriba y los valores debajo,
// separados por comas. Si no hay datos no pinto nada, así no quedan baldosas vacías.
//  - ancho: ocupa toda la fila de la rejilla (para listas largas, como las plataformas)
function Dato({ etiqueta, valores, ancho = false }) {
  if (!valores || valores.length === 0) return null

  return (
    <div className={ancho ? "detalle__dato detalle__dato--ancho" : "detalle__dato"}>
      <dt>{etiqueta}</dt>
      <dd>{valores.join(', ')}</dd>
    </div>
  )
}

// Ventana con la ficha de un juego. "juego" trae lo que ya sé sin pedir nada
// (igdb_id, name, cover_url) para enseñarlo al instante mientras llega el resto
// desde GET /games/details/:igdbId.
//  - guardado: la fila del juego en mi biblioteca (o undefined si no lo tengo).
//    Si existe, enseño su estado, nota, plataforma y reseña.
//  - onAnadir: si se pasa, la ficha muestra el botón "Añadir a mi biblioteca"
//    (lo usa la búsqueda y la biblioteca de un amigo; en Mi biblioteca el juego ya está
//    guardado).
//  - ajeno: { usuario, juego, logrosVisibles, resenasVisibles } cuando la ficha se abre desde
//    la biblioteca de otra persona: enseña su partida (estado, nota, horas y logros) y la
//    mía al lado si lo tenemos los dos. Es de solo lectura: no hay Editar ni Quitar.
//  - onActualizar(cambios) / onBorrar(): si se pasan (Mi biblioteca), el recuadro
//    "En mi biblioteca" lleva los botones Editar y Quitar. Son funciones async que
//    lanzan un Error si el backend falla. Al quitar el juego la ficha se cierra.
function DetalleJuego({ juego, guardado, ajeno, onAnadir, onActualizar, onBorrar, onCerrar }) {
  const { t, idioma, locale } = useIdioma()
  const dialogRef = useRef(null)
  // Cierre con animación de salida (ver useVentana.js)
  const { saliendo, cerrar, alCancelar } = useVentana(onCerrar)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  // Índice de la captura que se ve en grande, o null si el visor está cerrado
  const [capturaAbierta, setCapturaAbierta] = useState(null)
  // Editar y quitar el juego desde la ficha. Tras quitarlo ya no hay nada que
  // enseñar: la ficha se cierra con su animación de salida.
  const acciones = useAccionesJuego(async () => {
    await onBorrar()
    cerrar()
  })

  // <dialog> es la ventana modal nativa del navegador: showModal() la abre encima
  // de todo, oscurece el fondo, atrapa el foco y la cierra con Esc, sin librerías.
  // Compruebo "open" para evitar un error si React ejecuta este efecto dos veces
  // (modo estricto en desarrollo).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    let cancelado = false

    // lang: el backend traduce la descripción al idioma de la interfaz (IGDB solo
    // la da en inglés). Si cambio de idioma con la ficha abierta se vuelve a pedir.
    apiFetch(`/games/details/${juego.igdb_id}?lang=${idioma}`)
      .then((data) => {
        if (!cancelado) setDatos(data.game)
      })
      .catch((err) => {
        if (!cancelado) setError(err.message)
      })

    // Si se cierra la ventana antes de que llegue la respuesta, la ignoro
    return () => { cancelado = true }
  }, [juego.igdb_id, idioma])

  // El fondo oscuro (::backdrop) cuenta como parte del <dialog>: un clic ahí tiene
  // como objetivo el propio dialog, no su contenido. Uso mousedown y no click para
  // que seleccionar texto y soltar fuera no cierre la ventana sin querer.
  function cerrarSiEsElFondo(e) {
    if (e.target === e.currentTarget) cerrar()
  }

  const portada = datos?.cover_url ?? juego.cover_url
  const cargando = !datos && !error

  return (
    <dialog
      ref={dialogRef}
      className={saliendo ? "detalle ventana--saliendo" : "detalle"}
      aria-labelledby="detalle-titulo"
      onClose={onCerrar}
      onCancel={alCancelar}
      onMouseDown={cerrarSiEsElFondo}
    >
      <button
        type="button"
        className="btn-icono detalle__cerrar"
        onClick={() => cerrar()}
        aria-label={t('comun.cerrar')}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {/* Cabecera: la propia portada, ampliada y difuminada, hace de fondo */}
      <header className="detalle__hero">
        <div className="detalle__fondo" aria-hidden="true">
          {portada && <img src={portada} alt="" />}
        </div>

        <div className="detalle__portada">
          {portada
            ? <img src={portada} alt="" />
            : <span className="portada__vacia">{t('comun.sinPortada')}</span>}
        </div>

        <div className="detalle__info">
          <h2 id="detalle-titulo" className="detalle__titulo">{juego.name}</h2>

          {datos?.genres.length > 0 && (
            <ul className="detalle__etiquetas" aria-label={t('detalle.generos')}>
              {datos.genres.map((genero) => (
                <li key={genero} className="detalle__etiqueta">{nombreGenero(genero, idioma)}</li>
              ))}
            </ul>
          )}

          {datos?.rating != null && (
            <div className="detalle__nota">
              {/* --nota (0 a 100) es el trozo del aro que se rellena (ver ventanas.css) */}
              <div className="nota-aro" role="img" aria-label={`IGDB ${datos.rating}`} style={{ '--nota': datos.rating }}>
                <span className="nota-aro__valor">{datos.rating}</span>
              </div>
              <div className="detalle__nota-texto">
                <span className="detalle__nota-etiqueta">IGDB</span>
                <span className="estado">{t('detalle.valoraciones', { n: datos.rating_count })}</span>
              </div>
            </div>
          )}

          {onAnadir && (
            <div className="detalle__anadir">
              <BotonAnadir yaGuardado={Boolean(guardado) || Boolean(ajeno?.juego.in_common)} onAnadir={onAnadir} bloque={false} />
            </div>
          )}

          {cargando && <Cargando texto={t('detalle.cargando')} />}

          <Mensaje texto={error} />
        </div>
      </header>

      <div className="detalle__cuerpo">
        {datos && (
          <dl className="detalle__datos">
            <Dato
              etiqueta={t('detalle.lanzamiento')}
              valores={datos.release_date ? [formatearFecha(datos.release_date, locale)] : null}
            />
            <Dato etiqueta={t('detalle.desarrolladora')} valores={datos.developers} />
            <Dato etiqueta={t('detalle.publisher')} valores={datos.publishers} />
            <Dato etiqueta={t('detalle.modos')} valores={datos.game_modes.map((modo) => nombreModo(modo, idioma))} />
            <Dato etiqueta={t('detalle.plataformas')} valores={datos.platforms} ancho />
          </dl>
        )}

        {ajeno && (
          <SeccionAjena
            usuario={ajeno.usuario}
            juego={ajeno.juego}
            logrosVisibles={ajeno.logrosVisibles}
            resenasVisibles={ajeno.resenasVisibles}
          />
        )}

        {guardado && (
          <section className="detalle__biblioteca" aria-labelledby="detalle-mi-biblioteca">
            <div className="detalle__biblioteca-cabecera">
              <h3 id="detalle-mi-biblioteca" className="titulo-seccion">{t('detalle.enBiblioteca')}</h3>

              {onActualizar && onBorrar && (
                <div className="detalle__acciones">
                  <button type="button" className="btn btn--secundario" onClick={acciones.editar} disabled={acciones.borrando}>
                    {t('juego.editar')}
                  </button>
                  <button type="button" className="btn btn--peligro" onClick={acciones.quitar} disabled={acciones.borrando}>
                    {t('juego.quitar')}
                  </button>
                </div>
              )}
            </div>

            <Mensaje texto={acciones.error} />

            <div className="detalle__biblioteca-datos">
              <span className={`chip chip--${guardado.status}`}>
                {t(`estado.${guardado.status}`)}
              </span>
              {guardado.rating && <span className="contador">★ {guardado.rating}/10</span>}
              {guardado.platform && (
                <span className="detalle__plataforma">
                  <IconoPlataforma nombre={guardado.platform} tamano={16} decorativo />
                  {guardado.platform}
                </span>
              )}
            </div>

            {guardado.review
              ? <p className="detalle__texto detalle__resena">{guardado.review}</p>
              : <p className="estado">{t('detalle.sinResena')}</p>}

            {guardado.playtime_minutes !== null && (
              <div className="detalle__steam">
                <h4 className="detalle__subtitulo">
                  <IconoSteam tamano={14} />
                  {t('progreso.titulo')}
                </h4>
                <ProgresoSteam juego={guardado} grande />
                {/* Sin logros (total 0) o sin consultar (null) no hay lista que pedir */}
                {guardado.achievements_total > 0 && <LogrosSteam juego={guardado} />}
              </div>
            )}
          </section>
        )}

        {datos?.summary && (
          <section className="detalle__seccion">
            <h3 className="titulo-seccion">{t('detalle.descripcion')}</h3>
            <p className="detalle__texto">{datos.summary}</p>
            <small className="estado">
              {/* summary_lang es el idioma en que llegó el texto: "en" = el original */}
              {datos.summary_lang === "en"
                ? t('detalle.descripcionOriginal')
                : t('detalle.descripcionTraducida')}
            </small>
          </section>
        )}

        {datos?.screenshots.length > 0 && (
          <section className="detalle__seccion">
            <h3 className="titulo-seccion">{t('detalle.capturas')}</h3>
            <ul className="detalle__capturas">
              {datos.screenshots.map((url, i) => (
                <li key={url}>
                  <button
                    type="button"
                    className="detalle__captura"
                    onClick={() => setCapturaAbierta(i)}
                    aria-label={t('detalle.ampliarCaptura', { n: i + 1 })}
                  >
                    <img src={url} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {datos?.igdb_url && (
          <p className="detalle__pie">
            <a href={datos.igdb_url} target="_blank" rel="noreferrer">{t('detalle.verIgdb')}</a>
          </p>
        )}
      </div>

      {guardado && onActualizar && (
        <VentanasJuego juego={guardado} acciones={acciones} onActualizar={onActualizar} />
      )}

      {capturaAbierta !== null && (
        <VisorCapturas
          urls={datos.screenshots}
          indice={capturaAbierta}
          onCambiar={setCapturaAbierta}
          onCerrar={() => setCapturaAbierta(null)}
        />
      )}
    </dialog>
  )
}

export default DetalleJuego

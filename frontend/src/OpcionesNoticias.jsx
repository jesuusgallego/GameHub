import { useId, useState } from 'react'
import Desplegable from './Desplegable'
import Interruptor from './Interruptor'
import Plegable from './Plegable'
import { useIdioma } from './IdiomaContext'
import { logoPortal } from './logosPortales'
import { ORDENES, PERIODOS, OPCIONES_INICIALES, filtrosActivos, limpiarOpciones } from './logicaNoticias'

// El orden y los filtros de una lista de noticias, encima de ella: "Ordenar" (un desplegable) y un
// botón "Filtros" que despliega debajo la fecha, el portal y, en "Para ti", "Solo de mis juegos".
// Es un componente "tonto": no guarda nada, Noticias.jsx tiene las opciones de cada pestaña.
//  - tipo: 'para_ti' o 'siguiendo' (en "Siguiendo" no hay "Recomendadas" ni "Solo de mis juegos")
//  - opciones: { orden, periodo, portal, misJuegos } (ver logicaNoticias.js)
//  - portales: los que se pueden elegir ([{ slug, name }]); null mientras llegan
//  - onCambiar(opcionesNuevas)
function OpcionesNoticias({ tipo, opciones, portales, onCambiar }) {
  const { t } = useIdioma()
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const o = limpiarOpciones(opciones)
  const activos = filtrosActivos(tipo, o)
  const cambiar = (cambios) => onCambiar({ ...o, ...cambios })

  const ordenes = ORDENES
    .filter((orden) => orden !== 'relevance' || tipo === 'para_ti')
    .map((orden) => ({ valor: orden, etiqueta: t(`noticias.orden.${orden}`) }))
  // En "Siguiendo", "Recomendadas" no existe: se ve (y se pide) por fecha
  const orden = o.orden === 'relevance' && tipo !== 'para_ti' ? 'recent' : o.orden

  const listaPortales = [
    { valor: '', etiqueta: t('noticias.todosPortales') },
    ...(portales ?? []).map((p) => ({
      valor: p.slug,
      etiqueta: p.name,
      icono: logoPortal(p.slug) ? <img className="opciones-noticias__logo" src={logoPortal(p.slug)} alt="" /> : null,
    })),
  ]

  return (
    <div className="opciones-noticias">
      <div className="opciones-noticias__fila">
        <div className="opciones-noticias__orden">
          <span className="opciones-noticias__etiqueta" aria-hidden="true">{t('noticias.ordenar')}</span>
          <div className="opciones-noticias__campo">
            <Desplegable opciones={ordenes} valor={orden} onChange={(v) => cambiar({ orden: v })} etiqueta={t('noticias.ordenar')} />
          </div>
        </div>

        <button
          type="button"
          className={abierto ? 'btn btn--secundario opciones-noticias__boton opciones-noticias__boton--abierto' : 'btn btn--secundario opciones-noticias__boton'}
          aria-expanded={abierto}
          aria-controls={`${id}-filtros`}
          onClick={() => setAbierto((a) => !a)}
        >
          {/* Tres líneas que se acortan: el embudo de "filtrar" */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          {t('noticias.filtros')}
          {activos > 0 && (
            <span className="opciones-noticias__cuenta" aria-label={t('noticias.filtrosActivos', { n: activos })}>{activos}</span>
          )}
        </button>
      </div>

      <Plegable abierto={abierto} hueco="0.25rem">
        <div id={`${id}-filtros`} className="opciones-noticias__panel">
          <div className="opciones-noticias__grupo" role="group" aria-labelledby={`${id}-fecha`}>
            <p id={`${id}-fecha`} className="opciones-noticias__titulo">{t('noticias.fecha')}</p>
            <div className="opciones-noticias__chips">
              {PERIODOS.map((periodo) => (
                <button
                  key={periodo}
                  type="button"
                  className={o.periodo === periodo ? 'opciones-noticias__chip opciones-noticias__chip--activo' : 'opciones-noticias__chip'}
                  aria-pressed={o.periodo === periodo}
                  onClick={() => cambiar({ periodo })}
                >
                  {t(`noticias.periodo.${periodo}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="opciones-noticias__grupo">
            <p className="opciones-noticias__titulo" aria-hidden="true">{t('noticias.portal')}</p>
            <Desplegable
              opciones={listaPortales}
              valor={o.portal}
              onChange={(v) => cambiar({ portal: v })}
              cargando={!portales}
              etiqueta={t('noticias.portal')}
            />
          </div>

          {tipo === 'para_ti' && (
            <div className="opciones-noticias__grupo opciones-noticias__grupo--interruptor">
              <span className="opciones-noticias__texto">
                <strong>{t('noticias.soloMisJuegos')}</strong>
                <small>{t('noticias.soloMisJuegosAyuda')}</small>
              </span>
              <Interruptor activado={o.misJuegos} onChange={(v) => cambiar({ misJuegos: v })} etiqueta={t('noticias.soloMisJuegos')} />
            </div>
          )}

          <button
            type="button"
            className="opciones-noticias__limpiar"
            disabled={activos === 0}
            onClick={() => onCambiar({ ...OPCIONES_INICIALES, orden: o.orden })}
          >
            {t('noticias.quitarFiltros')}
          </button>
        </div>
      </Plegable>
    </div>
  )
}

export default OpcionesNoticias

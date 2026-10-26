import { useId, useState } from 'react'
import { useIdioma } from './IdiomaContext'
import Desplegable from './Desplegable'
import IconoPlataforma from './IconoPlataforma'
import Plegable from './Plegable'
import { ESTADOS } from './estados'
import { CRITERIOS, TODOS } from './ordenFiltros'

// Los filtros de Mi biblioteca en el móvil, en poco espacio para que los juegos se vean nada más
// entrar (en el ordenador están en la barra lateral, FiltrosBiblioteca.jsx):
//  - una fila con el buscador y un botón redondo de filtros (con cuántos hay puestos);
//  - ese botón despliega debajo el orden y los desplegables de género, compañía y plataforma;
//  - debajo, el estado en pastillas que se deslizan de lado, como los filtros de las apps de iOS.
// En el iPhone y en la app instalada de Android, todo es de cristal (estilos/cristal.css).
// Es un componente "tonto": no guarda los filtros, solo si el panel está abierto. Biblioteca.jsx
// tiene los filtros, la búsqueda y el orden, igual que con la barra lateral.
//  - juegos: TODA la biblioteca (los contadores son del total, no de lo visible)
//  - filtros: { estado, genero, compania, plataforma }; cada uno vale TODOS o un valor
//  - opciones: { genero, compania, plataforma } con [{ valor, etiqueta, cuenta }] (ordenFiltros.js)
//  - onCambiar(clave, valor), onLimpiar() y hayFiltros (habilita "Limpiar filtros")
//  - consulta / onConsulta(texto): lo escrito en el buscador
//  - criterio, direccion, onCambiarCriterio(id) y onDireccion('asc' | 'desc'): el orden
function FiltrosBibliotecaMovil({
  juegos, filtros, opciones, onCambiar, onLimpiar, hayFiltros,
  consulta, onConsulta, criterio, direccion, onCambiarCriterio, onDireccion,
}) {
  const { t } = useIdioma()
  const id = useId()
  const [abierto, setAbierto] = useState(false)

  const estados = [
    { id: TODOS, etiqueta: t('biblioteca.todos'), cuenta: juegos.length },
    ...ESTADOS.map((estado) => ({
      id: estado,
      etiqueta: t(`estado.${estado}`),
      cuenta: juegos.filter((j) => j.status === estado).length,
    })),
  ]

  const desplegables = [
    { clave: 'genero', titulo: t('biblioteca.genero'), todos: t('biblioteca.todos') },
    { clave: 'compania', titulo: t('biblioteca.compania'), todos: t('biblioteca.todas') },
    { clave: 'plataforma', titulo: t('biblioteca.plataforma'), todos: t('biblioteca.todas'), conIcono: true },
  ].filter(({ clave }) => opciones[clave].length > 0)

  // El número del botón: los filtros del panel que están puestos. El estado y la búsqueda no
  // cuentan porque ya se ven fuera (la pastilla elegida y el texto escrito).
  const puestos = ['genero', 'compania', 'plataforma'].filter((clave) => filtros[clave] !== TODOS).length

  const criterios = CRITERIOS.map((c) => ({ valor: c.id, etiqueta: t(`orden.${c.id}`) }))
  const tipo = CRITERIOS.find((c) => c.id === criterio).tipo

  // Al elegir una pastilla que se veía a medias, se desliza la fila hasta verla entera
  function elegirEstado(estado, boton) {
    onCambiar('estado', estado)
    boton.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }

  return (
    <div className="filtros-movil">
      <div className="filtros-movil__fila">
        <div className="caja-busqueda filtros-movil__busqueda">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={consulta}
            onChange={(e) => onConsulta(e.target.value)}
            placeholder={t('biblioteca.buscarMovil')}
            aria-label={t('biblioteca.filtrarJuegos')}
            enterKeyHint="search"
          />
        </div>

        <button
          type="button"
          className={abierto ? 'filtros-movil__boton filtros-movil__boton--abierto' : 'filtros-movil__boton'}
          aria-expanded={abierto}
          aria-controls={`${id}-panel`}
          aria-label={t('biblioteca.filtrosYOrden')}
          onClick={() => setAbierto((a) => !a)}
        >
          {/* Dos reguladores (los de "ajustes" de iOS): las bolitas se cruzan al abrir el panel */}
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 8h16M4 16h16" />
            <circle className="filtros-movil__bolita filtros-movil__bolita--1" cx="9" cy="8" r="2.4" />
            <circle className="filtros-movil__bolita filtros-movil__bolita--2" cx="15" cy="16" r="2.4" />
          </svg>
          {puestos > 0 && (
            <span className="filtros-movil__cuenta" aria-label={t('biblioteca.filtrosActivos', { n: puestos })}>{puestos}</span>
          )}
        </button>
      </div>

      <Plegable abierto={abierto} hueco="0">
        <div id={`${id}-panel`} className="filtros-movil__panel">
          <div className="filtros-movil__grupo">
            <p className="filtros-movil__titulo" aria-hidden="true">{t('orden.ordenarPor')}</p>
            <Desplegable opciones={criterios} valor={criterio} onChange={onCambiarCriterio} etiqueta={t('orden.ordenarPor')} />

            {/* El sentido, en dos mitades (como un control segmentado de iOS). La "lente" se desliza
                a la mitad elegida (--lado, en el CSS). */}
            <div
              className="filtros-movil__sentido"
              role="group"
              aria-label={t('orden.invertir')}
              style={{ '--lado': direccion === 'asc' ? 0 : 1 }}
            >
              <span className="filtros-movil__sentido-lente" aria-hidden="true" />
              {['asc', 'desc'].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={direccion === d ? 'filtros-movil__sentido-opcion filtros-movil__sentido-opcion--activa' : 'filtros-movil__sentido-opcion'}
                  aria-pressed={direccion === d}
                  onClick={() => onDireccion(d)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={d === 'asc' ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} />
                  </svg>
                  {t(`orden.${tipo}.${d}`)}
                </button>
              ))}
            </div>
          </div>

          {desplegables.map(({ clave, titulo, todos, conIcono }) => (
            <div key={clave} className="filtros-movil__grupo">
              <p className="filtros-movil__titulo" aria-hidden="true">{titulo}</p>
              <Desplegable
                opciones={[
                  { valor: TODOS, etiqueta: todos },
                  ...opciones[clave].map((o) => ({
                    valor: o.valor,
                    etiqueta: `${o.etiqueta} (${o.cuenta})`,
                    icono: conIcono ? <IconoPlataforma nombre={o.valor} tamano={16} decorativo /> : undefined,
                  })),
                ]}
                valor={filtros[clave]}
                onChange={(valor) => onCambiar(clave, valor)}
                etiqueta={titulo}
              />
            </div>
          ))}

          <button type="button" className="filtros-movil__limpiar" onClick={onLimpiar} disabled={!hayFiltros}>
            {t('biblioteca.limpiarFiltros')}
          </button>
        </div>
      </Plegable>

      <div className="filtros-movil__estados" role="group" aria-label={t('biblioteca.estado')}>
        {estados.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`filtros-movil__estado filtros-movil__estado--${e.id}${filtros.estado === e.id ? ' filtros-movil__estado--activo' : ''}`}
            aria-pressed={filtros.estado === e.id}
            onClick={(ev) => elegirEstado(e.id, ev.currentTarget)}
          >
            {e.id !== TODOS && <span className={`punto punto--${e.id}`} aria-hidden="true" />}
            {e.etiqueta}
            <span className="filtros-movil__estado-cuenta">{e.cuenta}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FiltrosBibliotecaMovil

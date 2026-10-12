import { useIdioma } from './IdiomaContext'
import Desplegable from './Desplegable'
import IconoPlataforma from './IconoPlataforma'
import { ESTADOS } from './estados'
import { TODOS } from './ordenFiltros'

// Barra lateral de Mi biblioteca: el estado en botones con su contador y, debajo,
// género, compañía y plataforma en desplegables. Tampoco guarda nada: recibe los
// filtros elegidos y avisa de los cambios.
//  - juegos: TODA la biblioteca (los contadores son del total, no de lo visible)
//  - filtros: { estado, genero, compania, plataforma }; cada uno vale TODOS o un valor
//  - opciones: { genero, compania, plataforma } con [{ valor, etiqueta, cuenta }] (ordenFiltros.js)
//  - onCambiar(clave, valor) y onLimpiar()
//  - hayFiltros: si hay alguno activo (habilita "Limpiar filtros")
function FiltrosBiblioteca({ juegos, filtros, opciones, onCambiar, onLimpiar, hayFiltros }) {
  const { t } = useIdioma()

  // Un botón por estado con su contador. Ojo: "todos" no existe como estado en la BD.
  const estados = [
    { id: TODOS, etiqueta: t('biblioteca.todos'), cuenta: juegos.length },
    ...ESTADOS.map((id) => ({
      id,
      etiqueta: t(`estado.${id}`),
      cuenta: juegos.filter((j) => j.status === id).length,
    })),
  ]

  // Cada desplegable: su título, el texto de "sin filtrar" y cómo se pinta cada valor
  const desplegables = [
    { clave: 'genero', titulo: t('biblioteca.genero'), todos: t('biblioteca.todos') },
    { clave: 'compania', titulo: t('biblioteca.compania'), todos: t('biblioteca.todas') },
    { clave: 'plataforma', titulo: t('biblioteca.plataforma'), todos: t('biblioteca.todas'), conIcono: true },
  ]

  return (
    <aside className="filtros" aria-label={t('biblioteca.filtros')}>
      <p className="filtros__titulo">{t('biblioteca.estado')}</p>
      {estados.map((f) => (
        <button
          key={f.id}
          type="button"
          className={filtros.estado === f.id ? "filtro filtro--activo" : "filtro"}
          aria-pressed={filtros.estado === f.id}
          onClick={() => onCambiar('estado', f.id)}
        >
          <span className="filtro__nombre">
            {f.id !== TODOS && <span className={`punto punto--${f.id}`} aria-hidden="true" />}
            {f.etiqueta}
          </span>
          <span className="filtro__cuenta">{f.cuenta}</span>
        </button>
      ))}

      {desplegables.map(({ clave, titulo, todos, conIcono }) => {
        // Si en la biblioteca no hay ningún valor (ningún juego tiene género aún,
        // por ejemplo) el desplegable no aporta nada
        if (opciones[clave].length === 0) return null

        const lista = [
          { valor: TODOS, etiqueta: todos },
          ...opciones[clave].map((o) => ({
            valor: o.valor,
            etiqueta: `${o.etiqueta} (${o.cuenta})`,
            icono: conIcono ? <IconoPlataforma nombre={o.valor} tamano={16} decorativo /> : undefined,
          })),
        ]

        return (
          <div key={clave} className="filtros__grupo">
            <p className="filtros__titulo filtros__titulo--grupo">{titulo}</p>
            <Desplegable
              opciones={lista}
              valor={filtros[clave]}
              onChange={(valor) => onCambiar(clave, valor)}
              etiqueta={titulo}
            />
          </div>
        )
      })}

      <div className="filtros__grupo">
        <button
          type="button"
          className="btn btn--secundario btn--block"
          onClick={onLimpiar}
          disabled={!hayFiltros}
        >
          {t('biblioteca.limpiarFiltros')}
        </button>
      </div>
    </aside>
  )
}

export default FiltrosBiblioteca

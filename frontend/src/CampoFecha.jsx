import { useIdioma } from './IdiomaContext'

// Campo de fecha. Por dentro es el <input type="date"> de siempre (en el iPhone abre la rueda de
// fechas de iOS), con dos añadidos que solo se ven en iOS (ver .campo-fecha en formularios.css):
// el icono del calendario y un texto de ejemplo mientras está vacío. Safari no pinta nada en un
// campo de fecha vacío, ni respeta su alto ni su ancho, así que parecía una caja rota.
// Recibe lo mismo que un <input> (value, onChange, min, max, required, ref...).
function CampoFecha({ value, className, ...resto }) {
  const { t } = useIdioma()
  return (
    <span className={value ? 'campo-fecha' : 'campo-fecha campo-fecha--vacio'}>
      <input type="date" value={value} className={className} {...resto} />
      {/* aria-hidden: el lector de pantalla ya anuncia el campo con su etiqueta */}
      <span className="campo-fecha__vacio" aria-hidden="true">{t('campoFecha.vacio')}</span>
      <svg className="campo-fecha__icono" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    </span>
  )
}

export default CampoFecha

// "hace 2 horas" / "2 hours ago": cuánto hace de una fecha, en el idioma de la interfaz.
// Intl.RelativeTimeFormat lo escribe bien en cada idioma (singular, plural, "ayer"...).
//  - fecha: una fecha ISO o un Date
//  - ahora: solo para las pruebas
const TRAMOS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function tiempoRelativo(fecha, idioma, ahora = Date.now()) {
  const segundos = Math.round((new Date(fecha).getTime() - ahora) / 1000)
  // numeric: 'auto' da "ayer" y "ahora" en lugar de "hace 1 día" y "hace 0 segundos"
  const formato = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto' })

  for (const [unidad, tamano] of TRAMOS) {
    if (Math.abs(segundos) >= tamano) return formato.format(Math.round(segundos / tamano), unidad)
  }

  return formato.format(0, 'second')
}

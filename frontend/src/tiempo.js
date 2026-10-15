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

// En qué tramo de la línea del tiempo cae una fecha, para agrupar la actividad: 'hoy',
// 'ayer', 'semana' (los 7 días anteriores a ayer), 'mes' (los 30 siguientes) o 'antes'.
// Cuenta días de calendario (medianoche a medianoche en la zona del navegador), no
// períodos de 24 horas: algo de las 23:50 de ayer es "ayer" aunque haga 20 minutos.
//  - ahora: solo para las pruebas
export function tramoDia(fecha, ahora = Date.now()) {
  const inicioDia = (ms) => {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const dias = Math.round((inicioDia(ahora) - inicioDia(new Date(fecha).getTime())) / 86_400_000)

  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias <= 8) return 'semana'
  if (dias <= 38) return 'mes'
  return 'antes'
}

// "Cara a cara": las filas que comparan mi biblioteca con la de otra persona. Cada fila trae
// los dos valores y qué lado gana (o 'empate'), para que la pantalla pinte las barras.
//  - mias, suyas: lo que devuelve GET /profile/stats (stats) o el `stats` del perfil público:
//    { total, completado, nota_media, ... }. nota_media es null si no ha valorado nada.
// Devuelve [{ id, mio, suyo, maximo, gana }]; `maximo` es la escala de la barra (la mayor de
// las dos cifras, o 10 en la nota). Si falta alguno de los dos, no hay comparación (null).
export function compararBibliotecas(mias, suyas) {
  if (!mias || !suyas) return null

  const fila = (id, mio, suyo, maximo) => ({
    id,
    mio,
    suyo,
    maximo: maximo ?? Math.max(mio ?? 0, suyo ?? 0, 1),
    gana: mio == null || suyo == null || mio === suyo ? 'empate' : (mio > suyo ? 'mio' : 'suyo'),
  })

  return [
    fila('juegos', mias.total, suyas.total),
    fila('completados', mias.completado, suyas.completado),
    fila('nota', mias.nota_media, suyas.nota_media, 10),
  ]
}

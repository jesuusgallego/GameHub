// Un color propio para cada persona: un "tono" (0 a 359, la posición en el círculo
// cromático) que sale de su nombre de usuario. Es siempre el mismo para el mismo nombre, en
// cualquier pantalla y para cualquiera que lo mire, sin guardar nada. Lo usa la parte social
// (anillo de la foto, banda de la tarjeta, avatar sin foto) para que cada persona se
// reconozca de un vistazo y la página no sea toda del mismo azul.
//
// Es un FNV-1a (una función de mezcla muy simple): cambiar una letra cambia el tono entero.
export function tonoDe(nombre) {
  let h = 2166136261
  for (const c of String(nombre ?? '')) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 360
}

// Para ponerlo en el style de un elemento: <li style={estiloTono(username)}>.
// El CSS lo lee con hsl(var(--tono) ...).
export function estiloTono(nombre) {
  return { '--tono': tonoDe(nombre) }
}

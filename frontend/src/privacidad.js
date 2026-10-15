// Las reglas de privacidad del perfil en el cliente. Son las mismas que aplica el servidor
// (backend/src/services/privacidad.js): el servidor es el que manda y NO envía lo que no se
// puede ver; esto sirve para enseñarle a cada persona, en su pantalla de Privacidad, qué
// verá cada tipo de visitante con lo que ha elegido. Una prueba comprueba que coinciden.

// Quién puede ver una parte del perfil, según la relación con su dueño:
//  - nivel: 'nadie' (solo el dueño), 'amigos' o 'todos'
//  - relacion: 'self', 'amigos' o cualquier otra (un desconocido)
export function puedeVer(nivel, relacion) {
  if (relacion === 'self') return true
  if (nivel === 'todos') return true
  if (nivel === 'amigos') return relacion === 'amigos'
  return false
}

// Los datos que se pueden configurar, en el orden en que se enseñan, agrupados.
// `campo` es la columna de users (y el nombre en la API). El texto de cada uno está en
// los diccionarios como privacidad.campo.<campo>.
export const GRUPOS_PRIVACIDAD = [
  {
    id: 'personales',
    campos: ['visibility_name', 'visibility_age', 'visibility_gender', 'visibility_location'],
  },
  {
    id: 'biblioteca',
    campos: ['visibility_library', 'visibility_reviews', 'visibility_friends'],
  },
]

// Los valores con los que empieza cada persona (los mismos que schema.sql)
export const PRIVACIDAD_POR_DEFECTO = {
  visibility_name: 'nadie',
  visibility_age: 'nadie',
  visibility_gender: 'nadie',
  visibility_location: 'nadie',
  visibility_library: 'amigos',
  visibility_reviews: 'amigos',
  visibility_friends: 'amigos',
}

export const POLITICAS_SOLICITUD = ['todos', 'amigos_de_amigos', 'nadie']

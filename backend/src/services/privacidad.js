// Reglas de qué puede ver una persona del perfil de otra. Un único sitio, sin base de
// datos, para poder probarlas con todas las combinaciones: es lo que decide qué datos
// salen de la API, así que un fallo aquí sería una fuga de privacidad.

// Cómo es la relación de `yo` con la persona cuyo perfil miro:
//  - 'self': soy yo mismo
//  - 'amigos': hay una amistad aceptada
//  - 'enviada': le envié una solicitud y no la ha respondido
//  - 'recibida': me envió una solicitud y no la he respondido
//  - 'ninguna': nada
// (El bloqueo no es una relación de amistad: lo decide el controlador aparte.)
// `amistad` es la fila de friendships entre los dos ({ status, requester_id }) o null.
function relacionEntre({ esYo, amistad, yo }) {
  if (esYo) return 'self';
  if (!amistad) return 'ninguna';
  if (amistad.status === 'aceptada') return 'amigos';
  return amistad.requester_id === yo ? 'enviada' : 'recibida';
}

// Niveles de visibilidad que elige cada persona para sus datos:
//  - 'nadie': solo ella
//  - 'amigos': ella y sus amigos
//  - 'todos': cualquiera con sesión iniciada (que no la tenga bloqueada)
// Cualquier valor que no conozco cuenta como 'nadie': ante la duda, no enseñar.
function puedeVer(nivel, relacion) {
  if (relacion === 'self') return true;
  if (nivel === 'todos') return true;
  if (nivel === 'amigos') return relacion === 'amigos';
  return false;
}

// Los datos personales de una persona que `relacion` puede ver: cada uno con su propio nivel
// (nombre y apellidos, edad, sexo, y localización con país). Los que no se ven no salen en
// el objeto: ni como null, para que ni se sepa que están rellenos.
//  - u: { first_name, last_name, age, gender, location, country, visibility_name, ... }
function datosPersonalesVisibles(u, relacion) {
  const datos = {};

  if (puedeVer(u.visibility_name, relacion)) {
    datos.first_name = u.first_name;
    datos.last_name = u.last_name;
  }
  if (puedeVer(u.visibility_age, relacion)) datos.age = u.age;
  if (puedeVer(u.visibility_gender, relacion)) datos.gender = u.gender;
  if (puedeVer(u.visibility_location, relacion)) {
    datos.location = u.location;
    datos.country = u.country;
  }

  return datos;
}

module.exports = { relacionEntre, puedeVer, datosPersonalesVisibles };

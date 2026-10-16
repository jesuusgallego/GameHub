// Textos y reglas de los avisos de actualización. Es lógica pura, sin Electron, para
// poder probarla con "npm test" (main.js solo la usa y enseña los diálogos).
//
// Hay dos avisos:
//  1. "Hay una versión nueva ya descargada, ¿reiniciar?" (la app que está abierta).
//  2. "GameHub se ha actualizado a la versión X" con las novedades, la primera vez
//     que se abre una versión nueva. Este es el único que puede enseñar la 1.1.0 al
//     actualizarse desde la 1.0.0, porque la 1.0.0 ya instalada no tiene el aviso 1:
//     quien aplica esa actualización es el código viejo.

// Qué hay de nuevo en cada versión. AL PUBLICAR UNA VERSIÓN, añade aquí su entrada
// (si falta, el aviso sale igualmente, solo sin la lista de novedades).
const NOVEDADES = {
  '1.4.0': {
    es: [
      'Chat entre amigos: un botón abajo a la derecha abre el chat en cualquier página.',
      'Ves cuándo han leído tu mensaje y puedes eliminar los tuyos.',
      'Social, Mi biblioteca y Buscar, más fluidos: las tarjetas se deslizan al filtrar y ya no hay saltos.',
      'Mi biblioteca se ve al instante al volver a ella.',
    ],
    en: [
      'Friends chat: a button at the bottom right opens the chat on any page.',
      'See when your message has been read, and delete your own messages.',
      'Smoother Social, My library and Search: cards slide when you filter and nothing jumps around.',
      'My library shows up instantly when you come back to it.',
    ],
  },
  '1.3.0': {
    es: [
      'Social rediseñado: tu sala con lo que juegan tus amigos, sus carnets y las solicitudes a mano.',
      'En el perfil de un amigo ves los juegos y los amigos que tenéis en común, y un cara a cara.',
      'Abre uno de sus juegos para ver su partida y los logros que ha conseguido.',
      'Nuevo ajuste de privacidad: elige quién ve tus horas y tus logros.',
      'Las solicitudes de amistad llegan solas, sin recargar.',
    ],
    en: [
      'Redesigned Social: your lobby with what your friends are playing, their cards and your requests at hand.',
      'On a friend\'s profile you see the games and friends you have in common, and a head to head.',
      'Open one of their games to see their progress and the achievements they have earned.',
      'New privacy setting: choose who sees your hours and achievements.',
      'Friend requests show up on their own, without reloading.',
    ],
  },
  '1.2.0': {
    es: [
      'Social: mira a qué juegan tus amigos, añade gente y descubre personas que quizá conozcas.',
      'Perfiles de otras personas, con su biblioteca y los juegos que tenéis en común.',
      'Privacidad dato a dato: tú decides qué ve cada persona de ti.',
      'Inicia sesión con tu email o con tu nombre de usuario (ahora en minúsculas).',
      'Datos personales opcionales: nombre, edad, sexo, localización, país y teléfono.',
    ],
    en: [
      'Social: see what your friends are playing, add people and discover people you may know.',
      'Other people\'s profiles, with their library and the games you have in common.',
      'Privacy detail by detail: you decide what each person sees about you.',
      'Log in with your email or your username (now in lowercase).',
      'Optional personal details: name, age, sex, location, country and phone.',
    ],
  },
  '1.1.0': {
    es: [
      'Recuperación de contraseña: si la olvidas, te enviamos un código por correo.',
      'Al cambiar o recuperar la contraseña se cierran tus otras sesiones abiertas.',
      'Géneros y modos de juego en español.',
      'El email se cambia desde un botón, confirmando con tu contraseña.',
    ],
    en: [
      'Password recovery: if you forget it, we send you a code by email.',
      'Changing or recovering your password closes your other open sessions.',
      'Genres and game modes in Spanish.',
      'The email is changed from a button, confirming with your password.',
    ],
  },
}

const TEXTOS = {
  es: {
    reiniciar: 'Reiniciar ahora',
    masTarde: 'Más tarde',
    descargada: (v) => `Hay una versión nueva de GameHub (${v}) lista para instalar.`,
    detalleDescargada: 'Ya está descargada. Si eliges "Más tarde", se instalará sola al cerrar GameHub.',
    actualizada: (v) => `GameHub se ha actualizado a la versión ${v}.`,
    novedades: 'Novedades:',
    entendido: 'Entendido',
  },
  en: {
    reiniciar: 'Restart now',
    masTarde: 'Later',
    descargada: (v) => `A new version of GameHub (${v}) is ready to install.`,
    detalleDescargada: 'It is already downloaded. If you choose "Later", it will install by itself when you close GameHub.',
    actualizada: (v) => `GameHub has been updated to version ${v}.`,
    novedades: "What's new:",
    entendido: 'Got it',
  },
}

// El idioma del sistema ("es-ES", "en-US"...): español si empieza por "es", si no inglés
function idiomaDe(locale) {
  return String(locale ?? '').toLowerCase().startsWith('es') ? 'es' : 'en'
}

function textos(locale) {
  return TEXTOS[idiomaDe(locale)]
}

// Las novedades de una versión en ese idioma ([] si no hay entrada)
function novedades(version, locale) {
  return NOVEDADES[version]?.[idiomaDe(locale)] ?? []
}

// ¿Hay que enseñar "se ha actualizado"? Devuelve null (no) o { anterior } (sí).
//  - versionGuardada: la que había la última vez que se abrió la app (null = no se guardó
//    ninguna: la 1.0.0 todavía no la guardaba)
//  - versionActual: la que se está ejecutando ahora
//  - hayEstadoPrevio: si ya existía el archivo de la ventana, que la app crea al cerrarse
//    por primera vez. Solo sirve para distinguir, cuando no hay versión guardada, una
//    app que ya se usó (viene de la 1.0.0) de una instalación nueva, que no se ha
//    actualizado de nada y no debe enseñar nada.
function avisoTrasActualizar({ versionGuardada, versionActual, hayEstadoPrevio }) {
  if (versionGuardada === versionActual) return null
  if (versionGuardada) return { anterior: versionGuardada }
  return hayEstadoPrevio ? { anterior: null } : null
}

module.exports = { NOVEDADES, textos, novedades, avisoTrasActualizar }

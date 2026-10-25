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
  '1.8.7': {
    es: [
      'Las noticias de «Para ti» salen ahora de la más nueva a la más antigua.',
      'Nuevo: ordena y filtra las noticias por fecha, por portal o solo las de tus juegos.',
    ],
    en: [
      'The "For you" news now go from newest to oldest.',
      'New: sort and filter the news by date, by site or only those about your games.',
    ],
  },
  '1.8.6': {
    es: [
      'Las pestañas de Noticias, Social y Perfil se mueven ahora con la misma animación fluida que la barra de abajo del iPhone.',
      'En el móvil, las secciones del perfil caben en una cápsula, como las de Noticias y Social.',
    ],
    en: [
      'The News, Social and Profile tabs now move with the same smooth animation as the iPhone bottom bar.',
      'On mobile, the profile sections fit in a capsule, like the News and Social ones.',
    ],
  },
  '1.8.5': {
    es: [
      'En el iPhone, la pestaña elegida de la barra de abajo se mueve ahora de forma fluida al arrastrar el dedo, como en Instagram.',
    ],
    en: [
      'On iPhone, the selected tab in the bottom bar now moves smoothly when you slide your finger, like on Instagram.',
    ],
  },
  '1.8.4': {
    es: [
      'En el iPhone puedes cambiar de sección arrastrando el dedo por la barra de abajo, como en Instagram.',
      'En el iPhone, el botón del chat también lo cierra, y la foto de perfil de arriba ya sale centrada.',
    ],
    en: [
      'On iPhone you can switch sections by sliding your finger along the bottom bar, like on Instagram.',
      'On iPhone, the chat button also closes it, and the profile picture at the top is now centred.',
    ],
  },
  '1.8.3': {
    es: [
      'En el iPhone, el logo y los menús de arriba ya no se ven cortados.',
      'La pestaña elegida de la barra de abajo del iPhone ya no se sale de su sitio.',
    ],
    en: [
      'On iPhone, the logo and menus at the top are no longer cut off.',
      'The selected tab in the iPhone bottom bar no longer slips out of place.',
    ],
  },
  '1.8.2': {
    es: [
      'En el iPhone, el aspecto «Liquid Glass» se parece ahora al de WhatsApp: los botones flotan en cápsulas de cristal sobre el contenido.',
      'Arreglado el borroso de la parte de arriba en el iPhone con iOS 27.',
    ],
    en: [
      'On iPhone, the "Liquid Glass" look now resembles WhatsApp: buttons float in glass capsules over the content.',
      'Fixed the blurry top on iPhone with iOS 27.',
    ],
  },
  '1.8.1': {
    es: [
      'En el iPhone, GameHub estrena el aspecto «Liquid Glass» de iOS 26 y las pestañas pasan abajo, como en una app de iOS.',
      'Arreglos para el móvil: la parte de arriba ya no se ve borrosa, la fecha de nacimiento se ve bien y las pestañas de Noticias ya no se esconden tras la barra.',
    ],
    en: [
      'On iPhone, GameHub gets the iOS 26 "Liquid Glass" look and the tabs move to the bottom, like an iOS app.',
      'Mobile fixes: the top no longer looks blurry, the date of birth field looks right and the News tabs no longer hide behind the bar.',
    ],
  },
  '1.8.0': {
    es: [
      'GameHub ya funciona en el iPhone: abre jesuusgallego.github.io/GameHub en Safari y añádela a la pantalla de inicio.',
      'Entras con tu misma cuenta: tu biblioteca, tus noticias y tus amigos, también en el móvil.',
    ],
    en: [
      'GameHub now works on iPhone: open jesuusgallego.github.io/GameHub in Safari and add it to your Home Screen.',
      'Sign in with the same account: your library, your news and your friends, on your phone too.',
    ],
  },
  '1.7.0': {
    es: [
      'La barra de arriba es ahora de iconos, en el centro: pasa el ratón para ver su nombre.',
      'Añade juegos sin salir de Mi biblioteca, con el botón "+ Añadir juegos".',
      'Noticias, Mi biblioteca y Social estrenan cabecera, cada una con su propio dibujo y color.',
      'Noticias más limpia, y cada portal con su logo.',
    ],
    en: [
      'The top bar now has icons, in the middle: hover over one to see its name.',
      'Add games without leaving My library, with the "+ Add games" button.',
      'News, My library and Social get new headers, each with its own picture and colour.',
      'A cleaner News page, with each site\'s logo.',
    ],
  },
  '1.6.0': {
    es: [
      'Noticias es ahora lo primero que ves: lo último de 24 portales de videojuegos.',
      'Para ti: las noticias de los juegos de tu biblioteca, con el motivo de cada una.',
      'Siguiendo: lo último de los portales que elijas, por orden de fecha.',
      'Pulsa uno de tus juegos en "Se habla de tus juegos" para ver solo sus noticias.',
      'Lo que no te interese, fuera con "No me interesa" (y con Deshacer por si acaso).',
    ],
    en: [
      'News is now the first thing you see: the latest from 24 video game sites.',
      'For you: news about the games in your library, with the reason for each one.',
      'Following: the latest from the sites you choose, newest first.',
      'Tap one of your games in "Your games in the news" to see only its stories.',
      'Hide what you don\'t care about with "Not interested" (with Undo just in case).',
    ],
  },
  '1.5.0': {
    es: [
      'Chats de grupo de hasta 10 personas: crea uno desde "Nuevo mensaje".',
      'Ves cuándo tu amigo te está escribiendo.',
      'Vacía una conversación solo para ti desde el menú ⋯.',
      'Avisos de Windows cuando te escriben y GameHub está en segundo plano (actívalos en el chat o en Ajustes).',
      'Para usar GameHub hay que tener al menos 14 años: si tu cuenta es de antes, te pediremos tu fecha de nacimiento una vez.',
    ],
    en: [
      'Group chats of up to 10 people: create one from "New message".',
      'See when your friend is typing.',
      'Clear a conversation just for you from the ⋯ menu.',
      'Windows notifications when someone writes and GameHub is in the background (turn them on in the chat or in Settings).',
      'You must be at least 14 to use GameHub: if your account is older, we will ask for your date of birth once.',
    ],
  },
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

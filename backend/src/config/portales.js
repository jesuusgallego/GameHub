// Catálogo de portales de noticias. Se copia a la tabla news_sources al arrancar el servidor
// (ver services/noticias.js: sincronizarPortales): para añadir uno, se añade aquí; para quitarlo,
// se borra de aquí y queda desactivado (sus noticias y quién lo seguía no se pierden).
//  - slug: identificador fijo (va en las URL de la API y en la base de datos). No se cambia.
//  - lang: idioma del portal ('es' o 'en')
//  - tono: el color del portal (0-359 en el círculo cromático, como el de las personas en
//    tono.js), para su etiqueta y para la portada de las noticias que no traen imagen
// Todas las direcciones se comprobaron a mano el 2026-10-24 (ver docs/DESARROLLO.md, Noticias).
// MeriStation no está: su RSS daba 404.
const PORTALES = [
  // En español
  { slug: 'vandal', name: 'Vandal', site: 'https://vandal.elespanol.com', feed: 'https://vandal.elespanol.com/xml.cgi', lang: 'es', tono: 8 },
  { slug: '3djuegos', name: '3DJuegos', site: 'https://www.3djuegos.com', feed: 'https://www.3djuegos.com/feedburner.xml', lang: 'es', tono: 25 },
  { slug: 'hobbyconsolas', name: 'HobbyConsolas', site: 'https://www.hobbyconsolas.com', feed: 'https://www.hobbyconsolas.com/rss/', lang: 'es', tono: 205 },
  { slug: 'eurogamer-es', name: 'Eurogamer.es', site: 'https://www.eurogamer.es', feed: 'https://www.eurogamer.es/feed', lang: 'es', tono: 222 },
  { slug: 'ign-es', name: 'IGN España', site: 'https://es.ign.com', feed: 'https://es.ign.com/feed.xml', lang: 'es', tono: 355 },
  { slug: 'vidaextra', name: 'VidaExtra', site: 'https://www.vidaextra.com', feed: 'https://www.vidaextra.com/feedburner.xml', lang: 'es', tono: 140 },
  { slug: 'anaitgames', name: 'AnaitGames', site: 'https://www.anaitgames.com', feed: 'https://www.anaitgames.com/feed', lang: 'es', tono: 280 },
  { slug: 'nintenderos', name: 'Nintenderos', site: 'https://www.nintenderos.com', feed: 'https://www.nintenderos.com/feed/', lang: 'es', tono: 0 },
  { slug: 'areajugones', name: 'Areajugones', site: 'https://areajugones.sport.es', feed: 'https://areajugones.sport.es/feed/', lang: 'es', tono: 45 },
  { slug: 'generacion-xbox', name: 'Generación Xbox', site: 'https://generacionxbox.com', feed: 'https://generacionxbox.com/feed/', lang: 'es', tono: 120 },
  // En inglés
  { slug: 'ign', name: 'IGN', site: 'https://www.ign.com', feed: 'https://feeds.feedburner.com/ign/news', lang: 'en', tono: 350 },
  { slug: 'eurogamer', name: 'Eurogamer', site: 'https://www.eurogamer.net', feed: 'https://www.eurogamer.net/feed', lang: 'en', tono: 215 },
  { slug: 'pc-gamer', name: 'PC Gamer', site: 'https://www.pcgamer.com', feed: 'https://www.pcgamer.com/rss/', lang: 'en', tono: 0 },
  { slug: 'rock-paper-shotgun', name: 'Rock Paper Shotgun', site: 'https://www.rockpapershotgun.com', feed: 'https://www.rockpapershotgun.com/feed', lang: 'en', tono: 160 },
  { slug: 'polygon', name: 'Polygon', site: 'https://www.polygon.com', feed: 'https://www.polygon.com/feed/', lang: 'en', tono: 300 },
  { slug: 'kotaku', name: 'Kotaku', site: 'https://kotaku.com', feed: 'https://kotaku.com/feed', lang: 'en', tono: 32 },
  { slug: 'gamespot', name: 'GameSpot', site: 'https://www.gamespot.com', feed: 'https://www.gamespot.com/feeds/news/', lang: 'en', tono: 48 },
  { slug: 'nintendo-life', name: 'Nintendo Life', site: 'https://www.nintendolife.com', feed: 'https://www.nintendolife.com/feeds/latest', lang: 'en', tono: 352 },
  { slug: 'push-square', name: 'Push Square', site: 'https://www.pushsquare.com', feed: 'https://www.pushsquare.com/feeds/latest', lang: 'en', tono: 228 },
  { slug: 'pure-xbox', name: 'Pure Xbox', site: 'https://www.purexbox.com', feed: 'https://www.purexbox.com/feeds/latest', lang: 'en', tono: 110 },
  { slug: 'vgc', name: 'VGC', site: 'https://www.videogameschronicle.com', feed: 'https://www.videogameschronicle.com/feed/', lang: 'en', tono: 265 },
  { slug: 'gematsu', name: 'Gematsu', site: 'https://www.gematsu.com', feed: 'https://www.gematsu.com/feed', lang: 'en', tono: 190 },
  { slug: 'destructoid', name: 'Destructoid', site: 'https://www.destructoid.com', feed: 'https://www.destructoid.com/feed/', lang: 'en', tono: 15 },
  { slug: 'the-verge', name: 'The Verge', site: 'https://www.theverge.com/games', feed: 'https://www.theverge.com/rss/games/index.xml', lang: 'en', tono: 320 },
];

module.exports = PORTALES;

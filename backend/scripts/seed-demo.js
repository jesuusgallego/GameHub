// Crea usuarios ficticios para probar la app (sobre todo la parte social): perfiles con
// datos y privacidad distintos, amistades, solicitudes, un bloqueo, conversaciones del chat y
// bibliotecas con juegos reales de IGDB.
//
//   npm run seed:demo                          crea (o recrea) los usuarios de demostración
//   npm run seed:demo -- --solicitudes-a=ana   además, 2 solicitudes de amistad pendientes
//                                              hacia tu cuenta "ana", para probar Aceptar
//   npm run seed:demo -- --steam-id=7656119...  las personas con Steam usan ese SteamID (el tuyo,
//                                              con "Detalles del juego" en público): así la lista
//                                              de logros de la ficha es real. Sin esto, tienen
//                                              un SteamID inventado y solo se ven los contadores.
//   npm run seed:demo:borrar                   los borra (y con ellos sus amistades y juegos)
//
// Todos los usuarios llevan el correo @demo.gamehub.test (un dominio que no existe) y el
// nombre empieza por "demo_": así se reconocen y se borran sin tocar cuentas reales.
//
// SOLO funciona contra una base de datos local (localhost, 127.0.0.1 o el servicio "db" de
// Docker): nunca contra producción, aunque el .env apunte allí por error.
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');
const { SALT_ROUNDS } = require('../src/config/validacion');

const PASSWORD = 'Prueba1234';
const DOMINIO = '@demo.gamehub.test';

// Juegos reales de IGDB (id, nombre y portada comprobados contra su API), con su id de Steam y
// cuántos logros tiene (para las personas con `steam: true`)
const portada = (codigo) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${codigo}.jpg`;
const JUEGOS = {
  zelda: [7346, 'The Legend of Zelda: Breath of the Wild', portada('co3p2d')], // no está en Steam
  hades: [113112, 'Hades', portada('cob9kr'), 1145360, 49],
  hades2: [228525, 'Hades II', portada('coaknx'), 1145350, 36],
  celeste: [26226, 'Celeste', portada('cob9dh'), 504230, 32],
  hollow: [14593, 'Hollow Knight', portada('cobfzp'), 367520, 63],
  silksong: [372563, 'Hollow Knight Silksong', portada('coaob9'), 1030300, 53],
  stardew: [17000, 'Stardew Valley', portada('coa93h'), 413150, 40],
  elden: [119133, 'Elden Ring', portada('co4jni'), 1245620, 42],
  witcher: [1942, 'The Witcher 3: Wild Hunt', portada('coaarl'), 292030, 78],
  portal2: [72, 'Portal 2', portada('co1rs4'), 620, 51],
  cyberpunk: [1877, 'Cyberpunk 2077', portada('coaih8'), 1091500, 44],
  rdr2: [25076, 'Red Dead Redemption 2', portada('co1q1f'), 1174180, 52],
  bg3: [119171, "Baldur's Gate III", portada('co670h'), 1086940, 54],
  ds3: [11133, 'Dark Souls III', portada('cob9ed'), 374320, 43],
};

// Cada persona: datos del perfil, ajustes de privacidad (lo que no se indica es el valor por
// defecto) y su biblioteca como [juego, estado, nota, reseña, "hace cuántas horas" se tocó]
const USUARIOS = [
  {
    username: 'demo_ana', steam: true, first_name: 'Ana', last_name: 'Martín', birth_date: '1996-03-12', gender: 'mujer',
    location: 'Sevilla', country: 'ES', phone: '+34612345678',
    bio: 'Metroidvanias y café. Speedrunner de domingo.',
    privacidad: {
      visibility_name: 'todos', visibility_age: 'todos', visibility_gender: 'todos', visibility_location: 'todos',
      visibility_library: 'todos', visibility_reviews: 'todos', visibility_friends: 'todos',
      visibility_achievements: 'todos',
    },
    juegos: [
      ['hollow', 'completado', 10, 'Obra maestra. Los jefes finales son brutales.', 26],
      ['celeste', 'jugando', null, null, 2],
      ['hades', 'completado', 9, null, 80],
      ['silksong', 'pendiente', null, null, 120],
      ['zelda', 'abandonado', 6, 'Muy bonito pero se me hizo largo.', 50],
    ],
  },
  {
    username: 'demo_beto', steam: true, first_name: 'Alberto', last_name: 'Ruiz', birth_date: '1991-11-02', gender: 'hombre',
    location: 'Madrid', country: 'ES', bio: 'Solo juego RPG. No me habléis de shooters.',
    privacidad: {}, // todo por defecto: datos personales privados, biblioteca solo para amigos
    juegos: [
      ['witcher', 'completado', 10, 'La mejor historia que he jugado.', 200],
      ['bg3', 'jugando', 9, null, 5],
      ['elden', 'abandonado', 5, 'Demasiado difícil para mí.', 300],
      ['cyberpunk', 'completado', 7, null, 500],
      ['hollow', 'jugando', 8, 'Lo estoy disfrutando más de lo que esperaba.', 12],
      ['celeste', 'completado', 9, null, 140],
    ],
  },
  {
    username: 'demo_carla', first_name: 'Carla', last_name: 'Gómez', birth_date: '2000-07-21', gender: 'mujer',
    location: 'Ciudad de México', country: 'MX', phone: '+525512345678', bio: 'Juegos cozy y puzles.',
    // Biblioteca privada y solo acepta solicitudes de amigos de sus amigos
    privacidad: { visibility_name: 'amigos', visibility_library: 'nadie', request_policy: 'amigos_de_amigos' },
    juegos: [
      ['stardew', 'jugando', 8, null, 1],
      ['celeste', 'completado', 9, null, 60],
      ['portal2', 'completado', 10, 'Perfecto de principio a fin.', 400],
    ],
  },
  {
    username: 'demo_dani', first_name: 'Daniel', last_name: 'Ortega', birth_date: '1988-01-30', gender: 'hombre',
    location: 'Buenos Aires', country: 'AR', bio: 'Souls y mundo abierto.',
    privacidad: { searchable: false }, // no sale en las búsquedas ni en las sugerencias
    juegos: [
      ['rdr2', 'jugando', 9, null, 3],
      ['ds3', 'completado', 9, 'Lo mejor de la saga.', 150],
      ['elden', 'jugando', null, null, 10],
    ],
  },
  {
    username: 'demo_eva', steam: true, first_name: 'Eva', last_name: 'Lindqvist', birth_date: '1999-09-05', gender: 'mujer',
    location: 'Estocolmo', country: 'SE', bio: 'Todo lo de Supergiant.',
    // No admite solicitudes y esconde sus horas y logros
    privacidad: { visibility_name: 'todos', visibility_library: 'todos', visibility_achievements: 'nadie', request_policy: 'nadie' },
    juegos: [
      ['hades2', 'jugando', 8, null, 4],
      ['hades', 'completado', 9, null, 90],
      ['hollow', 'abandonado', 7, null, 250],
    ],
  },
  {
    username: 'demo_fran', first_name: 'Francisca', last_name: 'Sanz', birth_date: '1994-05-17', gender: 'otro',
    location: 'Valencia', country: 'ES', bio: 'Indies y plataformas.',
    privacidad: { visibility_friends: 'nadie', visibility_reviews: 'nadie' }, // esconde su lista de amigos
    juegos: [
      ['portal2', 'completado', 9, 'Muy buena.', 100],
      ['stardew', 'completado', 8, null, 180],
      ['celeste', 'jugando', null, null, 7],
    ],
  },
  {
    username: 'demo_gus', steam: true, first_name: 'Gustavo', last_name: 'Pérez', birth_date: '1985-12-09', gender: 'hombre',
    location: 'Lima', country: 'PE', phone: '+51912345678', bio: 'Lo enseño todo, no tengo nada que esconder.',
    privacidad: {
      visibility_name: 'todos', visibility_age: 'todos', visibility_gender: 'todos', visibility_location: 'todos',
      visibility_library: 'todos', visibility_reviews: 'todos', visibility_friends: 'todos',
    },
    juegos: [
      ['zelda', 'completado', 10, 'El juego de su generación.', 70],
      ['elden', 'completado', 10, null, 35],
      ['bg3', 'jugando', 9, null, 1],
      ['cyberpunk', 'pendiente', null, null, 600],
      ['hades', 'completado', 10, 'Cien horas y las que me queden.', 220],
      ['celeste', 'abandonado', 6, null, 400],
    ],
  },
  {
    username: 'demo_hugo', first_name: 'Hugo', last_name: 'Silva', birth_date: '2002-04-14', gender: 'hombre',
    location: 'Lisboa', country: 'PT', bio: 'Acabo de llegar. Aún no tengo juegos.',
    privacidad: {}, juegos: [], // sin juegos: sirve para ver los estados vacíos
  },
];

// [quien, con quien]: amistades aceptadas, solicitudes pendientes (la envía el primero) y
// bloqueos (el primero bloquea al segundo)
const AMISTADES = [
  ['demo_ana', 'demo_beto'], ['demo_ana', 'demo_carla'], ['demo_ana', 'demo_gus'], ['demo_ana', 'demo_eva'],
  ['demo_beto', 'demo_dani'], ['demo_carla', 'demo_dani'], ['demo_carla', 'demo_eva'], ['demo_gus', 'demo_fran'],
];
const SOLICITUDES = [['demo_hugo', 'demo_ana']];
const BLOQUEOS = [['demo_hugo', 'demo_beto']];

// Conversaciones del chat entre amigos: [quién escribe, texto, hace cuántos minutos, estado].
// El estado es opcional: 'sinleer' (la otra persona aún no lo ha visto) o 'borrado' (su autor
// lo eliminó). Los demás están leídos. Todo lo que escribe alguien a demo_ana y no está leído
// sale como mensajes sin leer en su cuenta.
const CONVERSACIONES = [
  ['demo_ana', 'demo_beto', [
    ['demo_beto', '¿Has probado ya Hades II?', 1700],
    ['demo_ana', 'Sí! Llevo 12 horas, el combate es una pasada', 1690],
    ['demo_ana', 'Aunque Hollow Knight sigue siendo mi favorito 😅', 1689],
    ['demo_beto', 'jajaja eso no te lo discuto', 1650],
    ['demo_beto', '¿Jugamos algo esta noche?', 130],
    ['demo_ana', 'Dale, ¿a qué hora?', 120],
    ['demo_beto', '¿Sobre las 10 te viene bien?', 14, 'sinleer'],
    ['demo_beto', 'Y si quieres probamos el cooperativo de Portal 2', 13, 'sinleer'],
  ]],
  ['demo_ana', 'demo_carla', [
    ['demo_carla', 'Mira lo que he encontrado: https://store.steampowered.com/app/1145360/Hades/', 400],
    ['demo_ana', 'Ya lo tengo 😄 está rebajadísimo', 395],
    ['demo_carla', 'Ups, mensaje equivocado', 300, 'borrado'],
    ['demo_ana', 'Te debo una partida de Celeste', 61],
  ]],
  ['demo_ana', 'demo_gus', [
    ['demo_gus', '¿Te animas a una partida de Elden Ring el finde?', 3000],
    ['demo_ana', 'Cuenta conmigo, aviso a Fran también', 2990],
  ]],
  ['demo_ana', 'demo_eva', [
    ['demo_eva', '¡Hola!', 9000, 'sinleer'],
  ]],
  ['demo_beto', 'demo_dani', [
    ['demo_beto', 'Ya estoy en el lobby', 50],
    ['demo_dani', 'Voy, dame un minuto', 49],
  ]],
];

// El script solo escribe en una base de datos local
function esBaseLocal(url) {
  try {
    const host = new URL(url).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]', 'db'].includes(host);
  } catch {
    return false;
  }
}

async function borrarDemo(db) {
  // ON DELETE CASCADE: se van también sus juegos, amistades, bloqueos, mensajes y códigos
  const r = await db.query('DELETE FROM users WHERE email LIKE $1', [`%${DOMINIO}`]);
  return r.rowCount;
}

async function crearDemo(db, solicitudesA, steamId) {
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const ids = {};

  for (const u of USUARIOS) {
    const p = u.privacidad;
    const r = await db.query(
      `INSERT INTO users (username, email, password_hash, bio, first_name, last_name, birth_date, gender,
                          location, country, phone,
                          visibility_name, visibility_age, visibility_gender, visibility_location,
                          visibility_library, visibility_reviews, visibility_friends, request_policy, searchable,
                          visibility_achievements)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               COALESCE($12,'nadie'),COALESCE($13,'nadie'),COALESCE($14,'nadie'),COALESCE($15,'nadie'),
               COALESCE($16,'amigos'),COALESCE($17,'amigos'),COALESCE($18,'amigos'),
               COALESCE($19,'todos'),COALESCE($20,TRUE),COALESCE($21,'amigos'))
       RETURNING id`,
      [
        u.username, `${u.username}${DOMINIO}`, hash, u.bio, u.first_name, u.last_name, u.birth_date, u.gender,
        u.location, u.country, u.phone ?? null,
        p.visibility_name, p.visibility_age, p.visibility_gender, p.visibility_location,
        p.visibility_library, p.visibility_reviews, p.visibility_friends, p.request_policy, p.searchable,
        p.visibility_achievements,
      ]
    );
    ids[u.username] = r.rows[0].id;

    // Quien tiene `steam: true` lleva una cuenta de Steam vinculada (inventada, o la que se
    // pase con --steam-id=): sin ella la ficha de un amigo no pide logros.
    if (u.steam) {
      await db.query(
        `INSERT INTO linked_accounts (user_id, platform, external_id, display_name, last_sync_at)
         VALUES ($1, 'steam', $2, $3, NOW())`,
        [ids[u.username], steamId ?? `7656119800000${String(ids[u.username]).padStart(4, '0')}`, u.username]
      );
    }

    for (const [clave, estado, nota, resena, horas] of u.juegos) {
      const [igdbId, nombre, cover, appid, logrosTotales] = JUEGOS[clave];
      // Los datos de Steam, inventados pero verosímiles: las horas y los logros dependen del
      // estado (completado = casi todos, jugando = la mitad, abandonado = pocos, pendiente = 0)
      const conSteam = u.steam && appid;
      const fraccion = { completado: 0.92, jugando: 0.45, abandonado: 0.2, pendiente: 0 }[estado];
      const logrosHechos = conSteam ? Math.round(logrosTotales * fraccion) : null;
      const minutos = conSteam ? (estado === 'pendiente' ? 0 : { completado: 2400, jugando: 900, abandonado: 300 }[estado] + igdbId % 700) : null;
      // updated_at es "hace N horas": ordena la actividad de los amigos. Lo completado o
      // abandonado se añadió 10 días antes (como si se hubiera editado después).
      const editado = estado === 'completado' || estado === 'abandonado';
      await db.query(
        `INSERT INTO user_games (user_id, igdb_id, name, cover_url, status, rating, review, created_at, updated_at,
                                 steam_appid, playtime_minutes, achievements_unlocked, achievements_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,
                 NOW() - ($8::int * INTERVAL '1 hour') - ($9::int * INTERVAL '1 day'),
                 NOW() - ($8::int * INTERVAL '1 hour'),
                 $10,$11,$12,$13)`,
        [ids[u.username], igdbId, nombre, cover, estado, nota, resena, horas, editado ? 10 : 0,
          conSteam ? appid : null, minutos, logrosHechos, conSteam ? logrosTotales : null]
      );
    }
  }

  // responded_at solo tiene valor en las aceptadas. Se calcula en JavaScript y se pasa como
  // parámetro propio: usar $3 a la vez como columna y dentro de un CASE da "inconsistent
  // types" en Postgres.
  const amistad = (a, b, estado) => db.query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
     VALUES ($1,$2,$3,$4)`,
    [ids[a], ids[b], estado, estado === 'aceptada' ? new Date() : null]
  );
  for (const [a, b] of AMISTADES) await amistad(a, b, 'aceptada');
  for (const [a, b] of SOLICITUDES) await amistad(a, b, 'pendiente');
  for (const [a, b] of BLOQUEOS) {
    await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2)', [ids[a], ids[b]]);
  }

  // Conversaciones. created_at y read_at se calculan aquí y se pasan como fechas: la hora a la
  // que se vio un mensaje es un minuto después de enviarlo (o ahora, si es más reciente).
  const ahora = Date.now();
  for (const [a, b, mensajes] of CONVERSACIONES) {
    for (const [quien, texto, haceMin, estado] of mensajes) {
      const enviado = new Date(ahora - haceMin * 60_000);
      const visto = estado === 'sinleer' ? null : new Date(Math.min(ahora, enviado.getTime() + 60_000));
      await db.query(
        `INSERT INTO messages (sender_id, recipient_id, body, created_at, read_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ids[quien], ids[quien === a ? b : a], estado === 'borrado' ? '' : texto, enviado, visto,
          estado === 'borrado' ? new Date(enviado.getTime() + 120_000) : null]
      );
    }
  }

  // Solicitudes hacia una cuenta real (para probar Aceptar y la insignia de la barra)
  let aviso = null;
  if (solicitudesA) {
    const r = await db.query('SELECT id FROM users WHERE username = $1 AND email NOT LIKE $2', [solicitudesA, `%${DOMINIO}`]);
    if (r.rows.length === 0) {
      aviso = `No existe ninguna cuenta real llamada "${solicitudesA}": no se han creado solicitudes hacia ella.`;
    } else {
      for (const quien of ['demo_gus', 'demo_eva']) {
        await db.query(
          `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [ids[quien], r.rows[0].id]
        );
      }
    }
  }

  return aviso;
}

async function main() {
  const argumentos = process.argv.slice(2);
  const borrar = argumentos.includes('--borrar');
  const solicitudesA = (argumentos.find((a) => a.startsWith('--solicitudes-a=')) ?? '').split('=')[1] || null;
  const steamId = (argumentos.find((a) => a.startsWith('--steam-id=')) ?? '').split('=')[1] || null;

  if (!esBaseLocal(process.env.DATABASE_URL ?? '') || process.env.NODE_ENV === 'production') {
    console.error('Este script solo se ejecuta contra una base de datos local (localhost). Cancelado.');
    process.exit(1);
  }

  // Si el backend nunca arrancó, las tablas no existen
  const tablas = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'friendships'");
  if (tablas.rows.length === 0) {
    console.error('Faltan las tablas sociales: arranca el backend una vez (aplica schema.sql) y repite.');
    process.exit(1);
  }

  // Una transacción: o se borra y se crea todo, o no cambia nada (si algo falla a medias, no
  // quedan usuarios sueltos). BEGIN/COMMIT/ROLLBACK van en una sola conexión del pool.
  const db = await pool.connect();
  let borrados;
  let aviso = null;

  try {
    await db.query('BEGIN');
    borrados = await borrarDemo(db);
    if (!borrar) aviso = await crearDemo(db, solicitudesA, steamId);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }

  if (borrar) {
    console.log(`Borrados ${borrados} usuarios de demostración.`);
    return;
  }

  if (borrados > 0) console.log(`(Había ${borrados} usuarios de demostración: se han recreado desde cero.)`);

  console.log(`\nCreados ${USUARIOS.length} usuarios ficticios. Contraseña de todos: ${PASSWORD}\n`);
  for (const u of USUARIOS) {
    console.log(`  ${u.username.padEnd(11)} ${u.username}${DOMINIO}`);
  }
  if (solicitudesA && !aviso) console.log(`\n2 solicitudes de amistad pendientes hacia "${solicitudesA}" (de demo_gus y demo_eva).`);
  if (aviso) console.log(`\n${aviso}`);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- solo el hash de bcrypt, nunca la contraseña
    avatar TEXT, -- foto de perfil como data URL (data:image/jpeg;base64,...); NULL = sin foto
    bio VARCHAR(300), -- descripción corta del perfil
    created_at TIMESTAMP DEFAULT NOW()
);

-- Para una BD creada antes de existir el perfil: CREATE TABLE IF NOT EXISTS no
-- toca una tabla que ya existe, así que añado las columnas aparte. En una BD
-- nueva estas dos líneas no hacen nada (las columnas ya están).
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(300);

-- Cada fila es un juego en la biblioteca de un usuario.
-- Con ON DELETE CASCADE, si borro al usuario se borran también sus juegos.
CREATE TABLE IF NOT EXISTS user_games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- ID del juego en IGDB (no es el id de esta tabla)
    igdb_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    cover_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('jugando', 'completado', 'abandonado', 'pendiente')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 10),
    review TEXT,
    platform VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Un usuario no puede tener el mismo juego dos veces (el controlador lo devuelve como 409)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_game_unique
    ON user_games (user_id, igdb_id);

-- Caché de traducciones automáticas (las descripciones de IGDB vienen en inglés).
-- Traducir con LibreTranslate tarda unos segundos, así que cada texto se traduce
-- una sola vez por idioma y se guarda. La clave es el SHA-256 del texto original
-- (más corto y rápido de comparar que el texto) y el idioma de destino.
CREATE TABLE IF NOT EXISTS translations (
    text_hash CHAR(64) NOT NULL,
    target VARCHAR(5) NOT NULL,
    translated_text TEXT NOT NULL,
    -- Quién tradujo: 'azure' o 'libretranslate'. Si una traducción es de
    -- LibreTranslate y luego hay clave de Azure, se rehace con Azure (más calidad).
    provider VARCHAR(20) NOT NULL DEFAULT 'libretranslate',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (text_hash, target)
);

-- Para una BD creada antes de existir Azure (la tabla ya existe sin esta columna)
ALTER TABLE translations ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'libretranslate';

-- Cuántos caracteres se han enviado a un traductor externo cada mes. El plan
-- gratuito de Azure Translator da 2 millones al mes; la app se pone un tope propio
-- por debajo y, al llegar, deja de usarlo hasta el mes siguiente. Así nunca
-- depende de lo que haga Microsoft al pasarse del límite.
CREATE TABLE IF NOT EXISTS translation_usage (
    provider VARCHAR(20) NOT NULL,
    month CHAR(7) NOT NULL, -- 'AAAA-MM' (UTC)
    characters INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (provider, month)
);

-- Cuentas de otras plataformas vinculadas a un usuario (de momento solo Steam).
-- external_id es el id de la cuenta en esa plataforma (para Steam, el SteamID de
-- 17 dígitos). Es un dato público, no una credencial: Steam se consulta con la
-- clave de API de la propia app, así que no guardo ninguna contraseña ni token.
-- UNIQUE (user_id, platform): un usuario solo puede tener una cuenta por plataforma.
CREATE TABLE IF NOT EXISTS linked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,
    external_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    profile_url VARCHAR(500),
    -- TIMESTAMPTZ guarda el instante exacto (el frontend lo enseña con hora, y así no
    -- depende de la zona horaria del servidor). NULL = vinculada pero sin sincronizar.
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

-- Antes la importación de juegos era opcional y se elegía al vincular
-- (import_games). Ahora la sincronización siempre importa y desvincular borra lo
-- importado, así que la columna sobra. En una BD nueva no existe y esto no hace nada.
ALTER TABLE linked_accounts DROP COLUMN IF EXISTS import_games;

-- Progreso traído de Steam. Todo es NULL en los juegos que no vienen de Steam.
--  - steam_appid: id del juego en Steam (distinto del igdb_id)
--  - playtime_minutes: tiempo jugado
--  - achievements_*: logros desbloqueados y totales. Total 0 = el juego no tiene
--    logros; NULL = todavía no se han consultado.
-- Igual que con avatar y bio: CREATE TABLE IF NOT EXISTS no toca una tabla que ya
-- existe, así que las columnas se añaden aparte (en una BD nueva no hacen nada).
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS steam_appid INTEGER;
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS playtime_minutes INTEGER;
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS achievements_unlocked INTEGER;
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS achievements_total INTEGER;

-- De dónde viene un juego: 'steam' si lo añadió la importación de Steam, NULL si lo
-- añadió el usuario. Sirve para que, al desvincular la cuenta, se borre lo importado
-- y la biblioteca vuelva a quedar como antes de vincularla.
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS imported_from VARCHAR(20);

-- Datos del juego que sirven para filtrar y ordenar la biblioteca. Vienen de IGDB y
-- se copian aquí para no pedirlos en cada visita: GET /games rellena los juegos que
-- aún no los tienen (metadata_at NULL) y los refresca pasado un mes.
--  - genres, developers, publishers: nombres tal como los da IGDB (en inglés)
--  - release_date: primer lanzamiento; igdb_rating: nota media de IGDB (0 a 100)
--  - metadata_at: cuándo se consultó (también si IGDB no sabía nada del juego, para
--    no volver a preguntar en cada visita)
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS developers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS publishers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS release_date DATE;
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS igdb_rating INTEGER;
ALTER TABLE user_games ADD COLUMN IF NOT EXISTS metadata_at TIMESTAMPTZ;

-- Códigos para recuperar la contraseña. Un usuario tiene como mucho uno vigente (la
-- clave primaria es user_id): pedir otro código sustituye al anterior.
--  - code_hash: huella del código de 6 dígitos, nunca el código (si alguien leyera la
--    tabla, no podría usarlo)
--  - expires_at: cuándo caduca (15 minutos después de pedirlo)
--  - attempts: cuántas veces se ha probado un código; al llegar al máximo el código
--    deja de valer, así no se pueden adivinar los 1.000.000 de combinaciones
CREATE TABLE IF NOT EXISTS password_resets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versión de la sesión del usuario. Cada token lleva la versión que tenía su dueño al
-- iniciar sesión; al cambiar o recuperar la contraseña se suma 1 aquí, y así todos los
-- tokens emitidos antes dejan de valer (aunque no hayan caducado). Los tokens antiguos
-- sin versión cuentan como 0, que es el valor de partida: siguen valiendo hasta el
-- primer cambio de contraseña.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Nombre de usuario en minúsculas: de 3 a 20 caracteres, solo a-z, 0-9 y guion bajo
-- (misma regla que USERNAME_REGEX en config/validacion.js). Antes valía cualquier texto
-- de hasta 50 caracteres, así que primero convierto los que ya existen.
-- Cada nombre se convierte así: sin tildes ("José" -> jose, la Ñ pasa a n), espacios,
-- puntos y guiones a "_", se quita lo demás, minúsculas y como mucho 20 caracteres. Si
-- queda de menos de 3 se llama usuario. Si el resultado ya lo tiene otra persona se le
-- añade un número ("ana" -> ana2, ana3...). Solo toca los nombres que no cumplen la
-- regla, así que en los arranques siguientes no hace nada. El bucle va usuario a
-- usuario y cada UPDATE se ve en la siguiente comprobación, por eso nunca repite nombre.
-- Los que ya cumplían la regla no se tocan, así que conservan su nombre aunque otro
-- acabe pareciéndose.
-- Una versión anterior de esta regla pedía mayúsculas (no llegó a publicarse, pero sí a
-- bases de datos de desarrollo). Si la restricción que hay no es la de ahora, la quito
-- antes de convertir los nombres: rechazaría los que acaban en minúsculas. Cuando ya es
-- la actual no hace nada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_username_formato' AND conrelid = 'users'::regclass
       AND pg_get_constraintdef(oid) NOT LIKE '%a-z%'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_formato;
  END IF;
END $$;

DO $$
DECLARE
  u RECORD;
  base TEXT;
  candidato TEXT;
  n INTEGER;
BEGIN
  FOR u IN
    SELECT id, username FROM users WHERE username !~ '^[a-z0-9_]{3,20}$' ORDER BY id
  LOOP
    base := lower(translate(
      u.username,
      'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇáéíóúüñàèìòùâêîôûäëïöç',
      'AEIOUUNAEIOUAEIOUAEIOCAEIOUUNAEIOUAEIOUAEIOC'
    ));
    base := regexp_replace(base, '[\s.-]+', '_', 'g');
    base := left(regexp_replace(base, '[^a-z0-9_]', '', 'g'), 20);
    IF length(base) < 3 THEN
      base := 'usuario';
    END IF;

    candidato := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM users WHERE username = candidato AND id <> u.id) LOOP
      n := n + 1;
      candidato := left(base, 20 - length(n::text)) || n::text;
    END LOOP;

    UPDATE users SET username = candidato WHERE id = u.id;
  END LOOP;
END $$;

-- La misma regla como restricción: aunque algún día un cambio del código se olvidara de
-- validar, la base de datos no deja guardar un nombre que no la cumple. ADD CONSTRAINT
-- no tiene IF NOT EXISTS, por eso se comprueba a mano que no esté ya.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_username_formato' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_formato CHECK (username ~ '^[a-z0-9_]{3,20}$');
  END IF;
END $$;

-- Datos personales del perfil, todos opcionales (NULL = sin indicar):
--  - first_name, last_name: nombre y apellidos
--  - birth_date: fecha de nacimiento. Se guarda la fecha y no la edad, que se quedaría
--    desfasada cada cumpleaños; la edad se calcula al leer (ver profileController)
--  - gender: 'hombre', 'mujer' u 'otro'
--  - location: texto libre, la ciudad o región ("Sevilla")
--  - country: país como código ISO de dos letras en mayúsculas ("ES"); aparte de location
--  - phone: teléfono en formato internacional sin separadores ("+34600123456")
-- Las columnas se añaden aparte por lo mismo que avatar y bio: CREATE TABLE IF NOT EXISTS
-- no toca una tabla que ya existe. El CHECK de gender, escrito en la propia columna, solo
-- se añade cuando la columna se crea.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
    CHECK (gender IN ('hombre', 'mujer', 'otro'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2)
    CHECK (country ~ '^[A-Z]{2}$');
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(16)
    CHECK (phone ~ '^\+[1-9][0-9]{6,14}$');

-- Privacidad del perfil. Cada dato tiene su propio nivel: 'nadie' (solo yo), 'amigos' o
-- 'todos' (cualquiera con sesión iniciada). Los datos personales (nombre, edad, sexo y
-- localización) empiezan en 'nadie': nadie los comparte sin haberlo decidido. La biblioteca,
-- las reseñas y la lista de amigos empiezan en 'amigos'. El email, el teléfono y la fecha de
-- nacimiento no se enseñan nunca, con ninguna opción. Nombre de usuario, foto y bio son
-- siempre públicos.
--  - visibility_name: nombre y apellidos      - visibility_age: la edad
--  - visibility_gender: el sexo               - visibility_location: localización y país
--  - visibility_library: los juegos de la biblioteca y sus estadísticas
--  - visibility_reviews: el texto de las reseñas (aparte, porque es lo más personal)
--  - visibility_friends: la lista de amigos
-- Y dos ajustes de contacto:
--  - request_policy: quién puede enviarme solicitudes de amistad: 'todos',
--    'amigos_de_amigos' (solo quien tiene algún amigo en común conmigo) o 'nadie'
--  - searchable: si aparezco en las búsquedas de personas (y en las sugerencias)
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_name VARCHAR(10) NOT NULL DEFAULT 'nadie'
    CHECK (visibility_name IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_age VARCHAR(10) NOT NULL DEFAULT 'nadie'
    CHECK (visibility_age IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_gender VARCHAR(10) NOT NULL DEFAULT 'nadie'
    CHECK (visibility_gender IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_location VARCHAR(10) NOT NULL DEFAULT 'nadie'
    CHECK (visibility_location IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_library VARCHAR(10) NOT NULL DEFAULT 'amigos'
    CHECK (visibility_library IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_reviews VARCHAR(10) NOT NULL DEFAULT 'amigos'
    CHECK (visibility_reviews IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility_friends VARCHAR(10) NOT NULL DEFAULT 'amigos'
    CHECK (visibility_friends IN ('nadie', 'amigos', 'todos'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS request_policy VARCHAR(20) NOT NULL DEFAULT 'todos'
    CHECK (request_policy IN ('todos', 'amigos_de_amigos', 'nadie'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS searchable BOOLEAN NOT NULL DEFAULT TRUE;

-- Una versión anterior tenía un único nivel para los datos personales (visibility_personal).
-- Si la columna todavía existe, su valor pasa a los cuatro datos y se borra. Solo se ejecuta
-- esa vez: después la columna ya no está.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'visibility_personal'
  ) THEN
    UPDATE users
       SET visibility_name = visibility_personal,
           visibility_age = visibility_personal,
           visibility_gender = visibility_personal,
           visibility_location = visibility_personal;
    ALTER TABLE users DROP COLUMN visibility_personal;
  END IF;
END $$;

-- Amistades y solicitudes. Una fila por pareja de personas, sin importar quién la pidió:
--  - 'pendiente': requester_id envió la solicitud y addressee_id aún no ha respondido
--  - 'aceptada': son amigos
-- Rechazar o cancelar una solicitud, o dejar de ser amigos, borra la fila.
-- Con ON DELETE CASCADE, al borrar una cuenta desaparecen sus amistades.
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aceptada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CHECK (requester_id <> addressee_id)
);

-- La pareja es única en cualquier sentido: LEAST/GREATEST ordenan los dos ids, así que
-- (1, 2) y (2, 1) son la misma. Impide dos filas aunque dos personas se pidan amistad a
-- la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pareja
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
-- Para listar las solicitudes y amistades de cada persona sin recorrer toda la tabla
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id, status);

-- Bloqueos: blocker_id ha bloqueado a blocked_id. Quien bloquea deja de ser su amigo, no
-- recibe solicitudes suyas y la otra persona ya no puede verle el perfil ni encontrarle.
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- La búsqueda de personas filtra por el comienzo del nombre de usuario (starts_with). Con
-- pocos usuarios recorrer la tabla es instantáneo; si algún día hay muchos, bastaría un
-- índice sobre username con la clase de operador text_pattern_ops.

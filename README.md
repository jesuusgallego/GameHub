# GameHub

Aplicación para llevar tu biblioteca personal de videojuegos: búsqueda en IGDB, estado, nota y reseña de cada juego, y vinculación con Steam para traer tus juegos, horas y logros. Hay versión web y versión de escritorio (Windows).

## Stack

| Capa | Tecnologías |
|------|-------------|
| Interfaz | React 19, React Router 7, Vite 8 |
| Escritorio | Electron, electron-builder, electron-updater |
| Backend | Node.js 22, Express 5, JWT, bcrypt, pg, axios, helmet, express-rate-limit |
| Base de datos | PostgreSQL 16 |
| Servicios externos | IGDB (datos de juegos), Steam Web API (horas y logros), Azure Translator o LibreTranslate (traducción) |
| Despliegue | Render (backend) + Neon (PostgreSQL), instalador de Windows generado con GitHub Actions. Docker Compose para desarrollo |

## Estructura

```
biblioteca-videojuegos/
├── backend/                 # API: Express + PostgreSQL
│   ├── src/
│   │   ├── app.js               # Arranque, seguridad (helmet, CORS, límites) y rutas
│   │   ├── routes/              # Qué URL llama a qué controlador
│   │   ├── controllers/         # Lógica de cada ruta: auth, games, profile, accounts
│   │   ├── middleware/          # Sesión (JWT) y límites de intentos
│   │   ├── services/            # IGDB, Steam, traducción y sincronización automática
│   │   ├── models/sql/schema.sql  # Esquema de la BD (idempotente: se aplica al arrancar)
│   │   └── config/db.js
│   ├── test/                    # Pruebas (npm test)
│   ├── .env.example             # Plantilla de variables de entorno
│   └── Dockerfile
├── frontend/                # Interfaz React, para web y escritorio (ver frontend/README.md)
│   ├── src/                     # Componentes .jsx
│   │   ├── estilos/             # CSS por zonas (ver estilos/LEEME.md)
│   │   └── textos/              # Traducciones es/en
│   └── test/                    # Pruebas (npm test)
├── desktop/                 # App de escritorio con Electron (ver desktop/README.md)
├── docs/
│   ├── DESARROLLO.md            # Cómo retomar el trabajo cada día
│   └── DESPLIEGUE.md            # Cómo poner el servidor en internet
├── .github/workflows/       # Compila y publica el instalador de Windows
├── docker-compose.yml       # PostgreSQL, traductor local y backend + frontend en Docker
├── render.yaml              # Plano para desplegar el backend en Render
├── CHANGELOG.md             # Qué cambia en cada versión
└── LICENSE                  # MIT
```

## Requisitos

- Node.js 22 y npm
- Docker y Docker Compose
- Credenciales de la API de Twitch/IGDB (`TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`)
- Opcional: una clave de Azure AI Translator (`AZURE_TRANSLATOR_KEY` y `AZURE_TRANSLATOR_REGION`) para mejorar la traducción de las descripciones
- Opcional: una [clave de la API web de Steam](https://steamcommunity.com/dev/apikey) (`STEAM_API_KEY`, gratuita) para vincular cuentas de Steam y traer horas jugadas y logros

## Puesta en marcha

> ¿Ya lo tienes instalado y solo quieres retomar el trabajo? Ve a la [guía de desarrollo diario](docs/DESARROLLO.md). Lo de abajo es la **primera instalación**.

### 1. Base de datos

```bash
docker compose up -d postgres traductor
```

Levanta PostgreSQL en `localhost:5432` con usuario `biblioteca_user`, contraseña `biblioteca_pass` y base de datos `biblioteca_db` (datos persistidos en el volumen `pgdata`), y el traductor en `localhost:5000`.

Las descripciones de los juegos, que IGDB solo da en inglés, se traducen al español con **dos traductores**:

1. **[Azure AI Translator](https://azure.microsoft.com/products/ai-services/ai-translator)** (opcional, mejor calidad): si defines `AZURE_TRANSLATOR_KEY` en `backend/.env`, se usa primero. Su plan gratuito (F0) da 2 millones de caracteres al mes. La app se pone un tope propio de **1,9 millones al mes** (`AZURE_TRANSLATOR_LIMITE_MENSUAL`): cuenta en la base de datos (tabla `translation_usage`) los caracteres que envía y, al llegar al tope, deja de usar Azure hasta el mes siguiente, para no depender de lo que haga Microsoft al pasarse del límite.
2. **[LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)** (el contenedor `traductor`): corre en local, sin cuenta ni claves. Es la reserva cuando no hay clave de Azure, se alcanza el tope o Azure falla. La primera vez descarga los modelos de traducción (tarda unos minutos; se guardan en el volumen `lt_models`) y ocupa cerca de 1 GB de RAM.

Si no hay ninguno de los dos, las descripciones salen en inglés. Cada traducción se guarda en la base de datos (tabla `translations`), así que no se repite ni vuelve a gastar caracteres; si una estaba hecha con LibreTranslate y luego pones la clave de Azure, se rehace con Azure una vez. Para ver cuánto llevas gastado este mes:

```bash
docker exec biblioteca_db psql -U biblioteca_user -d biblioteca_db -c "SELECT * FROM translation_usage;"
```

### 2. Backend

Copia la plantilla y rellena lo que necesites:

```bash
cp backend/.env.example backend/.env
```

Lo imprescindible es `JWT_SECRET` (una cadena larga y aleatoria) y `TWITCH_CLIENT_ID` /
`TWITCH_CLIENT_SECRET`; el `DATABASE_URL` de la plantilla ya apunta al contenedor de
`docker compose`. Steam y Azure son opcionales. Cada variable está explicada en
[`backend/.env.example`](backend/.env.example).

```bash
cd backend
npm install
npm run dev     # con nodemon; usa `npm start` para producción
```

Disponible en http://localhost:4000.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible en http://localhost:5173 (puerto por defecto de Vite).

## Ejecutar todo con Docker

Alternativa a la puesta en marcha manual: un solo comando levanta base de datos, backend y frontend. Solo necesitas `backend/.env` (el `DATABASE_URL` se sobrescribe dentro de Docker).

```bash
docker compose up -d --build
```

- Frontend: http://localhost:5173 (nginx)
- Backend: http://localhost:4000
- Traductor (LibreTranslate): http://localhost:5000
- Las tablas las crea el propio backend al arrancar (ejecuta `schema.sql`, que es idempotente), así que también se actualiza solo una base de datos antigua.
- Para pararlo: `docker compose down` (añade `-v` solo si quieres borrar los datos).
- Si cambias `VITE_API_URL`, reconstruye el frontend: la URL se incrusta al compilar (`docker compose build --build-arg VITE_API_URL=... frontend`).

## API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | No | Comprueba servidor y conexión a la base de datos |
| POST | `/auth/register` | No | Crea un usuario |
| POST | `/auth/login` | No | Inicia sesión y devuelve un token JWT |
| POST | `/auth/forgot-password` | No | Envía al email un código de 6 dígitos para restablecer la contraseña (`email`, y `idioma` opcional: `es` o `en`). Responde siempre `{ ok: true }`, exista o no la cuenta, para no revelar qué emails están registrados. Un código por minuto como máximo y cinco peticiones por hora y IP |
| POST | `/auth/reset-password` | No | Cambia la contraseña con el código recibido (`email`, `code`, `new_password`). El código caduca a los 15 minutos, se invalida a los 5 intentos fallidos y solo sirve una vez. 400 con "El código no es válido o ha caducado" para cualquier fallo del código |
| GET | `/games/search?q=<nombre>` | Bearer token | Busca juegos por nombre en IGDB |
| GET | `/games/details/:igdbId?lang=es` | Bearer token | Ficha completa de un juego desde IGDB: descripción (con `lang=es` se traduce al español con Azure Translator o, si no está disponible, con LibreTranslate, y se guarda en la tabla `translations`; si no responde ninguno, sale en inglés y `summary_lang` vale `en`), fecha de lanzamiento, desarrolladora, publishers, géneros, plataformas, nota, capturas (caché de 1 hora en memoria) |
| GET | `/games/artworks` | Bearer token | Ilustraciones oficiales (artworks) de IGDB de los juegos de tu biblioteca, agrupadas por juego (máx. 12 por juego, caché de 1 hora en memoria). Sirven para elegir la foto de perfil |
| POST | `/games` | Bearer token | Añade un juego a tu biblioteca (`igdb_id` y `name` obligatorios; 409 si ya lo tienes) |
| GET | `/games` | Bearer token | Lista los juegos de tu biblioteca |
| PATCH | `/games/:id` | Bearer token | Actualiza `status`, `rating`, `review` o `platform`. Los campos omitidos no cambian; enviar `null` borra `rating`, `review` o `platform` |
| DELETE | `/games/:id` | Bearer token | Elimina un juego de tu biblioteca |
| GET | `/profile` | Bearer token | Tus datos: usuario, email, bio, foto y fecha de alta |
| GET | `/profile/stats` | Bearer token | Estadísticas de tu biblioteca (juegos por estado, nota media) y tus 5 juegos mejor valorados |
| PATCH | `/profile` | Bearer token | Cambia `username`, `bio` y/o `avatar` (data URL JPG/PNG/WebP; `null` borra bio o foto). 409 si el usuario ya existe |
| PATCH | `/profile/email` | Bearer token | Cambia el email (`email` + `current_password`). 403 si la contraseña es incorrecta |
| PATCH | `/profile/password` | Bearer token | Cambia la contraseña (`current_password` + `new_password`). Cierra todas las demás sesiones abiertas y devuelve un `token` nuevo para la actual |
| DELETE | `/profile` | Bearer token | Borra tu cuenta y toda tu biblioteca (`password`) |
| GET | `/accounts` | Bearer token | Cuentas vinculadas del usuario y `steam_disponible` (si el servidor tiene `STEAM_API_KEY`) |
| PUT | `/accounts/steam` | Bearer token | Vincula una cuenta de Steam. `perfil` puede ser la URL del perfil, el nombre personalizado o el SteamID de 17 dígitos. No se elige nada más: la sincronización siempre añade los juegos que te faltan. 409 si ya hay una vinculada |
| POST | `/accounts/steam/sync` | Bearer token | Trae de Steam las horas y los logros de los juegos que ya tienes y añade los que te faltan (siempre). 422 si el perfil es privado; 409 si ya hay una sincronización en curso. No hace falta llamarlo a mano: el servidor lo hace solo cada `STEAM_SYNC_MINUTOS` y el frontend al abrir el perfil si los datos tienen más de 10 minutos |
| GET | `/accounts/steam/games/:id/achievements?lang=es` | Bearer token | Lista de logros de un juego de tu biblioteca (`:id` es el de `user_games`): nombre, descripción, icono, si lo tienes y cuándo. Se pide a Steam en el momento, sin guardarla. 404 si el juego no es de Steam |
| DELETE | `/accounts/steam` | Bearer token | Desvincula Steam y deja la biblioteca como antes de vincular: borra los juegos que añadió la importación (`user_games.imported_from = 'steam'`) y quita el progreso de Steam de los demás. Devuelve cuántos eliminó |

`status` admite `jugando`, `completado`, `abandonado` y `pendiente`; `rating` va de 1 a 10.

## Scripts

**Backend:** `npm run dev`, `npm start`, `npm test`
**Frontend:** `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm test`
**Escritorio** (`desktop/`): `npm start`, `npm run build:web`, `npm run dist` (ver [`desktop/README.md`](desktop/README.md))

Las pruebas (`npm test`) usan el ejecutor de pruebas que trae Node (`node --test`), sin
dependencias extra. Cubren la lógica pura: búsqueda, filtros y orden de la biblioteca, y la
lectura de logros de Steam con Steam simulado.

## Notas

- Todas las llamadas al backend pasan por `frontend/src/api.js` (`apiFetch`). La URL base es `http://localhost:4000` por defecto; para otro host define `VITE_API_URL` en `frontend/.env`.
- La columna `user_games.igdb_id` guarda el ID del juego en **IGDB**.
- El token JWT se guarda en `localStorage`.
- **Tarjetas de la biblioteca:** no llevan botones de Editar y Quitar. Salen con el **clic derecho** sobre la tarjeta (`MenuContextual.jsx`; con el teclado, la tecla de menú contextual o Mayús + F10 sobre el título; Mayús + clic derecho deja el menú del navegador) y dentro de la **ficha** que abre un clic normal (recuadro "En tu biblioteca"). Lo comparten la tarjeta, "Jugando ahora" y la ficha con `useAccionesJuego` y `VentanasJuego`. Cambiar el estado sigue estando en el chip de la tarjeta.
- La foto de perfil se guarda como texto (data URL en base64) en `users.avatar`; el navegador la recorta en cuadrado y la reduce a 256 px antes de enviarla. Puede ser una foto subida o una ilustración de IGDB de un juego de tu biblioteca: en el segundo caso el navegador descarga la ilustración (IGDB permite leer sus imágenes desde otras webs), te deja ajustar el encuadre y guarda el recorte, igual que una foto subida; el backend no guarda ninguna URL de IGDB como avatar.
- **Filtrar, buscar y ordenar la biblioteca:** el estado, el género, la compañía (desarrolladoras y publishers juntas) y la plataforma se combinan entre sí. El buscador mira a la vez el nombre, las compañías, los géneros y la plataforma, sin distinguir mayúsculas ni acentos, y con varias palabras exige que cada una aparezca en algún sitio del juego ("nintendo zelda"). Se ordena por fecha de adición, nombre, tiempo jugado, logros completados, tu nota, la nota de IGDB o lanzamiento, en los dos sentidos (`frontend/src/ordenFiltros.js`); género y compañía no son criterios de orden (un juego puede tener varios), para eso están el filtro y la búsqueda. Todo se hace en el navegador sobre la lista que ya llega. El género, las empresas, la fecha y la nota de IGDB se guardan en `user_games` (`genres`, `developers`, `publishers`, `release_date`, `igdb_rating`, `metadata_at`): `GET /games` rellena en una sola consulta a IGDB los juegos que aún no los tienen y los refresca pasado un mes; si IGDB falla, la lista sale igual y se reintenta en la siguiente visita. Los géneros y los modos de juego se guardan tal como los da IGDB (en inglés, son la clave del filtro) y se traducen solo al mostrarlos, con las tablas de `frontend/src/terminosIgdb.js` (el buscador entiende los dos idiomas: "rol" y "rpg" encuentran lo mismo). Las empresas y las plataformas son nombres propios y no se traducen; un género nuevo que IGDB añada se ve en inglés hasta que se añada a la tabla.
- **Steam:** es la única plataforma con una API oficial para leer la biblioteca de un jugador, por eso es la única que se puede vincular. Hace falta que el perfil tenga los "Detalles del juego" en público. No se guarda ninguna contraseña: solo el SteamID (dato público) en `linked_accounts`; las consultas las hace el backend con su propia `STEAM_API_KEY`. Steam identifica los juegos con su `appid` y la biblioteca usa ids de IGDB, así que al sincronizar se emparejan con el campo `external_games` de IGDB (los que no tienen equivalente no se pueden importar). El progreso se guarda en `user_games` (`steam_appid`, `playtime_minutes`, `achievements_unlocked`, `achievements_total`). La importación de juegos nuevos es siempre (ya no es opcional: antes se elegía al vincular con `linked_accounts.import_games`, una columna que `schema.sql` elimina) y los juegos que trae entran como **Pendiente**: Steam no guarda si te has pasado un juego, así que el estado lo cambia el usuario a mano, como en el resto de la biblioteca. **La sincronización es automática:** `services/sincronizacionAutomatica.js` revisa cada pocos minutos las cuentas que llevan más de `STEAM_SYNC_MINUTOS` (60 por defecto) sin sincronizarse y las sincroniza de una en una; además, el frontend la lanza al abrir el perfil si hace más de 10 minutos (o nunca se hizo). Cada sincronización gasta una consulta a Steam por juego jugado y la clave tiene un tope de 100.000 al día, así que no conviene bajar mucho el intervalo. Quedan marcados con `user_games.imported_from = 'steam'`, para poder borrarlos al desvincular sin tocar los que añadiste tú.
- **Perfil (`/perfil`):** un banner con el avatar, la bio y tres cifras (juegos, nota media y % completados) sobre un fondo fijo con los colores de la marca (una aurora violeta, azul y cian con una rejilla tenue, solo CSS), y debajo cuatro pestañas: Estadísticas, Editar perfil, Cuentas vinculadas y Seguridad. La pestaña va en la URL (`/perfil?tab=cuentas`), se maneja con las flechas del teclado y los cuatro paneles siguen montados al cambiar, así que lo que escribes en "Editar perfil" no se pierde. Todos los campos de contraseña (`CampoContrasena.jsx`) tienen un ojo para verla, y la nueva muestra sus requisitos en vivo. Al vincular Steam, `ConexionSteam.jsx` anima la conexión y avisa con `animationend` (no con temporizadores) cuando termina.
- Las credenciales de `docker-compose.yml` son solo para desarrollo; cámbialas en cualquier otro entorno.
- `backend/.env` contiene secretos y git lo ignora: nunca lo subas ni lo pegues en un chat.

## Licencia y créditos

El código de GameHub se distribuye bajo la licencia **MIT** (ver [`LICENSE`](LICENSE)): puedes
usarlo, modificarlo y compartirlo, conservando el aviso de copyright.

Lo que **no** es del proyecto y mantiene sus propios términos:

- **Datos de los juegos** (nombres, portadas, capturas, descripciones, notas): vienen de
  [IGDB](https://www.igdb.com), propiedad de Twitch, y se usan conforme a los términos de su API.
- **Steam** y su logo son marcas de Valve Corporation. GameHub no está afiliado ni respaldado
  por Valve; el logo solo indica que una cuenta o un juego vienen de Steam. Los datos se
  obtienen de la Steam Web API.
- **Iconos de plataformas** (PlayStation, Xbox, Nintendo, Apple, Android, Linux…): trazados de
  [Simple Icons](https://simpleicons.org) (CC0). Las marcas pertenecen a sus dueños y se usan
  solo para identificar la plataforma.
- **Tipografías** Barlow Condensed y Figtree, bajo la licencia SIL Open Font License, servidas
  con los paquetes `@fontsource`.
- **Traducciones automáticas** de las descripciones: Azure AI Translator (Microsoft) o
  LibreTranslate.

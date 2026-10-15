# Guía de desarrollo

Todo lo que necesitas para trabajar en GameHub: montar el entorno, retomar el trabajo cada
día, entender cómo está hecho, probarlo y publicar una versión. Si solo quieres usar la app,
mira el [README](../README.md).

## Índice

1. [Requisitos](#1-requisitos)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Primera instalación](#3-primera-instalación)
4. [Trabajar día a día](#4-trabajar-día-a-día)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Base de datos](#6-base-de-datos)
7. [Referencia de la API](#7-referencia-de-la-api)
8. [Scripts y pruebas](#8-scripts-y-pruebas)
9. [Cómo está hecho (notas técnicas)](#9-cómo-está-hecho-notas-técnicas)
10. [Convenciones del código](#10-convenciones-del-código)
11. [Publicar una versión](#11-publicar-una-versión)
12. [Tareas habituales](#12-tareas-habituales)
13. [Problemas frecuentes](#13-problemas-frecuentes)
14. [Checklist de cierre](#14-checklist-de-cierre)

Otras guías: [`DESPLIEGUE.md`](DESPLIEGUE.md) (poner el servidor en internet),
[`desktop/README.md`](../desktop/README.md) (la app de escritorio),
[`frontend/README.md`](../frontend/README.md) y
[`frontend/src/estilos/LEEME.md`](../frontend/src/estilos/LEEME.md) (los estilos).

---

## 1. Requisitos

- Node.js 22 y npm
- Docker y Docker Compose (en WSL2, Docker Desktop abierto)
- Credenciales de la API de Twitch/IGDB (`TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`), desde
  <https://dev.twitch.tv/console>
- Opcional: una clave de Azure AI Translator (`AZURE_TRANSLATOR_KEY` y
  `AZURE_TRANSLATOR_REGION`) para mejorar la traducción de las descripciones
- Opcional: una [clave de la API web de Steam](https://steamcommunity.com/dev/apikey)
  (`STEAM_API_KEY`, gratuita) para vincular cuentas de Steam
- Opcional: una cuenta de [Brevo](https://www.brevo.com) para enviar el correo de recuperación
  de contraseña (sin ella, en desarrollo el correo se escribe en la consola del backend)

### Tecnologías

| Capa | Tecnologías |
|------|-------------|
| Interfaz | React 19, React Router 7, Vite 8 |
| Escritorio | Electron, electron-builder, electron-updater |
| Backend | Node.js 22, Express 5, JWT, bcrypt, pg (sin ORM, a propósito), axios, helmet, express-rate-limit |
| Base de datos | PostgreSQL 16 |
| Servicios externos | IGDB (datos de juegos), Steam Web API (horas y logros), Azure Translator o LibreTranslate (traducción), Brevo (correo) |
| Despliegue | Render (backend) + Neon (PostgreSQL); instalador de Windows con GitHub Actions; Docker Compose para desarrollo |

## 2. Estructura del proyecto

```
GameHub/
├── backend/                 # API: Express + PostgreSQL
│   ├── src/
│   │   ├── app.js               # Arranque, seguridad (helmet, CORS, límites) y rutas
│   │   ├── routes/              # Qué URL llama a qué controlador
│   │   ├── controllers/         # Lógica de cada ruta: auth, games, profile, accounts, users, friends
│   │   ├── middleware/          # Sesión (JWT, con versión por usuario) y límites de intentos
│   │   ├── services/            # IGDB, Steam, traducción, correo, recuperación de contraseña,
│   │   │                        # emisión de tokens, sincronización automática, privacidad
│   │   │                        # (qué ve cada persona), amistades (SQL común) y estadísticas
│   │   ├── models/sql/schema.sql  # Esquema de la BD (idempotente: se aplica al arrancar)
│   │   └── config/              # db.js (conexión), validacion.js (reglas de email, contraseña,
│   │                            # usuario y perfil) y paises.js (códigos ISO)
│   ├── test/                    # Pruebas (npm test)
│   ├── .env.example             # Plantilla de variables de entorno
│   └── Dockerfile
├── frontend/                # Interfaz React, para web y escritorio
│   ├── src/                     # Componentes .jsx, y sesion.js / validacion.js / telefono.js /
│   │                            # paises.js / privacidad.js / tiempo.js / terminosIgdb.js
│   │   ├── estilos/             # CSS por zonas (ver estilos/LEEME.md)
│   │   └── textos/              # Traducciones es/en
│   └── test/                    # Pruebas (npm test)
├── desktop/                 # App de escritorio con Electron
│   ├── main.js                  # Ventana, interfaz, seguridad y actualizaciones
│   ├── actualizaciones.js       # Textos y reglas de los avisos de actualización
│   ├── scripts/                 # build-web.mjs (compila la interfaz) y notas-release.js
│   └── test/                    # Pruebas (npm test)
├── docs/
│   ├── DESARROLLO.md            # Esta guía
│   └── DESPLIEGUE.md            # Cómo poner el servidor en internet
├── .github/workflows/       # Compila y publica el instalador de Windows
├── docker-compose.yml       # PostgreSQL, traductor local y backend + frontend en Docker
├── render.yaml              # Plano para desplegar el backend en Render
├── CHANGELOG.md             # Qué cambia en cada versión (de aquí salen las notas de las Releases)
└── LICENSE                  # MIT
```

## 3. Primera instalación

> ¿Ya lo tienes instalado y solo quieres retomar el trabajo? Salta a
> [Trabajar día a día](#4-trabajar-día-a-día).

### 3.1 Base de datos y traductor

```bash
docker compose up -d postgres traductor
```

Levanta PostgreSQL en `localhost:5432` con usuario `biblioteca_user`, contraseña
`biblioteca_pass` y base de datos `biblioteca_db` (datos persistidos en el volumen `pgdata`), y el
traductor en `localhost:5000`.

Las descripciones de los juegos, que IGDB solo da en inglés, se traducen al español con **dos
traductores**:

1. **[Azure AI Translator](https://azure.microsoft.com/products/ai-services/ai-translator)**
   (opcional, mejor calidad): si defines `AZURE_TRANSLATOR_KEY` en `backend/.env`, se usa
   primero. Su plan gratuito (F0) da 2 millones de caracteres al mes. La app se pone un tope
   propio de **1,9 millones al mes** (`AZURE_TRANSLATOR_LIMITE_MENSUAL`): cuenta en la base de
   datos (tabla `translation_usage`) los caracteres que envía y, al llegar al tope, deja de
   usar Azure hasta el mes siguiente, para no depender de lo que haga Microsoft al pasarse del
   límite.
2. **[LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)** (el contenedor
   `traductor`): corre en local, sin cuenta ni claves. Es la reserva cuando no hay clave de
   Azure, se alcanza el tope o Azure falla. La primera vez descarga los modelos de traducción
   (tarda unos minutos; se guardan en el volumen `lt_models`) y ocupa cerca de 1 GB de RAM.

Si no hay ninguno de los dos, las descripciones salen en inglés. Cada traducción se guarda en la
base de datos (tabla `translations`), así que no se repite ni vuelve a gastar caracteres; si una
estaba hecha con LibreTranslate y luego pones la clave de Azure, se rehace con Azure una vez.
Para ver cuánto llevas gastado este mes:

```bash
docker exec biblioteca_db psql -U biblioteca_user -d biblioteca_db -c "SELECT * FROM translation_usage;"
```

### 3.2 Backend

Copia la plantilla y rellena lo que necesites:

```bash
cp backend/.env.example backend/.env
```

Lo imprescindible es `JWT_SECRET` (una cadena larga y aleatoria) y `TWITCH_CLIENT_ID` /
`TWITCH_CLIENT_SECRET`; el `DATABASE_URL` de la plantilla ya apunta al contenedor de
`docker compose`. Para generar un `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Steam, Azure y Brevo son opcionales. Cada variable está explicada en
[`backend/.env.example`](../backend/.env.example) y resumida en
[Variables de entorno](#5-variables-de-entorno).

```bash
cd backend
npm install
npm run dev     # con nodemon; usa `npm start` para producción
```

Disponible en <http://localhost:4000>.

### 3.3 Frontend

```bash
cd frontend
npm install
npm run dev
```

Disponible en <http://localhost:5173> (puerto por defecto de Vite).

### 3.4 App de escritorio (opcional)

Hace falta solo si vas a tocar `desktop/`. Mira [`desktop/README.md`](../desktop/README.md).

## 4. Trabajar día a día

Abre **Docker Desktop** (si usas WSL2) antes de nada. Todos los comandos parten de la raíz del
proyecto.

### Dos formas de trabajar

| Modo | Cuándo usarlo | Terminales | Recarga al guardar |
|------|---------------|------------|--------------------|
| **A. Todo en Docker** | Usar la app, enseñarla, comprobar que funciona "como en producción" | 1 | No: hay que reconstruir |
| **B. Desarrollo** | Programar y ver los cambios al instante | 3 | Sí (nodemon y Vite) |

> ⚠️ **No mezcles los dos modos.** Ambos usan los puertos 4000 y 5173: si tienes el modo A
> encendido, `npm run dev` fallará con `EADDRINUSE`. Para cambiar de modo, para primero el otro
> (`docker compose stop backend frontend`).

### Modo A: todo en Docker

Solo necesitas `backend/.env` (el `DATABASE_URL` se sobrescribe dentro de Docker).

```bash
docker compose up -d --build
```

| Servicio | Contenedor | URL |
|----------|------------|-----|
| Frontend (nginx) | `biblioteca_frontend` | <http://localhost:5173> |
| Backend (Express) | `biblioteca_backend` | <http://localhost:4000> |
| PostgreSQL | `biblioteca_db` | `localhost:5432` |
| Traductor (LibreTranslate) | `biblioteca_traductor` | <http://localhost:5000> |

- `up` crea y arranca los contenedores; `-d` los deja en segundo plano; `--build` reconstruye las
  imágenes si cambiaste código. Si no tocaste nada, puedes omitirlo.
- **Los cambios de código no se ven solos:** el código se copia dentro de la imagen al
  construirla. Tras editar, vuelve a ejecutar `docker compose up -d --build` (o solo
  `docker compose up -d --build backend`).
- Los contenedores **no** se arrancan solos al abrir Docker Desktop (el compose no define
  `restart`, y el valor por defecto es `no`). Solo se encienden cuando tú ejecutas
  `docker compose up`.
- Los datos viven en el volumen `pgdata`, así que **sobreviven** a parar o recrear los
  contenedores.
- Si cambias `VITE_API_URL`, reconstruye el frontend: la URL se incrusta al compilar
  (`docker compose build --build-arg VITE_API_URL=... frontend`).

#### Comandos de Docker Compose que más vas a usar

| Comando | Qué hace |
|---------|----------|
| `docker compose ps` | Estado de los contenedores |
| `docker compose logs -f backend` | Logs del backend en vivo (`Ctrl+C` para salir; cambia `backend` por `frontend` o `postgres`) |
| `docker compose restart backend` | Reinicia un servicio (útil tras cambiar `backend/.env`) |
| `docker compose stop` | Para todo sin borrar nada |
| `docker compose start` | Arranca de nuevo lo parado |
| `docker compose down` | Para y **elimina los contenedores** (los datos se conservan) |
| `docker compose build --no-cache backend` | Reconstruye una imagen desde cero si algo raro persiste |

### Modo B: desarrollo con recarga automática

Necesitas **tres terminales** (en VS Code: `` Ctrl+` `` y el botón `+`).

| # | Qué | Comando | Resultado esperado |
|---|-----|---------|--------------------|
| 1 | Base de datos y traductor | `docker compose up -d postgres traductor` | Contenedores `biblioteca_db` en `localhost:5432` y `biblioteca_traductor` en `localhost:5000` |
| 2 | Backend | `cd backend && npm run dev` | `Servidor corriendo en http://localhost:4000` |
| 3 | Frontend | `cd frontend && npm run dev` | App en <http://localhost:5173> |

**El orden importa:** el backend necesita la base de datos al arrancar, y el frontend necesita
el backend para funcionar.

**Importante:** en el paso 1 se indica `postgres` a propósito. Un `docker compose up -d` a secas
levantaría también los contenedores de backend y frontend, que ocuparían los puertos 4000 y
5173.

En este modo el `DATABASE_URL` de `backend/.env` usa `localhost` (el backend corre en tu
máquina). Dentro de Docker, el compose lo sobrescribe con `postgres`.

#### 1. Base de datos y traductor

```bash
docker compose up -d postgres traductor
docker compose ps
```

Debe aparecer `biblioteca_db` con estado `Up (healthy)`. El traductor (`biblioteca_traductor`)
tarda más en estar listo: la primera vez descarga los modelos de traducción (unos minutos).
Mientras no esté listo, las descripciones de los juegos salen en inglés.

#### 2. Backend (Express)

```bash
cd backend
npm run dev
```

`npm run dev` usa **nodemon**, que reinicia el servidor cada vez que guardas un archivo. No hace
falta volver a arrancarlo tras editar código (sí tras cambiar el `.env`: guarda cualquier
archivo de `src/` o escribe `rs` en esa terminal).

Comprueba que responde y que llega a la base de datos:

```bash
curl localhost:4000/health
```

Debe devolver `{"status":"ok", ...}`. Si devuelve error de base de datos, vuelve al paso 1.

#### 3. Frontend (React + Vite)

```bash
cd frontend
npm run dev
```

Abre <http://localhost:5173>. Vite recarga la página al guardar (HMR).

### Resumen de puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| PostgreSQL | 5432 | `postgresql://biblioteca_user:biblioteca_pass@localhost:5432/biblioteca_db` |
| Traductor | 5000 | <http://localhost:5000> |
| Backend | 4000 | <http://localhost:4000> |
| Frontend | 5173 | <http://localhost:5173> |

### Cómo apagarlo todo al terminar

| Qué | Cómo |
|-----|------|
| Modo A (todo en Docker) | `docker compose stop` (conserva todo) |
| Modo B: frontend y backend | `Ctrl+C` en cada terminal |
| Modo B: base de datos | `docker compose stop` (conserva los datos) |

Apagar es opcional: los contenedores pueden quedarse corriendo sin problema.

> ⚠️ **No uses `docker compose down -v`** salvo que quieras borrar la base de datos. La opción
> `-v` elimina el volumen `pgdata` y **con él todos los usuarios y juegos**.
> `docker compose down` (sin `-v`) solo elimina el contenedor y es seguro.

## 5. Variables de entorno

Las del backend van en `backend/.env` (git lo ignora: **nunca lo subas ni lo pegues en un
chat**). La plantilla comentada es [`backend/.env.example`](../backend/.env.example).

### Backend

| Variable | Para qué | Notas |
|----------|----------|-------|
| `PORT` | Puerto del servidor | 4000 por defecto |
| `NODE_ENV` | `development` o `production` | En `production` exige un `JWT_SECRET` de 32+ caracteres |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL | En Docker el compose la sobrescribe |
| `JWT_SECRET` | Firma de los tokens de sesión | **Obligatoria**: sin ella el servidor no arranca |
| `CORS_ORIGINS` | Orígenes que pueden llamar a la API, separados por comas | Vacío = cualquiera. La app de escritorio llama desde `app://gamehub` |
| `TRUST_PROXY` | Cuántos proxies hay delante (1 en Render) | Los límites de intentos lo necesitan para ver la IP real |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Credenciales de IGDB | Sin ellas, la búsqueda falla |
| `STEAM_API_KEY` | Clave de la Steam Web API | Sin ella no se puede vincular Steam |
| `STEAM_SYNC_MINUTOS` | Cada cuántos minutos se sincroniza Steam solo | 60 por defecto; 0 = desactivado |
| `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION` | Traducción con Azure | **No las pongas vacías ni inventadas** |
| `AZURE_TRANSLATOR_LIMITE_MENSUAL` | Tope propio de caracteres al mes | 1.900.000 por defecto |
| `AZURE_TRANSLATOR_ENDPOINT` | Otra dirección del servicio de Azure | Casi nunca hace falta |
| `TRANSLATE_URL` | LibreTranslate (reserva) | `http://localhost:5000`; en Docker se sobrescribe |
| `BREVO_API_KEY`, `CORREO_REMITENTE`, `CORREO_NOMBRE` | Correo de recuperación de contraseña | Sin la clave, en desarrollo el correo se escribe en la consola; en producción falla con aviso en los logs |

### Interfaz y escritorio

| Variable | Dónde | Para qué |
|----------|-------|----------|
| `VITE_API_URL` | `frontend/.env` | Dirección del backend. Se **incrusta al compilar**; por defecto `http://localhost:4000` |
| `VITE_DESKTOP` | La pone `desktop/scripts/build-web.mjs` | Activa `HashRouter` y las fuentes locales en la versión de escritorio |
| `GAMEHUB_API_URL` | Al ejecutar `npm run build:web` / `npm run dist` en `desktop/` | Servidor al que llamará la app instalada. En GitHub Actions es la variable del repositorio del mismo nombre |
| `GAMEHUB_DEV_URL` | Al ejecutar `npm start` en `desktop/` | Apunta Electron a un servidor de Vite en vez de a la interfaz compilada |

## 6. Base de datos

El esquema es [`backend/src/models/sql/schema.sql`](../backend/src/models/sql/schema.sql). Es
**idempotente** (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) y el backend lo ejecuta en
cada arranque, así que una base de datos nueva queda lista y una antigua se pone al día sola. Al
añadir una columna, hazlo con `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en ese mismo archivo.

Si un cambio necesita **convertir datos que ya existen**, se escribe también ahí, como un bloque
`DO $$ ... $$` que solo toque lo que aún no cumple la regla (así los arranques siguientes no
hacen nada). Ejemplo: los nombres de usuario antiguos se pasan a minúsculas, sin tildes y con
`_` en lugar de espacios; si dos quedan iguales, el segundo recibe un número (`ana`, `ana2`).
Después se añade la regla como `CHECK` (con una comprobación en `pg_constraint`, porque
`ADD CONSTRAINT` no tiene `IF NOT EXISTS`).

| Tabla | Qué guarda |
|-------|------------|
| `users` | Usuarios: nombre de usuario, email, hash de la contraseña (bcrypt), foto (`avatar`, data URL), bio, `token_version` y datos personales opcionales (`first_name`, `last_name`, `birth_date`, `gender`, `location`, `country`, `phone`). Se guarda la fecha de nacimiento y no la edad, que se calcularía mal con el tiempo |
| `user_games` | Un juego en la biblioteca de un usuario: `igdb_id`, estado, nota, reseña, plataforma, metadatos de IGDB (`genres`, `developers`, `publishers`, `release_date`, `igdb_rating`) y el progreso de Steam (`steam_appid`, `playtime_minutes`, `achievements_*`, `imported_from`) |
| `translations` | Caché de traducciones de descripciones, por huella SHA-256 del texto y idioma |
| `translation_usage` | Caracteres enviados a Azure cada mes (para respetar el tope propio) |
| `linked_accounts` | Cuentas vinculadas (hoy solo Steam): el SteamID público y la fecha de la última sincronización |
| `password_resets` | Código vigente de recuperación de contraseña de cada usuario (solo su huella, caducidad e intentos) |
| `friendships` | Amistades y solicitudes: una fila por pareja (índice único sobre `LEAST/GREATEST` de los dos ids, así (1,2) y (2,1) son la misma), con `status` `pendiente` o `aceptada` |
| `blocks` | Bloqueos: quién ha bloqueado a quién |

### Mirar la base de datos con psql

```bash
docker exec -it biblioteca_db psql -U biblioteca_user -d biblioteca_db
```

Dentro de `psql`:

```sql
\dt                          -- lista las tablas
SELECT id, username FROM users;
SELECT id, user_id, name, status, rating FROM user_games;
\q                           -- salir
```

Consulta rápida sin entrar al modo interactivo:

```bash
docker exec biblioteca_db psql -U biblioteca_user -d biblioteca_db -c "SELECT * FROM users;"
```

### Crear o actualizar las tablas

No hay que hacer nada: **reinicia el backend** y la base de datos se pone al día. Si alguna vez
necesitas aplicarlo a mano (sin el backend):

```bash
docker exec -i biblioteca_db psql -U biblioteca_user -d biblioteca_db < backend/src/models/sql/schema.sql
```

## 7. Referencia de la API

Todas las rutas con `Bearer token` necesitan la cabecera `Authorization: Bearer <token>` (el
token lo devuelve `/auth/login`). Los errores llegan como `{ "error": "texto" }` en español.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | No | Comprueba servidor y conexión a la base de datos |
| POST | `/auth/register` | No | Crea un usuario (`username` de 3 a 20 caracteres con solo `a-z`, `0-9` y `_`, **ya en minúsculas**; `email` con formato válido y `password` de 8+ con mayúscula, minúscula y número; 400 si no, 409 si el email o el nombre ya existen) |
| POST | `/auth/login` | No | Inicia sesión y devuelve un token JWT. `identifier` es el email o el nombre de usuario (este se acepta también con mayúsculas: se busca en minúsculas). Sigue valiendo el campo antiguo `email`, que mandan las apps de escritorio ya instaladas |
| POST | `/auth/forgot-password` | No | Envía al email un código de 6 dígitos para restablecer la contraseña (`email`, y `idioma` opcional: `es` o `en`). Responde siempre `{ ok: true }`, exista o no la cuenta, para no revelar qué emails están registrados. Un código por minuto como máximo y cinco peticiones por hora y IP |
| POST | `/auth/reset-password` | No | Cambia la contraseña con el código recibido (`email`, `code`, `new_password`). El código caduca a los 15 minutos, se invalida a los 5 intentos fallidos y solo sirve una vez. 400 con "El código no es válido o ha caducado" para cualquier fallo del código. Cierra todas las sesiones abiertas |
| GET | `/games/search?q=<nombre>` | Bearer token | Busca juegos por nombre en IGDB |
| GET | `/games/details/:igdbId?lang=es` | Bearer token | Ficha completa de un juego desde IGDB: descripción (con `lang=es` se traduce al español con Azure Translator o, si no está disponible, con LibreTranslate, y se guarda en la tabla `translations`; si no responde ninguno, sale en inglés y `summary_lang` vale `en`), fecha de lanzamiento, desarrolladora, publishers, géneros, plataformas, nota, capturas (caché de 1 hora en memoria) |
| GET | `/games/artworks` | Bearer token | Ilustraciones oficiales (artworks) de IGDB de los juegos de tu biblioteca, agrupadas por juego (máx. 12 por juego, caché de 1 hora en memoria). Sirven para elegir la foto de perfil |
| POST | `/games` | Bearer token | Añade un juego a tu biblioteca (`igdb_id` y `name` obligatorios; 409 si ya lo tienes) |
| GET | `/games` | Bearer token | Lista los juegos de tu biblioteca |
| PATCH | `/games/:id` | Bearer token | Actualiza `status`, `rating`, `review` o `platform`. Los campos omitidos no cambian; enviar `null` borra `rating`, `review` o `platform` |
| DELETE | `/games/:id` | Bearer token | Elimina un juego de tu biblioteca |
| GET | `/profile` | Bearer token | Tus datos: usuario, email, bio, foto, fecha de alta y datos personales (`first_name`, `last_name`, `birth_date`, `gender`, `location`, `country`, `phone`, y `age`, que se calcula con la fecha de nacimiento) |
| GET | `/profile/stats` | Bearer token | Estadísticas de tu biblioteca (juegos por estado, nota media) y tus 5 juegos mejor valorados |
| PATCH | `/profile` | Bearer token | Cambia `username` (mismas reglas que en el registro), `bio`, `avatar` (data URL JPG/PNG/WebP) los datos personales (todos opcionales) y la privacidad (`visibility_name`, `visibility_age`, `visibility_gender`, `visibility_location`, `visibility_library`, `visibility_reviews` y `visibility_friends`, cada una `nadie`/`amigos`/`todos`; `request_policy`: `todos`/`amigos_de_amigos`/`nadie`; `searchable`: booleano). Datos personales: `first_name` (50), `last_name` (100), `location` (100), `birth_date` (`AAAA-MM-DD`, real, no futura y de hace menos de 120 años), `gender` (`hombre`, `mujer` u `otro`), `country` (código ISO 3166-1 de dos letras en mayúsculas, de la lista de `config/paises.js`) y `phone` (internacional y válido: el servidor quita espacios, guiones y paréntesis, cambia un `00` inicial por `+` y lo comprueba con libphonenumber; se guarda como `+34600123456`). Campo ausente = no se toca; `null` (o texto vacío) borra el dato, salvo `username`. 409 si el usuario ya existe |
| PATCH | `/profile/email` | Bearer token | Cambia el email (`email` + `current_password`). 403 si la contraseña es incorrecta |
| PATCH | `/profile/password` | Bearer token | Cambia la contraseña (`current_password` + `new_password`). Cierra todas las demás sesiones abiertas y devuelve un `token` nuevo para la actual |
| DELETE | `/profile` | Bearer token | Borra tu cuenta y toda tu biblioteca (`password`) |
| GET | `/users/search?q=` | Bearer token | Personas cuyo nombre empieza por `q` (2 a 20 caracteres, hasta 20 resultados), con su relación contigo, `can_request` y amigos en común. No salen tú, quien te ha bloqueado, a quien has bloqueado ni quien ha desactivado `searchable` (salvo sus amigos). 60 búsquedas cada 5 minutos |
| GET | `/users/:username` | Bearer token | El perfil de otra persona con solo lo que puedes ver: `personal` solo lleva los datos permitidos, `library` va `null` si no, y trae amigos y juegos en común. 404 si no existe **o te ha bloqueado**; si la has bloqueado tú, solo lo mínimo con `relation: "bloqueado"` |
| GET | `/users/:username/games` | Bearer token | Su biblioteca (hasta 500 juegos, con `in_common` y tu estado y nota) si te la deja ver; 403 si no. El texto de la reseña solo sale si `visibility_reviews` lo permite |
| GET | `/users/:username/friends` | Bearer token | Su lista de amigos si te la deja ver (403 si no), con tu relación con cada uno |
| GET | `/users/:username/avatar` | No | La foto como imagen (`ETag`, `Cache-Control: no-cache`). Sin sesión porque un `<img>` no puede mandar `Authorization` |
| GET | `/friends` | Bearer token | Tus amigos, con `playing` (su juego "jugando" más reciente) y `games_count` si comparten su biblioteca con amigos |
| GET | `/friends/activity` | Bearer token | Los últimos 30 movimientos en la biblioteca de tus amigos (no cuenta lo importado de Steam sin tocar) |
| GET | `/friends/suggestions` | Bearer token | Amigos de tus amigos, por número de amigos en común (hasta 12) |
| GET | `/friends/requests` | Bearer token | Solicitudes: `received` y `sent` |
| GET | `/friends/requests/count` | Bearer token | Solo el número de solicitudes recibidas (`{ received }`): es lo que consulta la insignia de la barra cada minuto |
| POST | `/friends/requests` | Bearer token | Envía una solicitud (`username`). Si esa persona ya te había enviado una, se acepta. 409 si ya sois amigos, ya la enviaste o la has bloqueado; 403 si su `request_policy` no te deja; 30 por hora |
| POST | `/friends/requests/:id/accept` | Bearer token | Acepta una solicitud recibida (solo quien la recibió) |
| DELETE | `/friends/requests/:id` | Bearer token | Rechaza una recibida o cancela una enviada |
| DELETE | `/friends/:username` | Bearer token | Deja de ser amigo |
| GET | `/friends/blocks` | Bearer token | A quién has bloqueado |
| POST | `/friends/blocks` | Bearer token | Bloquea (`username`) y borra la amistad o solicitud que hubiera |
| DELETE | `/friends/blocks/:username` | Bearer token | Desbloquea (no devuelve la amistad) |
| GET | `/accounts` | Bearer token | Cuentas vinculadas del usuario y `steam_disponible` (si el servidor tiene `STEAM_API_KEY`) |
| PUT | `/accounts/steam` | Bearer token | Vincula una cuenta de Steam. `perfil` puede ser la URL del perfil, el nombre personalizado o el SteamID de 17 dígitos. No se elige nada más: la sincronización siempre añade los juegos que te faltan. 409 si ya hay una vinculada |
| POST | `/accounts/steam/sync` | Bearer token | Trae de Steam las horas y los logros de los juegos que ya tienes y añade los que te faltan (siempre). 422 si el perfil es privado; 409 si ya hay una sincronización en curso. No hace falta llamarlo a mano: el servidor lo hace solo cada `STEAM_SYNC_MINUTOS` y el frontend al abrir el perfil si los datos tienen más de 10 minutos |
| GET | `/accounts/steam/games/:id/achievements?lang=es` | Bearer token | Lista de logros de un juego de tu biblioteca (`:id` es el de `user_games`): nombre, descripción, icono, si lo tienes y cuándo. Se pide a Steam en el momento, sin guardarla. 404 si el juego no es de Steam |
| DELETE | `/accounts/steam` | Bearer token | Desvincula Steam y deja la biblioteca como antes de vincular: borra los juegos que añadió la importación (`user_games.imported_from = 'steam'`) y quita el progreso de Steam de los demás. Devuelve cuántos eliminó |

`status` admite `jugando`, `completado`, `abandonado` y `pendiente`; `rating` va de 1 a 10.

Límites de peticiones por IP (responden `429`): 10 inicios de sesión fallidos cada 15 minutos,
10 registros por hora, 5 códigos de recuperación pedidos por hora, 10 códigos probados cada 15
minutos y 1000 peticiones cada 15 minutos en total.

### Probar la API sin el frontend

```bash
# Registrar y entrar (guarda el token que devuelve el login)
curl -X POST localhost:4000/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"PRUEBA","email":"prueba@example.com","password":"Test1234!"}'
# identifier: el email o el nombre de usuario
curl -X POST localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"prueba@example.com","password":"Test1234!"}'

# Usar el token en una ruta protegida
curl localhost:4000/games -H "Authorization: Bearer TU_TOKEN"
```

## 8. Scripts y pruebas

| Dónde | Scripts |
|-------|---------|
| `backend/` | `npm run dev` (nodemon), `npm start`, `npm test` |
| `frontend/` | `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm test` |
| `desktop/` | `npm start`, `npm run build:web`, `npm run dist`, `npm test` (ver [`desktop/README.md`](../desktop/README.md)) |

Las pruebas (`npm test`) usan el ejecutor de pruebas que trae Node (`node --test`), sin
dependencias extra. Cubren la lógica que no necesita navegador ni servidor:

- **Backend:** lectura de logros de Steam (con Steam simulado), recuperación de contraseña
  (código y correo), validación de sesiones, validación del registro, inicio de sesión con
  email o nombre de usuario, edición del perfil (datos personales y privacidad), reglas de
  privacidad y validación de las rutas sociales.
- **Frontend:** búsqueda, filtros y orden de la biblioteca, traducción de géneros y modos de
  IGDB, reglas de validación y de privacidad (comprueban que coinciden con las del backend),
  tiempo relativo, teléfonos y países, y que todos los textos que usa el código existan.
- **Escritorio:** avisos de actualización, que el instalador incluya los archivos que carga
  `main.js` y la construcción de las notas de cada Release.

Para simular dependencias en las pruebas (la base de datos, Steam, axios) se sustituye el módulo
antes de cargarlo; hay ejemplos en `backend/test/sesiones.test.js` y `steamLogros.test.js`.

### Comprobar la calidad antes de subir

```bash
cd frontend
npm run lint     # revisa el código con ESLint
npm test
npm run build    # comprueba que compila para producción

cd ../backend && npm test
cd ../desktop && npm test
```

### Instalar dependencias

Solo hace falta si cambió `package.json` (por ejemplo tras un `git pull` o al añadir una
librería):

```bash
cd backend && npm install
cd frontend && npm install
cd desktop && npm install
```

## 9. Cómo está hecho (notas técnicas)

Decisiones y detalles que no se ven leyendo un solo archivo.

### Acceso al backend y sesión

- Todas las llamadas al backend pasan por `frontend/src/api.js` (`apiFetch`). La URL base es
  `http://localhost:4000` por defecto; para otro host define `VITE_API_URL` en `frontend/.env`.
  Los errores del backend (en español) se traducen al idioma de la interfaz con la tabla
  `erroresApi` de `textos/en.js`.
- El token JWT se guarda en `localStorage`, **siempre a través de `frontend/src/sesion.js`**.
  Dura 7 días y lleva la versión de sesión del usuario (`users.token_version`): el middleware
  la compara con la de la base de datos en cada petición (una consulta por la clave primaria).
  Cambiar o recuperar la contraseña la sube y cierra el resto de sesiones. Los tokens anteriores
  a existir la versión no llevan `v` y cuentan como 0.
- Las reglas de email, contraseña y nombre de usuario están en `backend/src/config/validacion.js`
  y `frontend/src/validacion.js`; **deben coincidir** (una prueba lo comprueba). El formulario
  las usa para avisar al momento, pero la que manda es la del servidor.
  `backend/src/config/validacion.js` **no puede importar paquetes de npm**: las pruebas del
  frontend lo cargan para comprobar que coincide, y el CI (`release.yml`) solo instala las
  dependencias del frontend y del escritorio. Lo que necesita una librería va aparte (la
  validación de teléfonos, con libphonenumber, está en `services/telefono.js`). Si no, la
  Release falla en "Pruebas de la interfaz" con "Cannot find module".
- **Nombre de usuario:** `^[a-z0-9_]{3,20}$`. Solo minúsculas hace que sea único sin
  ambigüedad (`ana` y `Ana` serían los dos `ana`) y no admite `@`, así que al iniciar sesión un
  texto con `@` es un email y uno sin `@` es un nombre. El campo del formulario lo deja listo
  al escribir (`normalizarUsername`); el servidor no lo arregla, lo rechaza. La misma regla es
  un `CHECK` en `schema.sql`, y ese archivo convierte los nombres antiguos al arrancar (ver
  la sección de la base de datos).
- **País:** se guarda como código (`ES`), no como nombre: el nombre depende del idioma y lo
  pone el navegador con `Intl.DisplayNames` (`frontend/src/paises.js`). La lista está en
  `backend/src/config/paises.js` y en `frontend/src/paises.js` (una prueba exige que coincidan).
- **Teléfono:** se guarda en formato E.164 (`+34600123456`). El servidor lo valida con
  [libphonenumber-js](https://www.npmjs.com/package/libphonenumber-js) (`limpiarTelefono`): sabe
  qué prefijos existen y qué longitudes y comienzos admite cada país, y rechaza una extensión
  (`ext 2`) en vez de descartarla en silencio. En el formulario el prefijo y el número van
  separados (`CampoTelefono`, con la lógica sin React en `frontend/src/telefono.js`): el prefijo
  se elige de la lista o se escribe con `+`/`00` en el campo del número, y `componerTelefono`
  lo junta interpretando el número como lo escribiría alguien de ese país (quita el `0` inicial
  del Reino Unido, por ejemplo). Es un dato de contacto: **no se muestra en el banner**, y al
  hacer públicos los perfiles (1.3) tendrá que seguir privado por defecto. No hay verificación
  por SMS.
- Un 401 significa "sesión caducada" y el frontend cierra la sesión; por eso una contraseña
  incorrecta al confirmar un cambio responde **403**, no 401.

### Recuperación de contraseña

Se usa un **código de 6 dígitos y no un enlace**, porque la app de escritorio carga desde
`app://gamehub` y un enlace del correo no puede abrirla.

- `POST /auth/forgot-password` responde siempre lo mismo, exista o no el email, y envía el correo
  sin esperarlo (si no, la respuesta tardaría más cuando la cuenta existe y delataría).
- En la tabla `password_resets` hay **una fila por usuario**: un HMAC del código con
  `JWT_SECRET`, la caducidad (15 min) y los intentos. Pedir otro código sustituye al anterior,
  y como mucho se puede pedir uno por minuto.
- `POST /auth/reset-password` **gasta un intento antes de comprobar el código**, en la misma
  sentencia que lo busca; si comprobara primero y contara después, peticiones simultáneas
  podrían probar muchos códigos antes de que ninguna sumase su intento. Con 5 intentos fallidos,
  el código deja de valer.
- El correo sale por la **API HTTP de Brevo** (`services/correoService.js`), no por SMTP: Render
  bloquea los puertos SMTP en el plan gratuito. Brevo no permite autenticar remitentes de Gmail
  y similares, así que con un remitente de Gmail la dirección que ve el destinatario es una de
  `brevosend.com`; con un dominio propio, basta autenticarlo en Brevo y cambiar
  `CORREO_REMITENTE`.
- Sin `BREVO_API_KEY`, en desarrollo el correo (con el código) se escribe entero en la consola
  del backend.

### Traducción de descripciones

`services/traduccionService.js` usa Azure primero (si hay clave y no se ha llegado al tope
mensual propio) y LibreTranslate de reserva. Cada texto se traduce **una sola vez por idioma** y
se guarda en `translations`, con la huella SHA-256 del original como clave. En producción
(Render) no hay LibreTranslate: sin clave de Azure, las descripciones salen en inglés.

### Géneros y modos de juego de IGDB

Se guardan en la base de datos **tal como los da IGDB** (en inglés), porque son la clave de los
filtros, y se traducen solo al mostrarlos con las tablas de `frontend/src/terminosIgdb.js` (y
las claves `genero.*` y `modo.*` de `textos/`). El buscador entiende los dos idiomas: "rol" y
"rpg" encuentran lo mismo. Un nombre que no esté en la tabla se ve en inglés. Las compañías y
las plataformas son nombres propios y no se traducen. Si IGDB añade un género, añádelo a
`GENEROS` (hay una prueba que exige que cada entrada tenga texto en los dos idiomas).

### Filtrar, buscar y ordenar la biblioteca

El estado, el género, la compañía (desarrolladoras y publishers juntas) y la plataforma se
combinan entre sí. El buscador mira a la vez el nombre, las compañías, los géneros y la
plataforma, sin distinguir mayúsculas ni acentos, y con varias palabras exige que cada una
aparezca en algún sitio del juego ("nintendo zelda"). Se ordena por fecha de adición, nombre,
tiempo jugado, logros completados, tu nota, la nota de IGDB o lanzamiento, en los dos sentidos
(`frontend/src/ordenFiltros.js`, funciones puras con pruebas). **Género y compañía no son
criterios de orden** (un juego puede tener varios), para eso están el filtro y la búsqueda. Los
juegos sin el dato van siempre al final. Todo se hace en el navegador sobre la lista que ya
llega.

El género, las empresas, la fecha y la nota de IGDB se guardan en `user_games` (`genres`,
`developers`, `publishers`, `release_date`, `igdb_rating`, `metadata_at`): `GET /games` rellena
en una sola consulta a IGDB los juegos que aún no los tienen y los refresca pasado un mes; si
IGDB falla, la lista sale igual y se reintenta en la siguiente visita. Las fechas `DATE` se
leen como texto (`types.setTypeParser(1082)` en `config/db.js`) para evitar el desfase de zona
horaria.

### Steam

Es la única plataforma con una API oficial para leer la biblioteca de un jugador (PSN, Xbox y
Epic se descartaron), por eso es la única que se puede vincular.

- Hace falta que el perfil tenga los "Detalles del juego" en público. Para vincular hay que
  pegar la URL del perfil: el nombre visible no sirve, solo la URL personalizada o el SteamID.
- No se guarda ninguna contraseña: solo el SteamID (dato público) en `linked_accounts`. Las
  consultas las hace el backend con su propia `STEAM_API_KEY`.
- Steam identifica los juegos con su `appid` y la biblioteca usa ids de IGDB, así que al
  sincronizar se emparejan con el campo `external_games` de IGDB (los que no tienen equivalente
  no se pueden importar).
- La importación de juegos nuevos es **siempre** (no es opcional) y los juegos entran como
  **Pendiente**: Steam no guarda si te has pasado un juego, así que no se estima. Quedan
  marcados con `user_games.imported_from = 'steam'` para poder borrarlos al desvincular sin
  tocar los que añadió el usuario.
- **La sincronización es automática:** `services/sincronizacionAutomatica.js` revisa cada pocos
  minutos las cuentas que llevan más de `STEAM_SYNC_MINUTOS` sin sincronizarse y las sincroniza
  de una en una; además, el frontend la lanza al abrir el perfil si hace más de 10 minutos.
- Cada sincronización gasta una consulta a Steam por juego jugado y la clave tiene un tope de
  100.000 al día para **todos** los usuarios, así que no conviene bajar mucho el intervalo.
- La lista de logros no se guarda: el frontend la pide a Steam al abrir el desplegable por
  primera vez. `achievements_*` en `user_games` son solo contadores.
- Con el planificador activo, un backend de pruebas contra una base de datos real sincroniza
  también las cuentas reales: arráncalo con `STEAM_SYNC_MINUTOS=0`.

### Perfil

- **`/perfil`:** un banner con el avatar, la bio y tres cifras (juegos, nota media y %
  completados) sobre un fondo fijo con los colores de la marca (una aurora violeta, azul y cian
  con una rejilla tenue, solo CSS), y debajo cinco pestañas: Estadísticas, Editar perfil,
  Privacidad, Cuentas vinculadas y Seguridad. La pestaña va en la URL (`/perfil?tab=cuentas`),
  se maneja con las flechas del teclado y los paneles siguen montados al cambiar, así que lo
  que escribes en "Editar perfil" no se pierde.
- **Privacidad (`PanelPrivacidad.jsx`):** una tabla de "quién ve qué" calculada en el cliente
  con lo elegido (`privacidad.js`), y los ajustes en tarjetas. No hay botón Guardar: cada
  cambio se envía al momento con actualización optimista y, si el servidor lo rechaza, vuelve
  al valor anterior. Las reglas y su porqué están en "Social y perfiles públicos".
- **Seguridad:** el email se ve como dato y los campos para cambiarlo salen al pulsar "Cambiar
  email". La contraseña de confirmación usa `autocomplete="new-password"` a propósito, para que
  el navegador no la rellene solo y el cambio no parezca hacerse sin pedirla. Todos los campos
  de contraseña (`CampoContrasena.jsx`) tienen un ojo para verla, y la nueva muestra sus
  requisitos en vivo (`RequisitosContrasena.jsx`).
- **Foto de perfil:** se guarda como texto (data URL en base64) en `users.avatar`; el navegador
  la recorta en cuadrado y la reduce a 256 px antes de enviarla. Puede ser una foto subida o una
  ilustración de IGDB de un juego de tu biblioteca: en el segundo caso el navegador descarga la
  ilustración (IGDB permite leer sus imágenes desde otras webs), te deja ajustar el encuadre y
  guarda el recorte, igual que una foto subida; el backend no guarda ninguna URL de IGDB como
  avatar.
- Al vincular Steam, `ConexionSteam.jsx` anima la conexión y avisa con `animationend` (no con
  temporizadores) cuando termina.

### Social y perfiles públicos

- **Dónde está cada cosa.** Backend: `services/privacidad.js` (la regla de qué ve cada persona,
  sin base de datos), `services/amistades.js` (trozos de SQL que se repiten: amigos de una
  persona, amigos en común, si puede enviarle solicitud, sin bloqueos),
  `controllers/userController.js` (buscar, perfil, biblioteca, amigos y foto de otra persona) y
  `controllers/friendController.js` (amistades, solicitudes, bloqueos, actividad y
  sugerencias). Frontend: `Social.jsx` (la página, con las pestañas del perfil),
  `Actividad.jsx`, `Descubrir.jsx`, `RejillaPersonas.jsx` + `TarjetaPersona.jsx`,
  `AccionAmistad.jsx` (los botones según la relación; los usan el perfil de otra persona y
  todas las listas), `PerfilPublico.jsx` (con `BibliotecaAjena.jsx`, `AmigosAjenos.jsx` y
  `AvisoPrivado.jsx`) y `PanelPrivacidad.jsx` (la pestaña *Perfil → Privacidad*).
- **Relación.** Entre dos personas puede ser `self`, `amigos`, `enviada`, `recibida` o `ninguna`;
  el bloqueo va aparte. Cada dato tiene un nivel (`nadie`, `amigos`, `todos`) y
  `puedeVer(nivel, relacion)` decide. Ante un nivel que no conoce, no enseña. Los datos
  personales se deciden uno a uno (`datosPersonalesVisibles`): el que no se ve ni aparece en
  el objeto, para que ni se sepa que está relleno.
- **Qué no sale nunca de la API de otras personas:** email, teléfono y fecha de nacimiento
  (de la fecha solo se calcula la edad). Hay una prueba contra Postgres real que lo comprueba.
- **Defensa en las consultas.** Cuando una persona te ha bloqueado, `GET /users/:username`,
  la búsqueda y las solicitudes responden como si no existiera (404): no revelan que tiene
  cuenta. La búsqueda usa `starts_with` y no `LIKE`, porque en un `LIKE` el guion bajo (que
  un nombre puede llevar) es un comodín.
- **Lista de amigos y amigos en común.** Cada persona decide quién ve *su* lista. Un amigo en
  común solo cuenta si ese amigo no tiene su lista en "nadie" (si no, se deduciría su amistad
  con otra persona). Las sugerencias usan solo amigos que no esconden su lista.
- **Actividad.** No hay tabla de eventos: salen de `user_games`. `updated_at` solo cambia cuando
  la persona edita un juego (la sincronización de Steam no lo toca), así que sirve de reloj.
  Un juego es un movimiento si lo añadió ella (`imported_from IS NULL`) o lo editó después de
  importarlo; los que entran de golpe al importar Steam no cuentan.
- **Privacidad en el cliente.** `privacidad.js` repite la regla `puedeVer` solo para pintar la
  tabla "quién ve qué" con lo elegido; el servidor es el que manda y no envía lo que no se
  puede ver. Una prueba comprueba que las dos coinciden en todas las combinaciones. Los
  ajustes se guardan al cambiarlos (con actualización optimista: si el servidor lo rechaza,
  vuelve al valor anterior).
- **Fotos.** Las listas no llevan la foto dentro (hasta 200 KB en base64 cada una): llevan
  `has_avatar` y `Avatar.jsx` pide la imagen a `GET /users/:username/avatar`.
- **Insignia de solicitudes (con sondeo).** `Layout.jsx` pide `/friends/requests/count` al
  entrar y en cada cambio de página, y reparte el número con el contexto del `<Outlet />`.
  Además lo repite cada minuto con `iniciarSondeo` (`src/sondeo.js`), que **solo corre
  mientras se usa la app**: se para con la pestaña oculta o tras 5 minutos sin ratón, teclado
  ni pantalla táctil, y consulta en el acto al volver. Es a propósito: cada consulta mantiene
  despiertos Render y Neon (planes gratuitos), y una ventana olvidada no debe tenerlos
  despiertos todo el día. No apila consultas si el servidor tarda, y tampoco enseña el aviso
  de "servidor lento" (`avisoLento: false`). Se vuelve a pedir la lista completa solo al
  navegar. Si algún día hay chat (1.4), este mismo módulo vale para sondear mensajes.
- **Cómo se probó.** Las pruebas del repositorio (`privacidad.test.js`, `social.test.js` en
  backend y `social.test.js` en frontend) cubren la tabla de privacidad, las validaciones y los
  textos sin base de datos. La lógica con SQL (solicitudes cruzadas, bloqueos, privacidad por
  dato, políticas, sugerencias, actividad, la búsqueda con `_`) se comprobó contra un Postgres
  real en memoria (PGlite) con varios usuarios; si tocas esas consultas, vuelve a comprobarlas
  contra una base de datos de verdad.

### Tarjetas de la biblioteca

No llevan botones de Editar y Quitar. Salen con el **clic derecho** sobre la tarjeta
(`MenuContextual.jsx`; con el teclado, la tecla de menú contextual o Mayús + F10 sobre el título;
Mayús + clic derecho deja el menú del navegador) y dentro de la **ficha** que abre un clic normal
(recuadro "En tu biblioteca"). Lo comparten la tarjeta, "Jugando ahora" y la ficha con
`useAccionesJuego` y `VentanasJuego`. Cambiar el estado sigue estando en el chip de la tarjeta.

### App de escritorio

- La interfaz se sirve con un protocolo propio, `app://gamehub`, y no como `file://`, para que
  se comporte como una web normal; una CSP restringe lo que puede cargar y a qué servidor se
  conecta. La app **no lleva backend dentro**: llama por internet al servidor cuya dirección se
  fijó al compilar (`GAMEHUB_API_URL`).
- **Avisos de actualización:** `electron-updater` busca versiones nuevas en las Releases de
  GitHub al arrancar. Al terminar de descargar, `main.js` pregunta "Reiniciar ahora / Más tarde"
  (`quitAndInstall(true, true)` instala en silencio y reabre), y la primera vez que se abre una
  versión nueva enseña "se ha actualizado a la versión X" con las novedades de
  `desktop/actualizaciones.js` (`NOVEDADES`; hay que añadir la entrada al publicar cada versión).
  Los textos salen del idioma del sistema, no del de la interfaz.
- **El instalador solo lleva los archivos de `build.files`** (`desktop/package.json`): si
  `main.js` carga un archivo local nuevo, añádelo ahí o la app instalada no arrancará. La prueba
  de humo corre desde el código fuente y no lo detectaría; `npm test` en `desktop/` sí.
- Electron no arranca en WSL (falla con un segfault); la app de escritorio se prueba en Windows
  o en el runner de GitHub Actions.

## 10. Convenciones del código

- **Comentarios en español y didácticos:** explican el *porqué*, no solo el qué. El proyecto
  también es de aprendizaje.
- **Textos de la interfaz:** nada va escrito a mano en un componente. Añade la clave en
  `frontend/src/textos/es.js` **y** en `en.js` (mismas claves; una prueba y el sistema de
  respaldo lo notan) y usa `t('clave')` con el hook `useIdioma()`. Un error nuevo del backend
  necesita su entrada en `erroresApi` de `en.js`.
- **Mensajes de error y de éxito:** con el componente `Mensaje.jsx` (entra y sale animado).
- **Animaciones:** todo lo que entra animado, sale animado (`usePresencia`, `useCambioVista`).
  Con "reducir movimiento" el sistema las desactiva, así que el código no debe depender de que
  una animación termine para seguir funcionando. No se cierran cosas con temporizadores.
- **CSS:** vive en `frontend/src/estilos/`, dividido por zonas, con nombres BEM y colores y
  tamaños de las variables de `base.css`. El orden de `index.css` importa. Lee
  [`LEEME.md`](../frontend/src/estilos/LEEME.md) antes de tocarlo.
- **Base de datos:** `pg` a mano, sin ORM, a propósito. Los cambios de esquema van en
  `schema.sql` con `IF NOT EXISTS`.
- **Validación:** nunca te fíes solo del formulario; el servidor valida lo mismo
  (`config/validacion.js`).
- **Secretos:** no van en el código ni en el repositorio. `.env` está en `.gitignore`.
- Las credenciales de `docker-compose.yml` son solo para desarrollo; cámbialas en cualquier otro
  entorno.

## 11. Publicar una versión

Cada versión tiene que salir con su **nota del parche** en la página de la Release (como la de
la 1.0.0). **No se escribe a mano:** el flujo la construye a partir del `CHANGELOG.md`.

### Antes de etiquetar

1. **Escribe la sección de la versión en [`CHANGELOG.md`](../CHANGELOG.md)**, con el título
   `## [1.2.0] - AAAA-MM-DD` (pasa lo de `## [Sin publicar]` a esa sección). Estructura:

   ```markdown
   ## [1.2.0] - 2026-11-01

   Una frase de resumen de la versión.

   ### Añadido
   - **Qué:** explicación pensada para quien usa la app.

   ### Seguridad / Cambiado / Corregido   (los que apliquen)

   ### Interno
   - Cambios solo para quien desarrolla (esta sección NO sale en la nota de la Release).

   ### Limitaciones conocidas
   - Lo que todavía no funciona o conviene saber.
   ```

   Escribe las notas para **quien usa la app**: qué cambia para esa persona, sin nombres de
   archivos. Lo técnico va en `### Interno`.
2. **Sube la versión** en `desktop/package.json` y en `frontend/package.json` (y sus
   `package-lock.json`): `npm version X.Y.Z --no-git-tag-version` en cada carpeta.
3. **Añade las novedades al aviso de la app:** la entrada `'X.Y.Z'` en `NOVEDADES` de
   `desktop/actualizaciones.js` (es y en, mismas líneas). Es lo que verá quien se actualice.
4. Comprueba que todo pasa:

   ```bash
   (cd frontend && npm run lint && npm test && npm run build)
   (cd backend && npm test)
   (cd desktop && npm test)
   ```

5. **Comprueba cómo quedará la nota** (sin publicar nada):

   ```bash
   node desktop/scripts/notas-release.js X.Y.Z /tmp/nota.md && cat /tmp/nota.md
   ```

   Si falta la sección del CHANGELOG o las versiones de los `package.json` no coinciden, el
   script lo dice y sale con error.

### Publicar

```bash
git add -A && git commit -m "Versión X.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "GameHub X.Y.Z: resumen"
git push origin vX.Y.Z
```

Al subir la etiqueta, [`release.yml`](../.github/workflows/release.yml):

1. **Prepara la nota** a partir del CHANGELOG y **comprueba la versión** (si falla, para aquí,
   antes de compilar nada).
2. Instala dependencias y pasa las pruebas de la interfaz y de escritorio.
3. Compila la interfaz para escritorio y hace la **prueba de humo** (la app arranca de verdad).
4. Crea la Release **con la nota** y le sube el instalador, `latest.yml` y el blockmap.

Tarda unos 2–3 minutos. También se puede lanzar a mano (sin publicar, solo deja el instalador
como artefacto): `gh workflow run release.yml --ref main`.

### Después de publicar

- **Comprueba la Release:** que sea la última, no sea borrador y tenga los tres archivos.

  ```bash
  gh release view vX.Y.Z
  ```

- **Despliega el servidor.** Subir a `main` **no** redespliega Render por sí solo si el
  Auto-Deploy está desactivado: hazlo desde su panel (*Manual Deploy → Deploy latest commit*) y
  comprueba los logs. Si la versión añade columnas, el backend las crea al arrancar.
  Hazlo **antes** de que la gente se actualice, porque la interfaz nueva puede llamar a rutas
  que el servidor viejo no tiene.
- **Qué verá quien ya tiene la app:** al abrirla, descarga la versión nueva; se instala al
  cerrarla o cuando elija "Reiniciar ahora", y en el siguiente arranque aparece "se ha
  actualizado a la versión X" con las novedades.

Más detalle del instalador, el aviso de "editor desconocido" y la seguridad de la app en
[`desktop/README.md`](../desktop/README.md).

## 12. Tareas habituales

- **Añadir un texto a la interfaz:** clave en `es.js` y `en.js`, y `t('clave')` en el
  componente.
- **Añadir una columna a la base de datos:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en
  `schema.sql`, y reiniciar el backend.
- **Añadir una ruta a la API:** función en el controlador, ruta en `routes/`, y su fila en la
  [tabla de la API](#7-referencia-de-la-api). Si es un error nuevo, su traducción en
  `erroresApi`.
- **Cambiar una regla de validación:** en `backend/src/config/validacion.js` **y**
  `frontend/src/validacion.js`.
- **Un género nuevo de IGDB:** en `GENEROS` de `frontend/src/terminosIgdb.js` y sus claves en
  `es.js` y `en.js`.
- **Probar la parte social con gente ficticia:** `cd backend && npm run seed:demo` crea 8
  usuarios `demo_*` (correo `@demo.gamehub.test`, contraseña `Prueba1234`) con perfiles,
  privacidad, amistades, un bloqueo y bibliotecas con juegos reales de IGDB; cada uno prueba un
  caso distinto (ver la tabla del script, `backend/scripts/seed-demo.js`). Opciones:
  `npm run seed:demo -- --solicitudes-a=tu_usuario` añade 2 solicitudes pendientes hacia tu
  cuenta, y `npm run seed:demo:borrar` los borra con todo lo suyo. Solo se ejecuta contra una
  base de datos local (se niega con `NODE_ENV=production` o un `DATABASE_URL` remoto) y es una
  transacción: o crea todo o no cambia nada.
- **Ver qué sirve la base de datos de producción:** desde el panel de Neon (consola SQL), no
  desde aquí. No hagas pruebas que escriban contra producción.

## 13. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Cannot connect to the Docker daemon` | Docker no está arrancado | Abre Docker Desktop y espera a que indique que está listo |
| `/health` devuelve error de base de datos | El contenedor está parado | `docker compose up -d postgres` y `docker compose ps` |
| Las descripciones salen en inglés | No hay `AZURE_TRANSLATOR_KEY` y el traductor local está apagado o aún descargando los modelos (la primera vez tarda unos minutos) | `docker compose up -d traductor` y `docker compose logs -f traductor` hasta que diga que escucha en el puerto 5000 |
| `EADDRINUSE: address already in use :::4000` (o `port is already allocated` en 4000/5173) | Ya hay un backend o frontend corriendo: el modo A encendido mientras usas el modo B, o al revés | `docker compose stop backend frontend`, o cierra la otra terminal. También: `lsof -i :4000` y `kill <PID>` |
| Edité código y en Docker no cambia nada | La imagen se construyó con el código antiguo | `docker compose up -d --build` |
| El backend en Docker no conecta a la BD | Se está usando `localhost` en vez de `postgres` | No toques `DATABASE_URL` en el compose; mira `docker compose logs backend` |
| Cambié `VITE_API_URL` y no se nota en Docker | Vite la incrusta al compilar | Reconstruye: `docker compose build frontend && docker compose up -d` |
| `port is already allocated` (5432) | Hay otro Postgres usando el puerto | Para el otro Postgres, o cambia el puerto de la izquierda en `docker-compose.yml` (`"5433:5432"`) y ajusta `DATABASE_URL` |
| La app te echa al login | El token JWT caducó (dura 7 días), cambiaste la contraseña desde otro sitio, o es inválido | Vuelve a iniciar sesión |
| `relation "users" does not exist` | Base de datos sin tablas | Reinicia el backend: crea las tablas al arrancar |
| Un error 500 con `column "..." does not exist` | El código es más nuevo que la base de datos y el backend aún no ha aplicado el esquema | Reinicia el backend: aplica `schema.sql` al arrancar |
| Error de IGDB / búsqueda sin resultados | Faltan o son erróneas `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` en `backend/.env` | Revisa el `.env` y reinicia el backend |
| En Perfil → Cuentas vinculadas sale "no tiene configurada la clave de Steam" | Falta `STEAM_API_KEY` en `backend/.env` | Crea la clave en <https://steamcommunity.com/dev/apikey>, añádela al `.env` y reinicia el backend |
| Al sincronizar Steam sale "Tu perfil de Steam es privado" | El perfil o los "Detalles del juego" no son públicos | En Steam: Perfil → Editar perfil → Privacidad → "Detalles del juego" en Público |
| "¿Has olvidado tu contraseña?" no envía nada | Faltan `BREVO_API_KEY` o `CORREO_REMITENTE`, o Brevo rechaza el envío | Mira los logs del backend: `No se pudo enviar el correo de recuperación: ...` dice el motivo. En local, sin clave, el código sale en la consola |
| `/auth/forgot-password` da 404 en producción | Render tiene una versión anterior del servidor | *Manual Deploy* en Render |
| Cambié el `.env` y no se nota | El `.env` solo se lee al arrancar | Reinicia el backend |
| El flujo de publicación falla en "Preparar la nota de la Release" | Falta la sección `## [X.Y.Z]` en el CHANGELOG, o el `package.json` tiene otra versión | Corrígelo, y mueve la etiqueta: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`, vuelve a etiquetar y sube |
| La app instalada no arranca tras una versión nueva | Un archivo que carga `main.js` no está en `build.files` | Añádelo a `desktop/package.json`; `npm test` en `desktop/` lo detecta |

## 14. Checklist de cierre

- [ ] Guardar todos los archivos
- [ ] Lint y pruebas en verde si tocaste código
- [ ] Modo B: `Ctrl+C` en las terminales de backend y frontend
- [ ] (Opcional) `docker compose stop`
- [ ] Si cambiaste algo visible para quien usa la app: anotarlo en `## [Sin publicar]` del CHANGELOG
- [ ] Anotar qué sigue pendiente para la próxima vez

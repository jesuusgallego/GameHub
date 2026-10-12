# Guía de desarrollo diario

Cómo retomar el trabajo en el proyecto cada vez que abres el ordenador. Para la primera instalación (clonar, crear `.env`, `npm install`) consulta el [README](../README.md#puesta-en-marcha).

## Dos formas de trabajar

Abre **Docker Desktop** (si usas WSL2) antes de nada. Todos los comandos parten de la raíz del proyecto, `biblioteca-videojuegos/`.

| Modo | Cuándo usarlo | Terminales | Recarga al guardar |
|------|---------------|------------|--------------------|
| **A. Todo en Docker** | Usar la app, enseñarla, comprobar que funciona "como en producción" | 1 | No: hay que reconstruir |
| **B. Desarrollo** | Programar y ver los cambios al instante | 3 | Sí (nodemon y Vite) |

> ⚠️ **No mezcles los dos modos.** Ambos usan los puertos 4000 y 5173: si tienes el modo A encendido, `npm run dev` fallará con `EADDRINUSE`. Para cambiar de modo, para primero el otro (`docker compose stop backend frontend`).

## Modo A: todo en Docker

```bash
docker compose up -d --build
```

| Servicio | Contenedor | URL |
|----------|------------|-----|
| Frontend (nginx) | `biblioteca_frontend` | http://localhost:5173 |
| Backend (Express) | `biblioteca_backend` | http://localhost:4000 |
| PostgreSQL | `biblioteca_db` | `localhost:5432` |
| Traductor (LibreTranslate) | `biblioteca_traductor` | http://localhost:5000 |

- `up` crea y arranca los contenedores; `-d` los deja en segundo plano; `--build` reconstruye las imágenes si cambiaste código. Si no tocaste nada, puedes omitirlo.
- **Los cambios de código no se ven solos:** el código se copia dentro de la imagen al construirla. Tras editar, vuelve a ejecutar `docker compose up -d --build` (o solo `docker compose up -d --build backend`).
- Los contenedores **no** se arrancan solos al abrir Docker Desktop (el compose no define `restart`, y el valor por defecto es `no`). Solo se encienden cuando tú ejecutas `docker compose up`.
- Los datos viven en el volumen `pgdata`, así que **sobreviven** a parar o recrear los contenedores.

### Comandos de Docker Compose que más vas a usar

| Comando | Qué hace |
|---------|----------|
| `docker compose ps` | Estado de los contenedores |
| `docker compose logs -f backend` | Logs del backend en vivo (`Ctrl+C` para salir; cambia `backend` por `frontend` o `postgres`) |
| `docker compose restart backend` | Reinicia un servicio (útil tras cambiar `backend/.env`) |
| `docker compose stop` | Para todo sin borrar nada |
| `docker compose start` | Arranca de nuevo lo parado |
| `docker compose down` | Para y **elimina los contenedores** (los datos se conservan) |
| `docker compose build --no-cache backend` | Reconstruye una imagen desde cero si algo raro persiste |

## Modo B: desarrollo con recarga automática

Necesitas **tres terminales** (en VS Code: `` Ctrl+` `` y el botón `+`).

| # | Qué | Comando | Resultado esperado |
|---|-----|---------|--------------------|
| 1 | Base de datos y traductor | `docker compose up -d postgres traductor` | Contenedores `biblioteca_db` en `localhost:5432` y `biblioteca_traductor` en `localhost:5000` |
| 2 | Backend | `cd backend && npm run dev` | `Servidor corriendo en http://localhost:4000` |
| 3 | Frontend | `cd frontend && npm run dev` | App en http://localhost:5173 |

**El orden importa:** el backend necesita la base de datos al arrancar, y el frontend necesita el backend para funcionar.

**Importante:** en el paso 1 se indica `postgres` a propósito. Un `docker compose up -d` a secas levantaría también los contenedores de backend y frontend, que ocuparían los puertos 4000 y 5173.

En este modo el `DATABASE_URL` de `backend/.env` usa `localhost` (el backend corre en tu máquina). Dentro de Docker, el compose lo sobrescribe con `postgres`.

### Paso a paso

#### 1. Base de datos y traductor

```bash
docker compose up -d postgres traductor
docker compose ps
```

Debe aparecer `biblioteca_db` con estado `Up (healthy)`. El traductor (`biblioteca_traductor`) tarda más en estar listo: la primera vez descarga los modelos de traducción (unos minutos). Mientras no esté listo, las descripciones de los juegos salen en inglés.

#### 2. Backend (Express)

```bash
cd backend
npm run dev
```

`npm run dev` usa **nodemon**, que reinicia el servidor cada vez que guardas un archivo. No hace falta volver a arrancarlo tras editar código (sí tras cambiar el `.env`: guarda cualquier archivo de `src/` o escribe `rs` en esa terminal).

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

Abre http://localhost:5173. Vite recarga la página al guardar (HMR).

## Resumen de puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| PostgreSQL | 5432 | `postgresql://biblioteca_user:biblioteca_pass@localhost:5432/biblioteca_db` |
| Traductor | 5000 | http://localhost:5000 |
| Backend | 4000 | http://localhost:4000 |
| Frontend | 5173 | http://localhost:5173 |

## Cómo apagarlo todo al terminar

| Qué | Cómo |
|-----|------|
| Modo A (todo en Docker) | `docker compose stop` (conserva todo) |
| Modo B: frontend y backend | `Ctrl+C` en cada terminal |
| Modo B: base de datos | `docker compose stop` (conserva los datos) |

Apagar es opcional: los contenedores pueden quedarse corriendo sin problema.

> ⚠️ **No uses `docker compose down -v`** salvo que quieras borrar la base de datos. La opción `-v` elimina el volumen `pgdata` y **con él todos los usuarios y juegos**. `docker compose down` (sin `-v`) solo elimina el contenedor y es seguro.

## Tareas habituales

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

No hay que hacer nada: el backend ejecuta `schema.sql` cada vez que arranca. Crea las
tablas que falten y añade las columnas nuevas, y es seguro repetirlo porque usa
`IF NOT EXISTS` y no toca los datos. Si has actualizado el código, **reinicia el backend**
y la base de datos se pone al día sola.

Si alguna vez necesitas aplicarlo a mano (sin el backend):

```bash
docker exec -i biblioteca_db psql -U biblioteca_user -d biblioteca_db < backend/src/models/sql/schema.sql
```

### Probar la API sin el frontend

```bash
# Registrar y entrar (guarda el token que devuelve el login)
curl -X POST localhost:4000/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"prueba","email":"prueba@example.com","password":"Test1234!"}'
curl -X POST localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"prueba@example.com","password":"Test1234!"}'

# Usar el token en una ruta protegida
curl localhost:4000/games -H "Authorization: Bearer TU_TOKEN"
```

### Instalar dependencias

Solo hace falta si cambió `package.json` (por ejemplo tras un `git pull` o al añadir una librería):

```bash
cd backend && npm install
cd frontend && npm install
```

### Comprobar la calidad

```bash
cd frontend
npm run lint     # revisa el código con ESLint
npm test         # búsqueda, filtros y orden, géneros de IGDB y reglas de validación
npm run build    # comprueba que compila para producción

cd ../backend
npm test         # logros de Steam (simulado), recuperación de contraseña, sesiones y registro

cd ../desktop
npm test         # avisos de actualización y archivos que lleva el instalador
```

## Problemas frecuentes

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
| La app te echa al login | El token JWT caducó (dura 7 días) o es inválido | Vuelve a iniciar sesión |
| `relation "users" does not exist` | Base de datos sin tablas | Reinicia el backend: crea las tablas al arrancar |
| Error de IGDB / búsqueda sin resultados | Faltan o son erróneas `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` en `backend/.env` | Revisa el `.env` y reinicia el backend |
| En Perfil → Cuentas vinculadas sale "no tiene configurada la clave de Steam" | Falta `STEAM_API_KEY` en `backend/.env` | Crea la clave en https://steamcommunity.com/dev/apikey, añádela al `.env` y reinicia el backend |
| Al sincronizar Steam sale "Tu perfil de Steam es privado" | El perfil o los "Detalles del juego" no son públicos | En Steam: Perfil → Editar perfil → Privacidad → "Detalles del juego" en Público |
| Un error 500 con `column "..." does not exist` | El código es más nuevo que la base de datos y el backend aún no ha aplicado el esquema | Reinicia el backend: aplica `schema.sql` al arrancar |
| Cambié el `.env` y no se nota | El `.env` solo se lee al arrancar | Reinicia el backend |

## Checklist de cierre de sesión

- [ ] Guardar todos los archivos
- [ ] Modo B: `Ctrl+C` en las terminales de backend y frontend
- [ ] (Opcional) `docker compose stop`
- [ ] Anotar qué sigue pendiente para la próxima vez

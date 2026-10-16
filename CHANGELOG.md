# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Cambiado
- **La parte social, rediseñada.** Social pasa a ser "tu sala", con una cabecera de lobby y
  pestañas en barra, centrada y con el número de amigos y de solicitudes pendientes:
  - **Cabecera:** un mosaico con las portadas de lo que juegan tus amigos, y una pastilla bajo
    el título con nombres ("Beto y Eva están jugando ahora mismo"). A la derecha, tus amigos en
    una fila de círculos con su color: los que están jugando llevan la portada de su juego en
    la esquina, y el último círculo, con un "+", sirve para invitar a alguien.
  - **Actividad:** "Jugando ahora" con la portada de cada juego de fondo y los últimos
    movimientos en una línea del tiempo (hoy, ayer, esta semana...).
  - **Columna lateral:** las solicitudes con *Aceptar* y *Rechazar*
    ahí mismo, **Para jugar juntos** (los juegos que juegan o tienen varios de tus amigos, si
    tú ya lo tienes y un botón para abrir su ficha y añadirlo) y a quién quizá conozcas, con
    *Añadir amigo* ahí mismo. En el móvil, las solicitudes suben al principio.
  - **Amigos:** cada persona es un carnet con su color, lo que está jugando, sus cifras (juegos,
    completados y nota) y los juegos y amigos que tenéis en común.
  - **Solicitudes:** las recibidas como invitaciones. **Descubrir** y **Bloqueados** con el
    mismo estilo.
  - Cada persona tiene un color propio (sale de su nombre) que se ve en su foto, su carnet y su
    perfil.

### Añadido
- **En el perfil de un amigo ves lo que tenéis en común:**
  - Una banda bajo su banner con las portadas de los juegos y las fotos de los amigos que
    compartís.
  - Una pestaña **En común**: cada juego como un duelo (tu estado y tu nota frente a los suyos,
    y los logros de los dos) con "vuestro favorito" destacado, y los amigos en común.
  - **Cara a cara** en el resumen: tus juegos, completados y nota media frente a los suyos.
- **La ficha de un juego de su biblioteca**, con su partida: estado, nota, reseña, horas jugadas
  y la lista de **logros** de Steam con cuáles ha conseguido y cuándo. Si tú también lo tienes, tu
  partida sale debajo. Desde ahí puedes añadirlo a tu biblioteca. Se abre pulsando una portada en
  su biblioteca, en *En común* o en la actividad.
- **Privacidad: "Horas y logros".** Un ajuste nuevo (por defecto, solo tus amigos) que decide si
  los demás ven tus horas jugadas y tus logros. Solo se ven si también ven tu biblioteca.
- **Las solicitudes de amistad llegan sin recargar.** La insignia de **Social** en la barra se
  actualiza sola cada minuto mientras usas la app. Se pausa con la pestaña oculta o tras cinco
  minutos sin tocar nada, para no mantener despiertos el servidor y la base de datos gratuitos,
  y consulta en el acto cuando vuelves.

### Interno
- Nuevo `GET /friends/games` (juegos de tus amigos para jugar juntos).
- Nuevos `GET /users/:username/common` y `GET /users/:username/games/:igdbId/achievements`;
  `GET /friends` trae además juegos y amigos en común, completados y nota media.
- `seed:demo` crea también juegos de Steam con horas y logros, un amigo que los oculta y más
  juegos en común (`--steam-id=` para una lista real de logros).
- Nuevo `GET /friends/requests/count`, que devuelve solo el número de solicitudes recibidas.
- `src/sondeo.js` en el frontend: sondeo reutilizable, con pruebas.
- `npm run seed:demo` (en `backend/`): crea usuarios ficticios para probar la parte social, y
  `npm run seed:demo:borrar` los quita. Solo funciona contra una base de datos local.

## [1.2.0] - 2026-10-15

Social: amigos, actividad y perfiles públicos con privacidad por dato. Inicio de sesión con
nombre de usuario y datos personales en el perfil.

### Añadido
- **Social.** Una página nueva en la barra, con cinco pestañas:
  - **Actividad:** a qué están jugando ahora tus amigos y sus últimos movimientos (juegos
    añadidos, empezados, completados o abandonados, con la nota y "hace 2 horas").
  - **Amigos:** tus amigos en tarjetas, con a qué juegan y cuántos juegos tienen, y un filtro
    por nombre.
  - **Solicitudes:** las recibidas y las enviadas. Las pendientes salen como un número en la
    barra.
  - **Descubrir:** un buscador por el principio del nombre de usuario y, debajo, "personas que
    quizá conozcas" (amigos de tus amigos, ordenadas por los que tenéis en común).
  - **Bloqueados.**

  Si dos personas se envían solicitud a la vez, se aceptan solas.
- **Perfil de otras personas:** el mismo banner que el tuyo y tres pestañas: resumen,
  **biblioteca** (con filtros por estado y por "en común", y tu nota al lado de la suya en los
  juegos que tenéis los dos) y **amigos**. Bajo el banner, los amigos y los juegos que tenéis
  en común.
- **Privacidad**, una sección nueva del perfil:
  - Una tabla que enseña, en vivo, qué ve cada tipo de persona (tú, tus amigos, cualquiera)
    con lo que tienes elegido.
  - Un ajuste por dato (solo yo, mis amigos o todo el mundo): nombre y apellidos, edad, sexo,
    localización y país, biblioteca, texto de las reseñas y lista de amigos.
  - **Quién puede enviarte solicitudes:** cualquiera, amigos de mis amigos o nadie.
  - **Aparecer en las búsquedas** (y en las sugerencias), con un interruptor.

  Los cambios se guardan solos. Por defecto, los datos personales no los ve nadie y la
  biblioteca, las reseñas y los amigos, solo tus amigos. El email, el teléfono y la fecha de
  nacimiento no los ve nadie, con ninguna opción.
- **Bloquear** a una persona: deja de ser tu amiga y no puede ver tu perfil, encontrarte ni
  enviarte solicitudes (para ella, tu cuenta es como si no existiera).
- **Iniciar sesión con tu email o con tu nombre de usuario.** El campo de la pantalla de
  entrada acepta cualquiera de los dos.
- **Datos personales en el perfil**, todos opcionales: nombre y apellidos, fecha de
  nacimiento (en el banner solo se ve la edad), sexo, localización, país y teléfono.
  - El **país** se elige de una lista de 250 con su nombre en tu idioma.
  - El **teléfono** lleva el prefijo aparte: lo eliges de la lista (`España (+34)`) o lo
    escribes en el propio campo (`+34` o `0034`) y salta a la lista. El número se escribe como
    en tu país (`600 12 34 56`) y se comprueba que sea un número real de ese país.

### Cambiado
- **El nombre de usuario es único y va en minúsculas:** de 3 a 20 caracteres, con letras sin
  tilde, números y guion bajo (`_`). El campo corrige lo que escribes: pasa a minúsculas, quita
  tildes y descarta espacios y símbolos. Antes valía cualquier texto de hasta 50 caracteres.
- **Los nombres que ya existían se convierten solos:** `Jesus Gallego` pasa a `jesus_gallego`,
  `José` a `jose`, y si dos quedan iguales el segundo recibe un número (`ana`, `ana2`). Las
  cuentas siguen entrando con su email y su contraseña.

### Interno
- **Orden de despliegue:** primero el servidor (migra los nombres de usuario y crea las tablas
  y columnas al arrancar) y después la app. Una interfaz nueva contra un servidor antiguo no
  entraría con el nombre de usuario. `POST /auth/login` recibe `identifier` y sigue aceptando
  `email` para las apps ya instaladas.
- Rutas nuevas: `GET /users/search`, `GET /users/:username` (con `/games`, `/friends` y
  `/avatar`), `/friends` (con `/requests`, `/activity`, `/suggestions` y `/blocks`).
  `PATCH /profile` acepta los datos personales y los ajustes de privacidad; `GET /profile`
  devuelve además `age`.
- Tablas nuevas `friendships` y `blocks`, y columnas nuevas en `users` (datos personales,
  nueve ajustes de privacidad y la política de solicitudes). `schema.sql` las crea y convierte
  los nombres de usuario existentes; es idempotente.
- La regla de qué ve cada persona está en un solo sitio (`services/privacidad.js`) y se prueba
  con toda la tabla. El cliente repite `puedeVer` solo para la tabla de la pantalla de
  Privacidad, con una prueba que comprueba que da lo mismo que el servidor.
- Las fotos de las listas de personas no viajan dentro del JSON: la API devuelve `has_avatar` y
  la imagen se pide a `GET /users/:username/avatar` (con `ETag`).
- Nueva dependencia `libphonenumber-js` (frontend y backend): prefijos y validación de
  números. Añade unos 130 KB al paquete de la web (34 KB comprimidos).
- Pruebas nuevas: que cada error fijo del backend esté traducido, que toda clave `t('...')`
  del código exista en los dos idiomas, y las de privacidad, perfil, login y rutas sociales.

### Limitaciones conocidas
- El teléfono no se verifica (no hay SMS).
- Las solicitudes y la actividad de tus amigos llegan al navegar o recargar, no en directo.
- Solo se puede bloquear: todavía no hay forma de reportar a un usuario.
- No hay edad mínima para registrarse.
- El instalador sigue sin firmar: Windows SmartScreen avisará de "editor desconocido".

## [1.1.0] - 2026-10-12

Recuperación de contraseña, sesiones más seguras y mejoras en el perfil y en las actualizaciones.

### Añadido
- **Recuperación de contraseña:** "¿Has olvidado tu contraseña?" en el inicio de sesión envía
  al correo un código de 6 dígitos (caduca a los 15 minutos, 5 intentos, un solo uso) con el
  que se elige una contraseña nueva.
- **Avisos de actualización en la app de escritorio:** al terminar de descargar una versión
  nueva pregunta si reiniciar ahora o más tarde, y la primera vez que se abre una versión
  nueva dice "GameHub se ha actualizado a la versión X" con las novedades. La 1.0.0 ya
  instalada pasa a la 1.1.0 en silencio; la pregunta se verá a partir de la siguiente.

### Seguridad
- **El registro valida en el servidor** el formato del email, la fuerza de la contraseña y la
  longitud del nombre de usuario. Antes solo lo comprobaba el formulario, y quien llamara a
  la API directamente podía crear una cuenta con cualquier contraseña.
- **Cambiar o recuperar la contraseña cierra las demás sesiones.** Antes, un token ya emitido
  seguía valiendo hasta 7 días aunque se cambiara la contraseña. Ahora cada token lleva una
  versión (`users.token_version`) que el servidor comprueba en cada petición. Al cambiarla
  desde el perfil, la sesión actual recibe un token nuevo y sigue dentro; al recuperarla por
  correo, se cierran todas. Los tokens anteriores a este cambio siguen valiendo hasta el
  primer cambio de contraseña.

### Cambiado
- **Géneros y modos de juego en español:** el filtro, la ficha y el buscador los muestran
  traducidos ("Role-playing (RPG)" → "Rol (RPG)"). Las compañías se quedan como las da IGDB.
- **Tarjeta de email del perfil:** el email se ve como dato y el campo del email nuevo y la
  contraseña actual solo aparecen al pulsar "Cambiar email" (con Cancelar y Guardar). La
  contraseña de confirmación ya no se autocompleta, ni en el email ni al borrar la cuenta.

### Interno
- La recuperación de contraseña envía el correo por Brevo: el servidor necesita
  `BREVO_API_KEY` y `CORREO_REMITENTE` (ver `docs/DESPLIEGUE.md`). Sin ellas el botón no envía
  nada.
- Las reglas de validación (email y contraseña) y el acceso al token de sesión viven cada una
  en un solo módulo (`config/validacion.js`, `validacion.js` y `sesion.js`), en vez de
  repetirse en varios archivos. Pruebas nuevas de validación, y una que comprueba que las
  reglas del formulario y las del servidor coinciden.

### Limitaciones conocidas
- El instalador sigue sin firmar: Windows SmartScreen avisará de "editor desconocido".
- Al actualizar desde la 1.0.0 la app no pregunta si reiniciar: se instala al cerrarla. La
  pregunta aparece a partir de esta versión.
- Los nombres de las compañías se muestran como los da IGDB (en inglés).

## [1.0.0] - 2026-10-10

Primera versión pública, con la app de escritorio.

### Añadido
- **App de escritorio** (Electron) para Windows, con instalador, actualización automática
  y la interfaz servida desde la propia app.
- **Biblioteca personal:** estados, nota, reseña y plataforma por juego; ficha con datos de
  IGDB (portada difuminada, nota, ficha técnica, capturas).
- **Búsqueda, filtros y orden:** el buscador mira nombre, compañías, géneros y plataforma;
  filtros por estado, género, compañía y plataforma; orden por fecha de adición, nombre,
  tiempo jugado, logros, nota, nota de IGDB y lanzamiento.
- **Steam:** vincular la cuenta, importar toda la biblioteca, horas jugadas, barra de logros
  y lista de logros por juego. Desvincular deja todo como estaba.
- **Perfil** con foto (subida o ilustración de un juego), estadísticas y seguridad.
- **Idiomas** español e inglés y **tema** claro y oscuro.
- Descripciones traducidas automáticamente (Azure Translator o LibreTranslate).
- Aviso en pantalla cuando el servidor tarda en responder (el plan gratuito lo duerme).
- `render.yaml` y guía para desplegar el backend gratis con Render y Neon.

### Licencia
- El código se publica bajo licencia MIT (`LICENSE`), con los créditos de IGDB, Steam y
  las tipografías en el README.

### Seguridad
- Límite de intentos en el inicio de sesión y el registro.
- Cabeceras de seguridad (`helmet`) y CORS restringido por configuración.
- Sin `JWT_SECRET` (o demasiado corto en producción) el servidor no arranca.

### Limitaciones conocidas
- No hay recuperación de contraseña.
- El instalador no está firmado: Windows SmartScreen avisará de "editor desconocido".
- Los nombres de género y compañía se muestran como los da IGDB (en inglés).

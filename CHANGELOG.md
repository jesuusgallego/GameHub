# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido
- **Inicio de sesión con email o con nombre de usuario.** El campo de la pantalla de entrada
  acepta cualquiera de los dos. El nombre de usuario se puede escribir también con
  mayúsculas: se busca en minúsculas.
- **Datos personales en el perfil**, todos opcionales: nombre, apellidos, fecha de nacimiento,
  sexo (hombre, mujer u otro), localización (ciudad o región), país y teléfono. Se editan en
  *Perfil → Editar perfil*. El banner muestra nombre, edad (calculada con la fecha de
  nacimiento, que no se enseña), sexo y "localización, país"; el teléfono no se muestra en
  ningún sitio. Por ahora solo los ve su dueño.
- **País** como campo aparte: una lista de 250 países con su nombre en el idioma de la interfaz.
- **Teléfono** con el prefijo aparte: se elige de una lista de países con su prefijo
  (`España (+34)`) **o** se escribe en el propio campo (`+34` o `0034`: al teclearlo salta a
  la lista). El número se escribe como en su país (`600 12 34 56`, o `020 7946 0958` en
  Reino Unido) y se guarda en formato internacional (`+34600123456`). Elegir el país del
  perfil rellena el prefijo si estaba vacío. Se comprueba que sea un número real de ese
  país, no solo que tenga cifras. El número no se verifica por SMS.

### Cambiado
- **Nombre de usuario único y en minúsculas:** de 3 a 20 caracteres, solo letras sin tilde,
  números y guion bajo (`_`). El campo no deja escribir mayúsculas ni caracteres raros: pasa
  las letras a minúsculas, quita las tildes y descarta espacios y símbolos. El servidor y la
  base de datos aplican la misma regla. Antes valía cualquier texto de hasta 50 caracteres.
- **Los nombres de usuario que ya existían se convierten solos** al arrancar el servidor:
  `Jesus Gallego` pasa a `jesus_gallego`, `José` a `jose`, y si dos quedan iguales el segundo
  recibe un número (`ana`, `ana2`). Las cuentas siguen entrando con su email y su contraseña.
- El nombre de usuario se ve tal cual en el banner del perfil, en minúsculas (antes el estilo
  de los títulos lo pasaba a mayúsculas).

### Interno
- `POST /auth/login` recibe `identifier` (email o nombre). Sigue aceptando `email` para que las
  apps de escritorio ya instaladas puedan entrar. **Hay que desplegar el backend antes de
  publicar la app**: una interfaz nueva contra un servidor antiguo no entraría con el nombre.
- `PATCH /profile` acepta `first_name`, `last_name`, `birth_date` (`AAAA-MM-DD`), `gender`,
  `location`, `country` (código ISO de dos letras) y `phone`; `GET /profile` devuelve además `age`. Nuevas columnas en `users` y reglas
  compartidas con el formulario (una prueba comprueba que coinciden).
- Nueva dependencia, `libphonenumber-js` (frontend y backend): conoce el prefijo de cada país
  y valida números. Añade unos 130 KB al paquete de la web (34 KB comprimidos).
- `schema.sql` quita la restricción de nombre de usuario de una versión de desarrollo anterior
  (mayúsculas) antes de convertir los nombres, para que una base de datos que ya la tuviera
  pueda arrancar.

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

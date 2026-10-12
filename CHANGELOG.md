# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido
- **Recuperación de contraseña:** "¿Has olvidado tu contraseña?" en el inicio de sesión envía
  al correo un código de 6 dígitos (caduca a los 15 minutos, 5 intentos, un solo uso) con el
  que se elige una contraseña nueva. El correo sale por Brevo; hay que configurar
  `BREVO_API_KEY` y `CORREO_REMITENTE` en el servidor (ver `docs/DESPLIEGUE.md`).

### Seguridad
- **Cambiar o recuperar la contraseña cierra las demás sesiones.** Antes, un token ya emitido
  seguía valiendo hasta 7 días aunque se cambiara la contraseña. Ahora cada token lleva una
  versión (`users.token_version`) que el servidor comprueba en cada petición. Al cambiarla
  desde el perfil, la sesión actual recibe un token nuevo y sigue dentro; al recuperarla por
  correo, se cierran todas. Los tokens anteriores a este cambio siguen valiendo hasta el
  primer cambio de contraseña.

### Cambiado
- **Géneros y modos de juego en español:** el filtro, la ficha y el buscador los muestran
  traducidos ("Role-playing (RPG)" → "Rol (RPG)"). Las compañías se quedan como las da IGDB.

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

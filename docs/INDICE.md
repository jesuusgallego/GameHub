# Índice y estado del proyecto

Una página para orientarse: dónde está cada cosa, qué está hecho y qué falta. Los detalles
están en los documentos a los que enlaza.

## 1. Dónde está cada cosa

| Quiero… | Mira… |
|---------|-------|
| Saber qué es GameHub y usarlo | [README](../README.md) |
| Ver qué cambió en cada versión | [CHANGELOG](../CHANGELOG.md) |
| Montar el entorno y retomar el trabajo | [Guía de desarrollo](DESARROLLO.md): secciones 3 y 4 |
| Saber qué variables de entorno hay | [Guía de desarrollo](DESARROLLO.md): sección 5 |
| Entender la base de datos y sus tablas | [Guía de desarrollo](DESARROLLO.md): sección 6 |
| Consultar un endpoint de la API | [Guía de desarrollo](DESARROLLO.md): sección 7 |
| Ejecutar las pruebas, o probar el SQL sin Docker | [Guía de desarrollo](DESARROLLO.md): sección 8 |
| Entender cómo está hecho algo (privacidad, social, sondeo, Steam, traducción…) | [Guía de desarrollo](DESARROLLO.md): sección 9 |
| Publicar una versión | [Guía de desarrollo](DESARROLLO.md): sección 11 |
| Resolver un problema | [Guía de desarrollo](DESARROLLO.md): sección 13 |
| Poner el servidor en internet, o conocer sus límites | [Despliegue](DESPLIEGUE.md) |
| Entender la app de escritorio y sus actualizaciones | [`desktop/README.md`](../desktop/README.md) |
| Saber dónde está cada archivo de la interfaz | [`frontend/README.md`](../frontend/README.md) |
| Tocar el CSS | [`frontend/src/estilos/LEEME.md`](../frontend/src/estilos/LEEME.md) |

El **sistema de diseño** (colores, tipografía, y la vista previa de cada componente) se
mantiene fuera del repositorio, en un documento privado; su `bundle.css` se genera a partir de
`frontend/src/estilos/`. Si cambias el CSS de un componente, hay que volver a sincronizarlo.

## 2. Qué está hecho

| Versión | Fecha | Qué trajo |
|---------|-------|-----------|
| [1.0.0](../CHANGELOG.md) | 2026-10-10 | Primera versión pública: app de escritorio para Windows con actualización automática, biblioteca personal (estados, nota, reseña), búsqueda en IGDB, vinculación con Steam (juegos, horas y logros), perfil, e interfaz en español e inglés con tema claro y oscuro |
| [1.1.0](../CHANGELOG.md) | 2026-10-12 | Recuperación de contraseña por correo, sesiones más seguras y mejoras en el perfil y en los avisos de actualización |
| [1.2.0](../CHANGELOG.md) | 2026-10-15 | Social: amigos, solicitudes, bloqueos, actividad y perfiles públicos con privacidad dato a dato; inicio de sesión con nombre de usuario y datos personales en el perfil |
| [1.3.0](../CHANGELOG.md) | 2026-10-16 | Social rediseñado ("la sala"); en el perfil de un amigo, lo que tenéis en común, un cara a cara y la ficha de sus juegos con su partida y sus logros de Steam; ajuste de privacidad "Horas y logros"; la insignia de solicitudes se actualiza sola |
| [1.4.0](../CHANGELOG.md) | 2026-10-16 | Chat entre amigos (botón y panel en toda la app, "visto", borrado y avisos de no leídos); Social, Mi biblioteca y Buscar mucho más fluidos |

## 3. Qué falta

### Próximas versiones

El orden es el acordado; cada fase es una versión con su entrada en el CHANGELOG.

1. **Noticias por RSS (1.5)**: una sección con noticias de portales de videojuegos, con la
   posibilidad de seguir portales. Solo titular, extracto y enlace al original; no se copian
   artículos.
2. **Versión móvil (2.0)**: la misma interfaz React empaquetada con Capacitor, con una PWA como
   paso intermedio. Android primero; iOS cuesta una cuenta de pago y un Mac o un servicio de
   compilación, así que se decide aparte.

### Ideas para el chat

Avisos del sistema (hoy, con la app minimizada no llegan avisos), "escribiendo…", imágenes y
chats de grupo; ver [Chat](DESARROLLO.md#chat).

### Pendientes conocidos

- **Reportar usuarios:** hoy solo se puede bloquear; no hay moderación.
- **Edad mínima** para registrarse (en España, 14 años).
- **La lista de solicitudes** de la pestaña *Solicitudes* no se refresca sola; solo la insignia.
- **Instalador sin firmar:** Windows SmartScreen avisa de "editor desconocido".
- **Teléfono sin verificar** (ver "Descartado").
- **Sistema de diseño:** faltan las vistas previas del campo de teléfono, de los ajustes de
  privacidad y del interruptor.
- **Probar el SQL** sin Docker se explica en la guía, pero el script no está en el repositorio.

### Descartado

Decidido no hacerlo; no se vuelve a proponer salvo que se pida.

- **Verificar el teléfono por SMS:** el coste de los proveedores choca con la regla de que el
  proyecto funcione gratis y sin tarjeta.
- **Logros en el feed de actividad:** no hay historial de logros (solo un contador que se
  sobrescribe en cada sincronización), y guardarlo no compensa por ahora.

## 4. Reglas que conviene recordar

- **Todo gratis y sin tarjeta:** Render (servidor) y Neon (base de datos) en sus planes
  gratuitos. De ahí que el servidor se duerma y que no se use polling agresivo ni pings
  ([por qué](DESPLIEGUE.md#límites-y-cosas-a-vigilar)).
- **Convenciones del código** (textos en español e inglés, animaciones de entrada y de salida,
  CSS, base de datos, validación): [guía de desarrollo, sección 10](DESARROLLO.md#10-convenciones-del-código).
- **Los archivos del backend que cargan las pruebas del frontend no pueden importar paquetes de
  npm** (`config/validacion.js` y `services/privacidad.js`); si no, falla el CI de la Release.
  Más en la [sección 8](DESARROLLO.md#8-scripts-y-pruebas) de la guía.
- **Subir a `main` no redespliega Render** si el despliegue automático está desactivado: se hace
  a mano desde su panel ([publicar una versión](DESARROLLO.md#11-publicar-una-versión)).

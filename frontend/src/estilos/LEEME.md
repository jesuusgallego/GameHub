# Estilos de GameHub

Todo el CSS de la app vive en esta carpeta. `main.jsx` importa solo `index.css`, que
a su vez importa el resto de archivos con `@import`.

## Dónde está cada cosa

| Archivo | Qué contiene | Componentes que lo usan |
|---------|--------------|-------------------------|
| `base.css` | **Variables de diseño** (colores, temas claro/oscuro, tipografías, radios), reinicio de estilos y aspecto global de los campos | todos |
| `marca.css` | Logo y animación del mando; indicador de carga | `Marca`, `Cargando` |
| `botones.css` | `.btn` (primario, secundario, peligro...) y `.btn-icono` | todos |
| `barra-superior.css` | Barra de arriba y su navegación | `Menu` |
| `paginas.css` | Contenedor central, títulos de página/sección y la página Buscar | `Buscar` |
| `mensajes.css` | Mensajes de error, éxito y aviso; estados vacíos | `Mensaje` |
| `tarjetas.css` | Rejilla de juegos, tarjetas, su animación de entrada, chips de estado, insignia de Steam, icono de plataforma | `GameCard`, `JuegoGuardado`, `InsigniaSteam`, `IconoPlataforma` |
| `formularios.css` | `.formulario`, `.campo`, `.formulario__pareja` (dos campos por fila) y el subtítulo de sección | formularios |
| `desplegable.css` | Desplegable propio (el del estado y filtros) | `Desplegable` |
| `login.css` | Inicio de sesión, registro y recuperar contraseña | `Login`, `Registro`, `Recuperar` |
| `biblioteca.css` | Mi biblioteca: fila "Jugando ahora", filtros laterales y barra de orden, portadas pulsables | `Biblioteca`, `JugandoAhora`, `FiltrosBiblioteca`, `OrdenBiblioteca` |
| `ventanas.css` | Ventanas modales: ficha del juego, visor de capturas, edición, confirmación | `DetalleJuego`, `VisorCapturas`, `EditarJuego`, `DialogoConfirmar` |
| `menus.css` | Avatar, menú de usuario, menú de ajustes (idioma y tema) y menú contextual de las tarjetas | `Avatar`, `MenuUsuario`, `MenuAjustes`, `MenuContextual` |
| `perfil.css` | Base del perfil, estadísticas, edición de foto/nombre/bio y el cambio animado `.vista` | `EstadisticasPerfil`, `EditarPerfil`, `SelectorArtwork`, `RecortadorFoto` |
| `respuesta-al-pulsar.css` | Lo pulsable se encoge un poco mientras se mantiene pulsado | varios |
| `perfil-cabecera-y-pestanas.css` | Banner del perfil con cifras, pestañas con indicador deslizante y paneles | `CabeceraPerfil`, `PestanasPerfil`, `Perfil` |
| `perfil-seguridad.css` | Tarjetas de ajustes, dato de solo lectura (el email), campo de contraseña con ojo, requisitos y fuerza | `CuentaPerfil`, `CampoContrasena`, `RequisitosContrasena` (también en `Recuperar`) |
| `cuentas-vinculadas.css` | Tarjeta de plataforma (Steam), botón `.btn--steam`, escena animada de conexión | `CuentaSteam`, `ConexionSteam` |
| `perfil-movil.css` | Perfil en pantallas estrechas | `Perfil` y sus piezas |
| `progreso-steam.css` | Horas y barra de logros de Steam, y la lista de logros de la ficha | `ProgresoSteam`, `LogrosSteam` |
| `social.css` | Lo común de lo social: insignia de solicitudes de la barra, botones de la amistad, avisos de "es privado", filtros de la biblioteca ajena y la sección Privacidad del perfil (tabla, ajustes, interruptor) | `AccionAmistad`, `AvisoPrivado`, `BibliotecaAjena`, `PanelPrivacidad`, `Interruptor` |
| `sala.css` | La página Social ("la sala": cabecera, pestañas en barra, en directo, línea del tiempo, carnets, invitaciones, descubrir) y el perfil de otra persona (banner con su color, banda "en común", cara a cara, duelos, estantería, ficha con su partida). El color de cada persona sale de `--tono` (ver `src/tono.js`) | `Social`, `Actividad`, `EnDirecto`, `LateralSala`, `Carnet`, `Invitaciones`, `FilaPersona`, `Descubrir`, `AvatarTono`, `PerfilPublico`, `BandaEnComun`, `CaraACara`, `EnComun`, `BibliotecaAjena`, `SeccionAjena` |
| `movil.css` | Ajustes generales para pantallas estrechas | varios |

## Reglas para trabajar aquí

- **Los colores y tamaños salen de las variables de `base.css`** (`var(--acento)`,
  `var(--superficie)`, `var(--radio)`...). Para cambiar la paleta se toca solo ese archivo.
  Los temas se definen con el atributo `data-tema` de `<html>`.
- **Nombres de clase con BEM**: `bloque`, `bloque__elemento`, `bloque--variante`
  (por ejemplo `plataforma`, `plataforma__cabecera`, `plataforma__estado--ok`).
- **El orden de `index.css` importa.** En CSS, cuando dos reglas pesan lo mismo, gana
  la que va después. Los archivos están en el mismo orden en que se escribieron, y
  `movil.css` va el último a propósito. Si una regla nueva "no hace efecto", mira
  primero si otra posterior la pisa.
- **Para añadir estilos de un componente nuevo**: crea un archivo (`mi-componente.css`),
  añade su `@import` en `index.css` en la zona que le toque y, si es nuevo, descríbelo
  en la tabla de arriba.
- **Animaciones**: lo que entra animado también sale animado. Con "reducir movimiento"
  el sistema las desactiva todas (ver `base.css`), así que el código no debe depender de
  que una animación termine para seguir funcionando (mira `ConexionSteam.jsx`).

## Cosas pendientes de ordenar

- Algunas reglas para pantallas estrechas están junto a su componente (`perfil-movil.css`,
  el `@media` de la ficha en `ventanas.css`) y otras juntas en `movil.css`. Unificarlas
  exige comprobar el orden de la cascada, por eso no se ha hecho al dividir el archivo.
- La división se hizo sin cambiar ni una regla: el CSS compilado salió idéntico byte a
  byte al de antes (salvo dos bloques, `.mensaje--aviso` y `.casilla`, que se movieron a
  `mensajes.css` y `formularios.css`, que es donde corresponden).

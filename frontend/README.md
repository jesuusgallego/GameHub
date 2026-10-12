# GameHub: interfaz (frontend)

La interfaz de GameHub: **React 19** + **React Router 7**, compilada con **Vite**. Es la
misma para la versión web y para la de escritorio (`../desktop`).

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # compila a dist/ (web)
npm run lint      # ESLint
npm test          # pruebas de filtros, orden, búsqueda, géneros de IGDB y validación
```

Necesita el backend en marcha: la URL se toma de `VITE_API_URL` (por defecto
`http://localhost:4000`). Se incrusta al compilar.

## Dónde está cada cosa

| Carpeta o archivo | Contenido |
|-------------------|-----------|
| `src/main.jsx`, `src/App.jsx` | Arranque y rutas (`HashRouter` en la compilación de escritorio) |
| `src/api.js` | Todas las llamadas al backend (`apiFetch`) y el aviso de servidor lento |
| `src/textos/` | Textos en español e inglés (`es.js` y `en.js`, mismas claves) |
| `src/estilos/` | CSS dividido por zonas: mira [`LEEME.md`](src/estilos/LEEME.md) |
| `src/ordenFiltros.js` | Búsqueda, filtros y orden de la biblioteca (funciones puras, con pruebas) |
| `src/terminosIgdb.js` | Traducción de los géneros y modos de juego de IGDB (solo para mostrarlos; se guardan en inglés) |
| `src/sesion.js` | Lectura, guardado y borrado del token de sesión (`localStorage`) |
| `src/validacion.js` | Reglas de email y contraseña de los formularios (iguales a las del backend) |
| `src/Recuperar.jsx` | Recuperar la contraseña en dos pasos: pedir el código y elegir la nueva |
| `test/` | Pruebas (`node --test`) |

La documentación general del proyecto está en el [README de la raíz](../README.md).

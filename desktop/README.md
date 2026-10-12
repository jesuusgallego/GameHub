# GameHub: versión de escritorio

Aplicación de escritorio hecha con [Electron](https://www.electronjs.org/). Es la misma
interfaz React de `frontend/`, dentro de una ventana propia. **No lleva servidor**: llama
por internet al backend (ver [`docs/DESPLIEGUE.md`](../docs/DESPLIEGUE.md)).

## Cómo está montada

| Archivo | Para qué |
|---------|----------|
| `main.js` | Proceso principal: abre la ventana, sirve la interfaz con el protocolo `app://gamehub`, recuerda tamaño y posición, abre los enlaces externos en el navegador, aplica la política de seguridad (CSP) y busca actualizaciones |
| `scripts/build-web.mjs` | Compila `frontend/` para escritorio y lo deja en `desktop/app/` |
| `build/icon.png` | Icono de la app y del instalador (512×512, sale de `frontend/public/favicon.svg`) |
| `package.json` | Dependencias y configuración de `electron-builder` (instalador, publicación) |

La dirección del servidor **se graba al compilar** (`GAMEHUB_API_URL`). Para cambiarla hay
que compilar de nuevo.

## Probarla SIN instalar nada (recomendado)

GitHub puede compilar el instalador por ti en sus servidores:

1. En el repositorio, pestaña **Actions** → **Versión de escritorio** → **Run workflow**.
2. Espera unos 5–8 minutos. El flujo instala dependencias, pasa las pruebas, **arranca la
   app de verdad** (prueba de humo) y genera el instalador.
3. En la página de esa ejecución, abajo, en **Artifacts**, descarga `GameHub-instalador` y
   ejecuta el `.exe`.

No se publica nada: es solo para probar. Para publicar una versión, ver más abajo.

## Probarla en tu PC (con las herramientas instaladas)

Necesitas Node 20+ y el servidor (o el backend local en `http://localhost:4000`).

```bash
# La interfaz se compila con las dependencias de frontend/: instálalas primero
cd frontend
npm install

cd ../desktop
npm install
# Si npm avisa de "allow-scripts", descarga Electron a mano:
node node_modules/electron/install.js

# Windows PowerShell:  $env:GAMEHUB_API_URL="http://localhost:4000"
GAMEHUB_API_URL=http://localhost:4000 npm run build:web
npm start
```

Con el backend local, arranca con `CORS_ORIGINS` vacío (cualquier origen) o incluyendo
`app://gamehub`.

## Generar el instalador (Windows)

```bash
cd desktop
GAMEHUB_API_URL=https://api.tu-servidor.com npm run dist
# Windows PowerShell:
#   $env:GAMEHUB_API_URL="https://api.tu-servidor.com"; npm run dist
```

(Antes hay que haber hecho `npm install` en `frontend/` y en `desktop/`, como arriba.)

Deja `desktop/release/GameHub Setup 1.0.0.exe`. **Compílalo en Windows** (o en GitHub
Actions, ver abajo): desde WSL/Linux, `electron-builder` necesita Wine.

## Publicar una versión

1. Sube la versión en `desktop/package.json` (y en `frontend/package.json` para que
   coincida) y apunta los cambios en `CHANGELOG.md`. Añade también la entrada de la
   versión en `NOVEDADES` de `desktop/actualizaciones.js`: es la lista que enseña el aviso
   "GameHub se ha actualizado a la versión X" (si falta, el aviso sale sin lista).
2. En GitHub, crea la variable de repositorio `GAMEHUB_API_URL` (Settings → Secrets and
   variables → Actions → Variables).
3. Haz commit y sube la etiqueta:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. El flujo [`.github/workflows/release.yml`](../.github/workflows/release.yml) compila el
   instalador en un Windows de GitHub y lo adjunta a la Release `v1.0.0`.

### Cómo se actualiza una app instalada

Las apps ya instaladas buscan sus actualizaciones en esas Releases al arrancar
(`electron-updater`). Solo comprueban al arrancar, no mientras están abiertas.

1. Si hay una versión nueva, la **descarga en segundo plano**, sin molestar.
2. Al terminar, la app **pregunta**: *Reiniciar ahora* (instala en silencio y vuelve a
   abrirse) o *Más tarde* (se instala sola al cerrar GameHub).
3. La primera vez que se abre la versión nueva, un aviso dice "GameHub se ha actualizado a
   la versión X" con las novedades (`desktop/actualizaciones.js`). Solo se enseña una vez.

**Ojo con la primera actualización tras añadir estos avisos:** quien aplica una
actualización es el código de la versión ya instalada. La 1.0.0 no tiene la pregunta del
punto 2, así que pasa a la 1.1.0 en silencio (con la notificación del sistema y
actualizándose al cerrar); el aviso del punto 3 sí lo enseña la 1.1.0. La pregunta del
punto 2 aparece a partir de la actualización de la 1.1.0 a la siguiente.

El instalador solo lleva los archivos de `build.files` (en `package.json`): si `main.js`
carga un archivo local nuevo, añádelo ahí. `npm test` lo comprueba, porque la prueba de
humo corre desde el código fuente y no lo detectaría.

## Aviso de Windows "editor desconocido"

El instalador no está **firmado** (un certificado de firma de código cuesta dinero), así
que SmartScreen mostrará "Windows protegió su PC" y habrá que pulsar *Más información →
Ejecutar de todos modos*. Es normal en un proyecto sin certificado; no indica un problema
del instalador.

## Seguridad

- `contextIsolation`, `sandbox` y sin `nodeIntegration`: la interfaz no tiene acceso a Node.
- **CSP**: solo carga scripts de la propia app y solo se conecta al servidor configurado
  (más `images.igdb.com` para recortar fotos de perfil).
- Los enlaces externos se abren en el navegador; la ventana nunca navega fuera de la app.
- La interfaz se sirve con un protocolo propio y se bloquea cualquier ruta con `../`.

## Limitaciones conocidas de la 1.0

- Solo Windows (la configuración de `electron-builder` solo define el objetivo `win`).
- Instalador sin firmar (ver arriba).
- La actualización automática depende de las Releases públicas de GitHub.

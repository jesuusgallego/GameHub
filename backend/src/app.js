require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const { limitadorGeneral } = require('./middleware/limitadores');
const gameRoutes = require('./routes/gameRoutes');
const profileRoutes = require('./routes/profileRoutes');
const accountRoutes = require('./routes/accountRoutes');
const userRoutes = require('./routes/userRoutes');
const friendRoutes = require('./routes/friendRoutes');
const { iniciarSincronizacionAutomatica } = require('./services/sincronizacionAutomatica');

const PORT = process.env.PORT || 4000;
const EN_PRODUCCION = process.env.NODE_ENV === 'production';

// Con JWT_SECRET vacío o corto los tokens se pueden falsificar. Prefiero no arrancar
// a arrancar con la seguridad rota sin enterarme. En desarrollo solo exijo que exista.
if (!process.env.JWT_SECRET || (EN_PRODUCCION && process.env.JWT_SECRET.length < 32)) {
  console.error(
    'Falta JWT_SECRET en el .env (en producción debe tener al menos 32 caracteres). ' +
    'Puedes generar uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

const app = express();

// Detrás de un proxy (nginx, Render, Fly...) la IP real del cliente llega en la
// cabecera X-Forwarded-For. TRUST_PROXY es cuántos proxies hay delante (normalmente 1);
// sin ello los limitadores de peticiones verían a todos los usuarios como uno solo.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Cabeceras de seguridad (helmet). La política de recursos la dejo en "cross-origin"
// porque la app de escritorio y el navegador piden esta API desde otro origen.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS_ORIGINS: orígenes que pueden llamar a la API, separados por comas. Sin definir,
// cualquiera (cómodo en desarrollo). La app de escritorio carga la interfaz desde
// app://gamehub, y ese es el origen que manda al llamar a la API: hay que incluirlo.
const origenesPermitidos = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(origenesPermitidos.length > 0 ? { origin: origenesPermitidos } : undefined));

app.use(limitadorGeneral);
// La foto de perfil viaja en el JSON como texto (base64), así que subo el límite
// por defecto de 100 KB. El frontend la reduce a ~256 px antes de enviarla.
app.use(express.json({ limit: '1mb' }));
app.use('/games', gameRoutes);
app.use('/profile', profileRoutes);
app.use('/accounts', accountRoutes);
app.use('/users', userRoutes);
app.use('/friends', friendRoutes);

// Compruebo a la vez el servidor y la base de datos: si la BD no responde, devuelvo 500
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      server_time: new Date(),
      db_time: result.rows[0].now,
    });
  } catch (err) {
    console.error('Error en /health:', err);
    res.status(500).json({ status: 'error', message: 'No se pudo conectar a la base de datos' });
  }
});

app.use('/auth', authRoutes);

// Crea las tablas y añade las columnas que falten ejecutando schema.sql. El archivo es
// idempotente (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS), así que se puede
// lanzar en cada arranque: una BD nueva queda lista y una antigua se actualiza sola,
// sin que nadie tenga que acordarse de ejecutar el SQL a mano.
// Reintento unas veces porque en Docker la BD puede tardar unos segundos en aceptar
// conexiones.
async function aplicarEsquema() {
  const sql = fs.readFileSync(path.join(__dirname, 'models', 'sql', 'schema.sql'), 'utf8');

  for (let intento = 1; ; intento++) {
    try {
      await pool.query(sql);
      return;
    } catch (err) {
      if (intento >= 10) throw err;
      console.log(`Esperando a la base de datos (${intento}/10): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

aplicarEsquema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      iniciarSincronizacionAutomatica();
    });
  })
  .catch((err) => {
    console.error('No se pudo preparar la base de datos:', err.message);
    process.exit(1);
  });

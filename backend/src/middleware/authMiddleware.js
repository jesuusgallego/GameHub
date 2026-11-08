const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Comprueba el token de la cabecera y deja el usuario en req.user. Además de la firma y
// la caducidad (que ya valida jwt.verify), mira en la base de datos que la sesión siga
// vigente: un token es "stateless" y, sin esa consulta, cambiar la contraseña no cerraría
// las sesiones que ya estaban abiertas (seguirían valiendo hasta que caducaran a los 7
// días). El coste es una consulta por petición, con el id como clave primaria.
async function verifyToken(req, res, next) {
  // Espero la cabecera "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  return comprobarToken(authHeader, req, res, next);
}

// Para lo que se puede usar SIN cuenta (leer noticias, buscar juegos, ver su ficha): sin la
// cabecera Authorization deja req.user = null (un invitado) y sigue. Si la cabecera viene, se
// comprueba igual que en verifyToken: un token caducado sigue dando 401, para que la interfaz
// cierre la sesión en vez de enseñar como invitado a quien cree que ha entrado.
async function sesionOpcional(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.user = null;
    return next();
  }
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  return comprobarToken(authHeader, req, res, next);
}

// Lo común a los dos: la firma, la caducidad y que la sesión siga vigente en la base de datos
async function comprobarToken(authHeader, req, res, next) {
  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const result = await pool.query('SELECT token_version FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      // El token es válido pero la cuenta ya no existe (se borró)
      return res.status(401).json({ error: 'La cuenta no existe' });
    }

    // Los tokens emitidos antes de existir la versión no llevan `v`: cuentan como 0
    if ((decoded.v ?? 0) !== result.rows[0].token_version) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Dejo el usuario en req.user para que lo lean los controladores
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (err) {
    console.error('Error comprobando la sesión:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = verifyToken;
module.exports.sesionOpcional = sesionOpcional;

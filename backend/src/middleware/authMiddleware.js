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

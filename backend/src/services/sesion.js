// Emisión de los tokens de sesión (JWT). Un único sitio para que el inicio de sesión y
// el cambio de contraseña firmen exactamente lo mismo.
const jwt = require('jsonwebtoken');

// El token lleva el id y el nombre del usuario, caduca a los 7 días y lleva `v`: la
// versión de sesión de su dueño (users.token_version). El middleware compara `v` con la
// de la base de datos en cada petición; si no coinciden, el token ya no vale.
function emitirToken({ id, username, token_version }) {
  return jwt.sign(
    { userId: id, username, v: token_version },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { emitirToken };

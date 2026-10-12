// Reglas de validación y constantes de contraseñas que comparten varios controladores.
// El frontend tiene las mismas reglas en frontend/src/validacion.js: si cambias una
// aquí, cámbiala allí (hay una prueba que comprueba que coinciden).

// Formato mínimo de un email: algo@algo.algo, sin espacios
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Al menos 8 caracteres, con una minúscula, una mayúscula y un número
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Dos mensajes porque al registrarse no hay una contraseña "nueva" ni "actual"
const MENSAJE_PASSWORD_DEBIL =
  'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';
const MENSAJE_PASSWORD_REGISTRO =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';

// Longitud máxima del nombre de usuario (la columna es VARCHAR(50))
const USERNAME_MAX = 50;

// Coste de bcrypt: cada +1 duplica el tiempo de calcular un hash
const SALT_ROUNDS = 10;

module.exports = {
  EMAIL_REGEX, PASSWORD_REGEX, MENSAJE_PASSWORD_DEBIL, MENSAJE_PASSWORD_REGISTRO, USERNAME_MAX, SALT_ROUNDS,
};

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

// Nombre de usuario: de 3 a 20 caracteres, solo letras MAYÚSCULAS sin tilde (A-Z),
// números y guion bajo. Ir siempre en mayúsculas hace que sea único sin ambigüedad
// ("ana" y "Ana" no pueden convivir: los dos serían ANA). Tampoco admite "@": así, al
// iniciar sesión, un texto con "@" es un email y uno sin "@" es un nombre de usuario.
// La base de datos tiene la misma regla como CHECK (schema.sql).
const USERNAME_REGEX = /^[A-Z0-9_]{3,20}$/;

// El texto exacto está también en frontend/src/textos/en.js (erroresApi): ahí se traduce
const MENSAJE_USERNAME =
  'El nombre de usuario debe tener de 3 a 20 caracteres: solo letras MAYÚSCULAS, números y guion bajo';

// Coste de bcrypt: cada +1 duplica el tiempo de calcular un hash
const SALT_ROUNDS = 10;

module.exports = {
  EMAIL_REGEX, PASSWORD_REGEX, MENSAJE_PASSWORD_DEBIL, MENSAJE_PASSWORD_REGISTRO,
  USERNAME_REGEX, MENSAJE_USERNAME, SALT_ROUNDS,
};

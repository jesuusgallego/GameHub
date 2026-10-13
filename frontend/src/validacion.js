// Reglas de validación de los formularios. Son las mismas que aplica el servidor
// (backend/src/config/validacion.js): el formulario las comprueba para avisar al
// momento, pero la que manda es la del servidor. Hay una prueba que comprueba que
// coinciden.

// Formato mínimo de un email: algo@algo.algo, sin espacios
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Al menos 8 caracteres, con una minúscula, una mayúscula y un número
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

// Nombre de usuario: de 3 a 20 caracteres, solo letras MAYÚSCULAS sin tilde, números y
// guion bajo (la regla completa, y el porqué, en el servidor).
export const usernameRegex = /^[A-Z0-9_]{3,20}$/
export const USERNAME_MAX = 20

// Deja lo que se escribe en el campo del nombre de usuario ya "limpio": pasa a
// mayúsculas, quita las tildes ("José" -> "JOSE", la Ñ pasa a N) y descarta lo que no
// se admite (espacios, símbolos). Así el campo no deja escribir minúsculas ni
// caracteres raros: no hace falta avisar de ellos después.
export function normalizarUsername(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
}

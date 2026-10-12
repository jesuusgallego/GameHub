// Reglas de validación de los formularios. Son las mismas que aplica el servidor
// (backend/src/config/validacion.js): el formulario las comprueba para avisar al
// momento, pero la que manda es la del servidor. Hay una prueba que comprueba que
// coinciden.

// Formato mínimo de un email: algo@algo.algo, sin espacios
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Al menos 8 caracteres, con una minúscula, una mayúscula y un número
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

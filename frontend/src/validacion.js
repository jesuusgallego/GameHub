// Reglas de validación de los formularios. Son las mismas que aplica el servidor
// (backend/src/config/validacion.js): el formulario las comprueba para avisar al
// momento, pero la que manda es la del servidor. Hay una prueba que comprueba que
// coinciden.

// Formato mínimo de un email: algo@algo.algo, sin espacios
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Al menos 8 caracteres, con una minúscula, una mayúscula y un número
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

// Nombre de usuario: de 3 a 20 caracteres, solo letras minúsculas sin tilde, números y
// guion bajo (la regla completa, y el porqué, en el servidor).
export const usernameRegex = /^[a-z0-9_]{3,20}$/
export const USERNAME_MAX = 20

// Deja lo que se escribe en el campo del nombre de usuario ya "limpio": pasa a
// minúsculas, quita las tildes ("José" -> "jose", la Ñ pasa a n) y descarta lo que no
// se admite (espacios, símbolos). Así el campo no deja escribir mayúsculas ni
// caracteres raros: no hace falta avisar de ellos después.
export function normalizarUsername(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
}

// ---- Datos personales del perfil (opcionales; mismas reglas que el servidor) ----

// Valores de "sexo" (sin elegir se manda null)
export const SEXOS = ['hombre', 'mujer', 'otro']

// Quién puede ver una parte del perfil (mismas opciones que el servidor)
export const VISIBILIDADES = ['nadie', 'amigos', 'todos']

// Longitud máxima de cada texto
export const LIMITES_PERFIL = { first_name: 50, last_name: 100, location: 100 }

// Una fecha de nacimiento no puede ser de hace más de tantos años
export const EDAD_MAX = 120

// Edad mínima para tener cuenta (la misma que en el servidor: RGPD y LOPDGDD, art. 7)
export const EDAD_MINIMA = 14

// Chat: longitud máxima de un mensaje (la misma que en el servidor y en la base de datos)
export const MENSAJE_MAX = 2000

// Chats de grupo: nombre de hasta tantos caracteres y como mucho tantas personas contándote
export const GRUPO_NOMBRE_MAX = 50
export const GRUPO_MAX_MIEMBROS = 10

// "AAAA-MM-DD" con el día de hoy, en la zona horaria de quien lo mira
function aFechaIso(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

// El mínimo y el máximo que admite el campo de fecha de nacimiento: de hace EDAD_MAX años a
// hace EDAD_MINIMA (quien es más joven no puede tener cuenta). `hoy` solo se pasa en las pruebas.
export function limitesFechaNacimiento(hoy = new Date()) {
  const masAntigua = new Date(hoy.getFullYear() - EDAD_MAX, hoy.getMonth(), hoy.getDate())
  const masReciente = new Date(hoy.getFullYear() - EDAD_MINIMA, hoy.getMonth(), hoy.getDate())
  return { min: aFechaIso(masAntigua), max: aFechaIso(masReciente) }
}

// Los años cumplidos a fecha de `hoy` por quien nació en "AAAA-MM-DD", con el calendario de
// quien lo mira. Quien nació un 29 de febrero los cumple el 1 de marzo en los años que no son
// bisiestos (igual que edadCumplida en el servidor).
export function edadCumplida(texto, hoy = new Date()) {
  const [anio, mes, dia] = texto.split('-').map(Number)
  const mesHoy = hoy.getMonth() + 1
  let edad = hoy.getFullYear() - anio
  if (mesHoy < mes || (mesHoy === mes && hoy.getDate() < dia)) edad -= 1
  return edad
}

// Qué le pasa a una fecha de nacimiento escrita en el formulario: 'vacia', 'invalida' (fuera
// de los límites o mal escrita), 'menor' (menos de EDAD_MINIMA años) o null si vale
export function problemaFechaNacimiento(texto, hoy = new Date()) {
  if (!texto) return 'vacia'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return 'invalida'
  const { min } = limitesFechaNacimiento(hoy)
  if (texto < min || texto > aFechaIso(hoy)) return 'invalida'
  if (edadCumplida(texto, hoy) < EDAD_MINIMA) return 'menor'
  return null
}

// Deja el teléfono en su forma canónica, igual que el servidor: sin espacios, guiones,
// puntos ni paréntesis, y con "+" en lugar del "00" ("0034 600-123-456" -> "+34600123456").
// No comprueba que sea válido (eso lo hace libphonenumber, en telefono.js).
export function normalizarTelefono(texto) {
  return texto.replace(/[\s().-]/g, '').replace(/^00/, '+')
}

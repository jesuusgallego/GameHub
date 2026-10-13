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

// Nombre de usuario: de 3 a 20 caracteres, solo letras minúsculas sin tilde (a-z),
// números y guion bajo. Ir siempre en minúsculas hace que sea único sin ambigüedad
// ("Ana" y "ana" no pueden convivir: los dos serían ana). Tampoco admite "@": así, al
// iniciar sesión, un texto con "@" es un email y uno sin "@" es un nombre de usuario.
// La base de datos tiene la misma regla como CHECK (schema.sql).
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// El texto exacto está también en frontend/src/textos/en.js (erroresApi): ahí se traduce
const MENSAJE_USERNAME =
  'El nombre de usuario debe tener de 3 a 20 caracteres: solo letras minúsculas, números y guion bajo';

// ---- Datos personales del perfil (todos opcionales) --------------------------------

// Opciones de "sexo". Sin elegir se guarda NULL. La base de datos tiene el mismo CHECK.
const SEXOS = ['hombre', 'mujer', 'otro'];

// Campos de texto libre: longitud máxima (la de su columna VARCHAR) y mensaje de error.
// Los mensajes también están en en.js (erroresApi).
const TEXTOS_PERFIL = {
  first_name: { max: 50, mensaje: 'El nombre no es válido (máximo 50 caracteres)' },
  last_name: { max: 100, mensaje: 'Los apellidos no son válidos (máximo 100 caracteres)' },
  location: { max: 100, mensaje: 'La localización no es válida (máximo 100 caracteres)' },
};

const MENSAJE_SEXO = 'El sexo no es válido';
const MENSAJE_PAIS = 'El país no es válido';
const MENSAJE_TELEFONO =
  'El teléfono no es válido: escríbelo con el prefijo del país, por ejemplo +34 600 123 456';

// Teléfono en formato internacional: "+", prefijo del país (no empieza por 0) y de 7 a 15
// dígitos en total. La base de datos tiene el mismo CHECK. No se verifica que el número
// exista ni que sea de quien lo escribe.
const TELEFONO_REGEX = /^\+[1-9][0-9]{6,14}$/;

// Deja el teléfono en su forma canónica: sin espacios, guiones, puntos ni paréntesis, y
// con "+" en lugar del "00" de las llamadas internacionales ("0034 600-123-456" ->
// "+34600123456"). No comprueba que sea válido. El formulario hace lo mismo
// (normalizarTelefono en frontend/src/validacion.js).
function normalizarTelefono(texto) {
  return texto.replace(/[\s().-]/g, '').replace(/^00/, '+');
}
const MENSAJE_FECHA_NACIMIENTO = 'La fecha de nacimiento no es válida';

// Edad máxima creíble: una fecha más antigua se toma por una errata
const EDAD_MAX = 120;
const PAISES = require('./paises');

// Deja un texto del perfil listo para guardar: recortado, y NULL si queda vacío (borrar
// el campo). Devuelve undefined si no vale: no es texto, es demasiado largo o lleva
// caracteres de control (saltos de línea, etc.).
function limpiarTextoPerfil(campo, valor) {
  if (valor === null) return null;
  if (typeof valor !== 'string') return undefined;

  const texto = valor.trim();
  if (texto === '') return null;

  // [...texto] cuenta personas-caracteres, no unidades UTF-16: así lo cuenta VARCHAR
  if ([...texto].length > TEXTOS_PERFIL[campo].max || /\p{Cc}/u.test(texto)) return undefined;
  return texto;
}

// Deja el teléfono listo para guardar: en forma canónica y NULL si va vacío. Devuelve
// undefined si no es texto o no es un teléfono internacional válido.
function limpiarTelefono(valor) {
  if (valor === null) return null;
  if (typeof valor !== 'string') return undefined;

  const telefono = normalizarTelefono(valor);
  if (telefono === '') return null;
  return TELEFONO_REGEX.test(telefono) ? telefono : undefined;
}

// "AAAA-MM-DD", una fecha que existe (no 2020-02-30), que no es futura y de hace menos de
// EDAD_MAX años. `hoy` solo se pasa en las pruebas.
function fechaNacimientoValida(texto, hoy = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;

  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  // Date "corrige" las fechas imposibles (30 de febrero -> 1 de marzo): si algo cambió,
  // la fecha que me han dado no existía
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return false;
  }

  const hoyUtc = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const masAntigua = Date.UTC(hoy.getUTCFullYear() - EDAD_MAX, hoy.getUTCMonth(), hoy.getUTCDate());
  return fecha.getTime() <= hoyUtc && fecha.getTime() >= masAntigua;
}

// Coste de bcrypt: cada +1 duplica el tiempo de calcular un hash
const SALT_ROUNDS = 10;

module.exports = {
  EMAIL_REGEX, PASSWORD_REGEX, MENSAJE_PASSWORD_DEBIL, MENSAJE_PASSWORD_REGISTRO,
  USERNAME_REGEX, MENSAJE_USERNAME, SALT_ROUNDS,
  SEXOS, TEXTOS_PERFIL, MENSAJE_SEXO, MENSAJE_FECHA_NACIMIENTO, EDAD_MAX,
  PAISES, MENSAJE_PAIS, MENSAJE_TELEFONO, TELEFONO_REGEX, normalizarTelefono,
  limpiarTextoPerfil, limpiarTelefono, fechaNacimientoValida,
};

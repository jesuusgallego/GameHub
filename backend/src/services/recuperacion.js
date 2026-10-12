// Lógica pura de la recuperación de contraseña: generar el código y comprobarlo.
// No toca la base de datos ni envía nada, así se puede probar sin servidor.
const crypto = require('crypto');

// Cuánto vale un código, cuántas veces se puede probar y cuánto hay que esperar
// entre un código y el siguiente
const MINUTOS_VALIDEZ = 15;
const MAX_INTENTOS = 5;
const ESPERA_SEGUNDOS = 60;

// Código de 6 dígitos. crypto.randomInt es aleatorio de verdad (Math.random no
// lo es: se puede predecir). padStart conserva los ceros del principio ("004217").
function generarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Lo que se guarda en la base de datos: un HMAC del código con el JWT_SECRET del
// servidor y el id del usuario. Con eso, aunque alguien leyera la tabla, no podría
// calcular los códigos sin el secreto, y un código de un usuario no vale para otro.
function huellaDelCodigo(userId, codigo) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${userId}:${codigo}`)
    .digest('hex');
}

// ¿El código escrito corresponde a la huella guardada? timingSafeEqual compara en
// tiempo constante (== termina antes al primer carácter distinto, y eso filtra
// información). Solo admito 6 dígitos: cualquier otra cosa es "no".
function codigoCorrecto(userId, codigoEscrito, huellaGuardada) {
  if (typeof codigoEscrito !== 'string' || !/^\d{6}$/.test(codigoEscrito)) return false;
  const a = Buffer.from(huellaDelCodigo(userId, codigoEscrito), 'hex');
  const b = Buffer.from(String(huellaGuardada), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { MINUTOS_VALIDEZ, MAX_INTENTOS, ESPERA_SEGUNDOS, generarCodigo, huellaDelCodigo, codigoCorrecto };

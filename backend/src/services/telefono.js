// Validación de teléfonos. Vive aparte de config/validacion.js porque necesita una
// librería (libphonenumber-js) y ese archivo no puede tener dependencias: ver su cabecera.
const { parsePhoneNumberFromString } = require('libphonenumber-js/min');
const { normalizarTelefono } = require('../config/validacion');

// Un teléfono se guarda en formato E.164 ("+34600123456"); la columna tiene un CHECK con esa
// forma (schema.sql). No se verifica que el número exista ni que sea de quien lo escribe.
//
// Deja el teléfono listo para guardar: en forma canónica y NULL si va vacío. Devuelve
// undefined si no es texto o no es un número válido. La validez la decide libphonenumber
// (la librería de Google que usan Android y muchas apps): conoce el prefijo de cada país
// y qué longitudes y comienzos admite su numeración, algo que una expresión regular no sabe.
// Sin país por defecto: el número tiene que venir completo, con su "+" y su prefijo (el
// formulario ya junta el prefijo elegido con el número).
function limpiarTelefono(valor) {
  if (valor === null) return null;
  if (typeof valor !== 'string') return undefined;

  const texto = normalizarTelefono(valor);
  if (texto === '') return null;

  const telefono = parsePhoneNumberFromString(texto);
  if (!telefono || !telefono.isValid()) return undefined;
  // "+34 600 123 456 ext 2": la librería entiende la extensión pero .number la
  // descartaría, y se guardaría un número distinto del que se escribió
  if (telefono.ext) return undefined;
  // .number es la forma E.164 ("+34600123456"), la que guarda la columna
  return telefono.number;
}

module.exports = { limpiarTelefono };

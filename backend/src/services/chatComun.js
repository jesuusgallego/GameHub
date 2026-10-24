// Lo que comparten el chat entre dos personas (chatController) y el de grupos
// (gruposController): leer ids de la URL, limpiar el texto de un mensaje y el error 500.
const { MENSAJE_MAX, GRUPO_NOMBRE_MAX } = require('../config/validacion');

// Cuántos mensajes salen de golpe al abrir una conversación o al pedir los anteriores
const PAGINA = 50;
// Cuántos mensajes recientes se revisan en cada consulta para enterarse de los borrados
const VENTANA_BORRADOS = 200;

function errorInterno(res, nombre, err) {
  console.error(`Error en ${nombre}:`, err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

// Un id que viene en la URL o en la consulta: entero positivo que cabe en un SERIAL, o null
function entero(texto) {
  return typeof texto === 'string' && /^[1-9][0-9]{0,9}$/.test(texto) && Number(texto) <= 2147483647
    ? Number(texto)
    : null;
}

// Lee ?after= y ?before= de una conversación. Devuelve { despues, antes } (null si no vienen)
// o null si alguno no es un id válido.
function leerPaginacion(query) {
  const despues = query.after === undefined ? null : entero(query.after);
  const antes = query.before === undefined ? null : entero(query.before);
  if ((query.after !== undefined && despues === null) || (query.before !== undefined && antes === null)) {
    return null;
  }
  return { despues, antes };
}

// Lo que se puede escribir en un mensaje: salto de línea (\n) y tabulador, pero ningún otro
// carácter de control. Un NUL (\0) además hace fallar a Postgres.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Deja el texto listo para guardar: saltos de Windows a \n, sin caracteres de control, sin
// espacios ni saltos en los extremos y como mucho una línea en blanco seguida. Devuelve null
// si no es texto o queda vacío o demasiado largo.
function limpiarMensaje(texto) {
  if (typeof texto !== 'string') return null;
  const limpio = texto
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return limpio.length >= 1 && limpio.length <= MENSAJE_MAX ? limpio : null;
}

// El nombre de un grupo: una sola línea, sin caracteres de control, con los espacios seguidos
// juntados en uno y de 1 a GRUPO_NOMBRE_MAX caracteres. null si no vale.
function limpiarNombreGrupo(texto) {
  if (typeof texto !== 'string' || /\p{Cc}/u.test(texto)) return null;
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const largo = [...limpio].length; // personas-caracteres, como cuenta VARCHAR
  return largo >= 1 && largo <= GRUPO_NOMBRE_MAX ? limpio : null;
}

// El aviso de "escribiendo" llega como { active: false } al vaciar el cuadro; cualquier otra
// cosa (o nada) cuenta como que sigues escribiendo
function sigueEscribiendo(body) {
  return body?.active !== false;
}

module.exports = {
  PAGINA, VENTANA_BORRADOS, errorInterno, entero, leerPaginacion, limpiarMensaje, limpiarNombreGrupo,
  sigueEscribiendo,
};

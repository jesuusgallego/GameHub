// "Está escribiendo...": quién está escribiendo en cada conversación ahora mismo.
//
// Es un dato que vive unos segundos, así que va en la memoria del servidor y no en la base de
// datos (guardarlo ahí sería una escritura cada pocos segundos por persona, y Neon gratis tiene
// las horas de cómputo contadas). Funciona así:
//  - mientras escribes, la interfaz avisa cada pocos segundos (POST .../typing);
//  - cada aviso apunta la hora; pasados DURACION_MS sin otro aviso, dejas de "estar escribiendo";
//  - al enviar el mensaje (o vaciar el cuadro) se borra en el acto.
// Quien mira la conversación se entera al sondear (GET de la conversación), que ya hace cada
// pocos segundos: no hace falta ninguna conexión nueva.
//
// Limitación: si algún día hubiera varias copias del servidor, cada una tendría su propia
// memoria y el aviso solo llegaría a quien preguntara a la misma. En Render gratis hay una.

// Cuánto dura un aviso. La interfaz los repite más a menudo (ver Conversacion.jsx).
const DURACION_MS = 5000;

// conversación -> (id de persona -> hora del último aviso)
// La conversación es un texto: 'u:3-8' para dos personas (los ids en orden) o 'g:12' para un grupo
const conversaciones = new Map();

function claveDosPersonas(a, b) {
  return a < b ? `u:${a}-${b}` : `u:${b}-${a}`;
}

function claveGrupo(id) {
  return `g:${id}`;
}

// Apunta que `usuarioId` está escribiendo (activo = true) o que ha dejado de hacerlo
function marcar(clave, usuarioId, activo = true, ahora = Date.now()) {
  if (!activo) {
    const personas = conversaciones.get(clave);
    personas?.delete(usuarioId);
    if (personas?.size === 0) conversaciones.delete(clave);
    return;
  }
  if (!conversaciones.has(clave)) conversaciones.set(clave, new Map());
  conversaciones.get(clave).set(usuarioId, ahora);
}

// Los ids de quienes están escribiendo en esa conversación, salvo `excepto` (yo)
function quienes(clave, excepto, ahora = Date.now()) {
  const personas = conversaciones.get(clave);
  if (!personas) return [];
  const ids = [];
  for (const [id, hora] of personas) {
    if (ahora - hora >= DURACION_MS) personas.delete(id);
    else if (id !== excepto) ids.push(id);
  }
  if (personas.size === 0) conversaciones.delete(clave);
  return ids;
}

// Quita lo caducado de todas las conversaciones. Sin esto, una conversación en la que alguien
// escribió una vez y nadie volvió a mirar se quedaría en memoria para siempre.
function limpiar(ahora = Date.now()) {
  for (const clave of conversaciones.keys()) quienes(clave, null, ahora);
}

// Cada minuto. unref(): este temporizador no impide que el proceso termine (pruebas, apagado).
setInterval(limpiar, 60_000).unref();

// Solo para las pruebas
function vaciar() {
  conversaciones.clear();
}

module.exports = { DURACION_MS, claveDosPersonas, claveGrupo, marcar, quienes, limpiar, vaciar };

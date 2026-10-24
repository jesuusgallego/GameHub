const rateLimit = require('express-rate-limit');

// Limitadores de peticiones por IP. Sin ellos, cualquiera puede probar contraseñas
// sin freno (login) o llenar la base de datos de cuentas falsas (registro).
// Cada uno cuenta las peticiones de una IP dentro de una "ventana" de tiempo; al
// pasarse del máximo, responde 429 hasta que la ventana termina.
//
// Importante detrás de un proxy (nginx, Render, Fly...): sin app.set('trust proxy')
// todas las peticiones parecerían venir de la IP del proxy y se bloquearían entre sí.
// Eso se configura con TRUST_PROXY en app.js.

function limitador({ ventanaMinutos, maximo, ...resto }) {
  return rateLimit({
    windowMs: ventanaMinutos * 60 * 1000,
    limit: maximo,
    standardHeaders: 'draft-7', // cabecera RateLimit con lo que queda, para quien quiera leerla
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a probar' });
    },
    ...resto,
  });
}

// Login: 10 intentos FALLIDOS cada 15 minutos. skipSuccessfulRequests hace que un
// inicio de sesión correcto no cuente, así un usuario normal nunca lo nota.
const limitadorLogin = limitador({ ventanaMinutos: 15, maximo: 10, skipSuccessfulRequests: true });

// Registro: 10 cuentas nuevas por hora y por IP
const limitadorRegistro = limitador({ ventanaMinutos: 60, maximo: 10 });

// Recuperación de contraseña. Pedir códigos: 5 por hora y por IP (cada uno envía un
// correo, y Brevo gratis da 300 al día para todos). Probar códigos: 10 cada 15 minutos;
// además, cada código se invalida solo a los 5 intentos fallidos (ver authController).
const limitadorPedirCodigo = limitador({ ventanaMinutos: 60, maximo: 5 });
const limitadorUsarCodigo = limitador({ ventanaMinutos: 15, maximo: 10 });

// Buscar personas: 60 búsquedas cada 5 minutos por IP. La interfaz espera a que dejes de
// escribir antes de buscar, así que un uso normal queda muy por debajo.
const limitadorBusqueda = limitador({ ventanaMinutos: 5, maximo: 60 });

// Solicitudes de amistad: 30 por hora y por IP. Sin tope, una cuenta podría llenar de
// solicitudes a todo el que encuentre.
const limitadorSolicitudes = limitador({ ventanaMinutos: 60, maximo: 30 });

// Logros de un juego de otra persona: 40 cada 10 minutos por IP. Cada petición hace dos
// consultas a Steam, y la clave de la app tiene un tope diario para todos los usuarios.
const limitadorLogros = limitador({ ventanaMinutos: 10, maximo: 40 });

// Mensajes del chat: 60 por minuto y por IP. Una conversación animada no pasa de unos pocos por
// minuto; el tope corta a quien envíe mensajes en bucle a sus amigos.
const limitadorMensajes = limitador({ ventanaMinutos: 1, maximo: 60 });

// Leer el chat (lista de conversaciones, mensajes nuevos, no leídos, avisos de "escribiendo"):
// la interfaz lo repite cada pocos segundos mientras se usa (ver sondeo.js), unas 20 veces por
// minuto con una conversación abierta y otras 20 mientras escribes. Por eso no cuenta en el
// tope general por IP, donde dos amigos chateando desde la misma casa se lo comerían; tiene el
// suyo, POR USUARIO (90 por minuto, el doble de lo normal). Va después de verifyToken: necesita
// saber quién es.
const limitadorLecturaChat = limitador({
  ventanaMinutos: 1,
  maximo: 90,
  keyGenerator: (req) => `chat-${req.user.id}`,
});

// Registro de lo que pasa con las noticias (impresiones y clics, por tandas): 120 tandas por minuto
// y por usuario. La interfaz manda una cada pocos segundos como mucho mientras desplazas.
const limitadorEventosNoticias = limitador({
  ventanaMinutos: 1,
  maximo: 120,
  keyGenerator: (req) => `noticias-${req.user.id}`,
});

// ¿Es una lectura del chat con sesión? Esas peticiones las limita limitadorLecturaChat. Los
// avisos de "escribiendo" (POST .../typing, uno cada pocos segundos mientras escribes) cuentan
// como lecturas por lo mismo: se repiten mucho y no guardan nada.
function esLecturaChat(req) {
  const delChat = req.path === '/chat' || req.path.startsWith('/chat/');
  const esLectura = req.method === 'GET' || (req.method === 'POST' && req.path.endsWith('/typing'));
  return delChat && esLectura && Boolean(req.headers.authorization?.startsWith('Bearer '));
}

// Tope general para todo lo demás. Es alto a propósito (un uso normal ni se acerca);
// solo corta a quien automatiza peticiones sin parar.
const limitadorGeneral = limitador({ ventanaMinutos: 15, maximo: 1000, skip: esLecturaChat });

module.exports = {
  limitadorLogin, limitadorRegistro, limitadorPedirCodigo, limitadorUsarCodigo, limitadorGeneral,
  limitadorBusqueda, limitadorSolicitudes, limitadorLogros, limitadorMensajes, limitadorLecturaChat,
  limitadorEventosNoticias,
};

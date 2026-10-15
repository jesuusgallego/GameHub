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

// Tope general para todo lo demás. Es alto a propósito (un uso normal ni se acerca);
// solo corta a quien automatiza peticiones sin parar.
const limitadorGeneral = limitador({ ventanaMinutos: 15, maximo: 1000 });

module.exports = {
  limitadorLogin, limitadorRegistro, limitadorPedirCodigo, limitadorUsarCodigo, limitadorGeneral,
  limitadorBusqueda, limitadorSolicitudes, limitadorLogros,
};

// Pruebas de la recuperación de contraseña: el código y el correo (sin red ni base de datos).
// Se ejecutan con: npm test
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const axios = require('axios');

process.env.JWT_SECRET = 'secreto-de-prueba-secreto-de-prueba';

const { generarCodigo, huellaDelCodigo, codigoCorrecto } = require('../src/services/recuperacion');
const { enviarCodigoRecuperacion, ErrorCorreo } = require('../src/services/correoService');

test('el código tiene siempre 6 dígitos (también con ceros delante)', () => {
  for (let i = 0; i < 2000; i++) assert.match(generarCodigo(), /^\d{6}$/);
});

test('la huella no contiene el código y depende del usuario', () => {
  const h = huellaDelCodigo(7, '123456');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!h.includes('123456'));
  assert.notStrictEqual(h, huellaDelCodigo(8, '123456'), 'el mismo código en otro usuario da otra huella');
});

test('codigoCorrecto acepta el código bueno y rechaza lo demás', () => {
  const h = huellaDelCodigo(7, '004217');
  assert.strictEqual(codigoCorrecto(7, '004217', h), true);
  assert.strictEqual(codigoCorrecto(7, '004218', h), false);
  assert.strictEqual(codigoCorrecto(8, '004217', h), false, 'es de otro usuario');
  assert.strictEqual(codigoCorrecto(7, '4217', h), false, 'sin ceros no vale');
  assert.strictEqual(codigoCorrecto(7, '0042170', h), false);
  assert.strictEqual(codigoCorrecto(7, 4217, h), false, 'no es texto');
  assert.strictEqual(codigoCorrecto(7, '004217', 'basura'), false, 'huella guardada rara');
});

// ---- Correo -------------------------------------------------------------------
const enviados = [];
beforeEach(() => {
  enviados.length = 0;
  axios.post = async (url, cuerpo, opciones) => {
    enviados.push({ url, cuerpo, opciones });
    return { status: 201 };
  };
  delete process.env.BREVO_API_KEY;
  delete process.env.CORREO_REMITENTE;
  process.env.NODE_ENV = 'test';
});

test('con Brevo configurado envía el código al destinatario, en su idioma', async () => {
  process.env.BREVO_API_KEY = 'clave-falsa';
  process.env.CORREO_REMITENTE = 'yo@ejemplo.com';

  await enviarCodigoRecuperacion({ para: 'ana@ejemplo.com', username: 'Ana', codigo: '123456', minutos: 15, idioma: 'en' });

  assert.strictEqual(enviados.length, 1);
  const { url, cuerpo, opciones } = enviados[0];
  assert.strictEqual(url, 'https://api.brevo.com/v3/smtp/email');
  assert.strictEqual(opciones.headers['api-key'], 'clave-falsa');
  assert.deepStrictEqual(cuerpo.to, [{ email: 'ana@ejemplo.com' }]);
  assert.strictEqual(cuerpo.sender.email, 'yo@ejemplo.com');
  assert.ok(cuerpo.textContent.includes('123456'));
  assert.ok(cuerpo.subject.includes('recovery'), 'en inglés');
});

test('el nombre de usuario se escapa en el HTML', async () => {
  process.env.BREVO_API_KEY = 'clave-falsa';
  process.env.CORREO_REMITENTE = 'yo@ejemplo.com';

  await enviarCodigoRecuperacion({ para: 'a@b.co', username: '<img src=x onerror=alert(1)>', codigo: '123456', minutos: 15, idioma: 'es' });

  assert.ok(!enviados[0].cuerpo.htmlContent.includes('<img'));
  assert.ok(enviados[0].cuerpo.htmlContent.includes('&lt;img'));
});

test('sin configurar: en desarrollo no envía (escribe en consola) y en producción falla', async () => {
  const log = console.log;
  console.log = () => {};
  try {
    await enviarCodigoRecuperacion({ para: 'a@b.co', username: 'Ana', codigo: '123456', minutos: 15 });
  } finally {
    console.log = log;
  }
  assert.strictEqual(enviados.length, 0);

  process.env.NODE_ENV = 'production';
  await assert.rejects(
    () => enviarCodigoRecuperacion({ para: 'a@b.co', username: 'Ana', codigo: '123456', minutos: 15 }),
    ErrorCorreo
  );
});

test('si Brevo rechaza el correo, el error cuenta el motivo', async () => {
  process.env.BREVO_API_KEY = 'clave-falsa';
  process.env.CORREO_REMITENTE = 'yo@ejemplo.com';
  axios.post = async () => {
    const e = new Error('Request failed');
    e.response = { status: 400, data: { message: 'Sender is not valid' } };
    throw e;
  };

  await assert.rejects(
    () => enviarCodigoRecuperacion({ para: 'a@b.co', username: 'Ana', codigo: '123456', minutos: 15 }),
    (e) => e instanceof ErrorCorreo && e.message.includes('400') && e.message.includes('Sender is not valid')
  );
});

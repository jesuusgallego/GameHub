const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');
const {
  limitadorLogin, limitadorRegistro, limitadorPedirCodigo, limitadorUsarCodigo,
} = require('../middleware/limitadores');

router.post('/register', limitadorRegistro, register);
router.post('/login', limitadorLogin, login);
router.post('/forgot-password', limitadorPedirCodigo, forgotPassword);
router.post('/reset-password', limitadorUsarCodigo, resetPassword);

module.exports = router;

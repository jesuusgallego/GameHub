const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { sesionOpcional } = require('../middleware/authMiddleware');
const {
  listSources, setFollows, listFollowing, listForYou, logEvents, hideArticle, unhideArticle,
} = require('../controllers/newsController');
const { limitadorEventosNoticias, limitadorInvitados } = require('../middleware/limitadores');

// Leer las noticias se puede SIN cuenta (req.user = null): quien entra como invitado guarda sus
// portales en el navegador y los manda en ?sources= (ver newsController.js)
router.get('/sources', sesionOpcional, listSources);
router.get('/following', sesionOpcional, limitadorInvitados, listFollowing);
router.get('/for-you', sesionOpcional, limitadorInvitados, listForYou);

// Seguir portales en tu cuenta, el registro de lo que lees y "No me interesa", solo con sesión
router.use(verifyToken);

router.put('/follows', setFollows);
router.post('/events', limitadorEventosNoticias, logEvents);
router.post('/articles/:id/hide', hideArticle);
router.delete('/articles/:id/hide', unhideArticle);

module.exports = router;

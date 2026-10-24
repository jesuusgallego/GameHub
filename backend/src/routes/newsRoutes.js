const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  listSources, setFollows, listFollowing, listForYou, logEvents, hideArticle, unhideArticle,
} = require('../controllers/newsController');
const { limitadorEventosNoticias } = require('../middleware/limitadores');

// Las noticias exigen haber iniciado sesión
router.use(verifyToken);

router.get('/sources', listSources);
router.put('/follows', setFollows);
router.get('/following', listFollowing);
router.get('/for-you', listForYou);
router.post('/events', limitadorEventosNoticias, logEvents);
router.post('/articles/:id/hide', hideArticle);
router.delete('/articles/:id/hide', unhideArticle);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  searchUsers, getUserProfile, getUserGames, getUserFriends, getCommon, getUserGameAchievements, getAvatar,
} = require('../controllers/userController');
const { limitadorBusqueda, limitadorLogros } = require('../middleware/limitadores');

// La foto va ANTES de exigir sesión: un <img> no puede mandar la cabecera Authorization
router.get('/:username/avatar', getAvatar);

router.use(verifyToken);

// Importante: /search va antes de /:username, o "search" se tomaría por un nombre de usuario
router.get('/search', limitadorBusqueda, searchUsers);
router.get('/:username', getUserProfile);
router.get('/:username/games', getUserGames);
router.get('/:username/friends', getUserFriends);
router.get('/:username/common', getCommon);
// Cada petición son dos llamadas a Steam: un tope propio para que nadie las gaste todas
router.get('/:username/games/:igdbId/achievements', limitadorLogros, getUserGameAchievements);

module.exports = router;

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { sesionOpcional } = require('../middleware/authMiddleware');
const { limitadorInvitados } = require('../middleware/limitadores');
const { addGame, listGames, updateGame, deleteGame, search, details, artworks } = require('../controllers/gameController');

// Buscar en el catálogo de IGDB y ver la ficha de un juego se puede hacer SIN cuenta: no dependen
// de quién pregunta. Van antes del router.use(verifyToken) de abajo, que solo afecta a las rutas
// que se declaran después.
router.get('/search', sesionOpcional, limitadorInvitados, search);
router.get('/details/:igdbId', sesionOpcional, limitadorInvitados, details);

// Todo lo de tu biblioteca exige haber iniciado sesión
router.use(verifyToken);

router.post('/', addGame);
router.get('/', listGames);
router.get('/artworks', artworks);
router.patch('/:id', updateGame);
router.delete('/:id', deleteGame);

module.exports = router;

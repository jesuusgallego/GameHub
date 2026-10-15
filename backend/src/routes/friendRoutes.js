const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  listFriends, listActivity, listSuggestions, listRequests, countRequests, sendRequest, acceptRequest, deleteRequest,
  removeFriend, listBlocks, blockUser, unblockUser,
} = require('../controllers/friendController');
const { limitadorSolicitudes } = require('../middleware/limitadores');

// Amigos, solicitudes y bloqueos exigen haber iniciado sesión
router.use(verifyToken);

router.get('/', listFriends);
router.get('/activity', listActivity);
router.get('/suggestions', listSuggestions);

router.get('/requests', listRequests);
router.get('/requests/count', countRequests);
router.post('/requests', limitadorSolicitudes, sendRequest);
router.post('/requests/:id/accept', acceptRequest);
router.delete('/requests/:id', deleteRequest);

// /blocks va antes de /:username: si no, "blocks" se tomaría por el nombre de un amigo
router.get('/blocks', listBlocks);
router.post('/blocks', blockUser);
router.delete('/blocks/:username', unblockUser);

router.delete('/:username', removeFriend);

module.exports = router;

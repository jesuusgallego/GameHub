const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  listConversations, countUnread, getConversation, sendMessage, markRead, deleteMessage,
} = require('../controllers/chatController');
const { limitadorMensajes, limitadorLecturaChat } = require('../middleware/limitadores');

// El chat exige haber iniciado sesión
router.use(verifyToken);

router.get('/', limitadorLecturaChat, listConversations);
// /unread va antes de /:username: si no, "unread" se tomaría por el nombre de una persona
router.get('/unread', limitadorLecturaChat, countUnread);

router.get('/:username', limitadorLecturaChat, getConversation);
router.post('/:username', limitadorMensajes, sendMessage);
router.post('/:username/read', markRead);
router.delete('/:username/messages/:id', deleteMessage);

module.exports = router;

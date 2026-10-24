const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  listConversations, countUnread, getConversation, sendMessage, markRead, deleteMessage,
  clearConversation, typing,
} = require('../controllers/chatController');
const {
  createGroup, getGroup, sendGroupMessage, markGroupRead, deleteGroupMessage, renameGroup,
  addMembers, removeMember, clearGroup, groupTyping,
} = require('../controllers/gruposController');
const { limitadorMensajes, limitadorLecturaChat } = require('../middleware/limitadores');

// El chat exige haber iniciado sesión
router.use(verifyToken);

router.get('/', limitadorLecturaChat, listConversations);
// /unread va antes de /:username: si no, "unread" se tomaría por el nombre de una persona
router.get('/unread', limitadorLecturaChat, countUnread);

// Grupos, bajo /chat/g. "g" no puede ser un nombre de usuario (tienen al menos 3 caracteres),
// así que estas rutas nunca chocan con las de /chat/:username.
router.post('/g', limitadorMensajes, createGroup);
router.get('/g/:id', limitadorLecturaChat, getGroup);
router.post('/g/:id', limitadorMensajes, sendGroupMessage);
router.patch('/g/:id', limitadorMensajes, renameGroup);
router.post('/g/:id/read', markGroupRead);
router.post('/g/:id/typing', limitadorLecturaChat, groupTyping);
router.post('/g/:id/clear', clearGroup);
router.post('/g/:id/members', limitadorMensajes, addMembers);
router.delete('/g/:id/members/:username', removeMember);
router.delete('/g/:id/messages/:mid', deleteGroupMessage);

router.get('/:username', limitadorLecturaChat, getConversation);
router.post('/:username', limitadorMensajes, sendMessage);
router.post('/:username/read', markRead);
router.post('/:username/typing', limitadorLecturaChat, typing);
router.post('/:username/clear', clearConversation);
router.delete('/:username/messages/:id', deleteMessage);

module.exports = router;

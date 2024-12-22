const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getRecentChats,
  createGroup,
  getGroupMessages,
  sendMessage,
  sendDirectMessage,
  getDirectMessagesByUsername,
  deleteGroup,
  deleteDirectChat
} = require('../controllers/chatController');

router.get('/recent', authMiddleware, getRecentChats);

// group
router.post('/group', authMiddleware, createGroup);
router.get('/group/:groupId/messages', authMiddleware, getGroupMessages);
router.post('/message', authMiddleware, sendMessage);
router.delete('/group/:groupId', authMiddleware, deleteGroup);

// direct
router.post('/dm', authMiddleware, sendDirectMessage);
router.get('/dm/user/:username', authMiddleware, getDirectMessagesByUsername);
router.delete('/dm/user/:username', authMiddleware, deleteDirectChat);

module.exports = router;

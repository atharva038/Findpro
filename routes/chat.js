const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/chatMessage');
const { isLoggedIn } = require('../middleware');

// Get chat history
router.get('/chat-history', isLoggedIn, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.user._id })
            .sort({ timestamp: 1 })
            .limit(50);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// Save new message
router.post('/chat-message', isLoggedIn, async (req, res) => {
    try {
        const message = new ChatMessage({
            userId: req.user._id,
            text: req.body.text,
            sender: req.body.sender,
            timestamp: new Date()
        });
        await message.save();
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save message' });
    }
});

// Clear chat history
router.delete('/chat-history', isLoggedIn, async (req, res) => {
    try {
        await ChatMessage.deleteMany({ userId: req.user._id });
        res.json({ message: 'Chat history cleared' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

module.exports = router;
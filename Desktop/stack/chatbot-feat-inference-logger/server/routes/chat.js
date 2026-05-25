/**
 * Chat Routes
 * 
 * Handles multi-turn conversations with Gemini API,
 * using the InferenceLogger SDK to capture all metadata.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { InferenceLogger } = require('../sdk/inference-logger');
const { dbRun, dbGet, dbAll } = require('../database/init');

const router = express.Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the inference logger SDK
const logger = new InferenceLogger({
    ingestionUrl: `http://localhost:${process.env.PORT || 3001}/api/ingest`,
    provider: 'google',
    model: 'gemini-2.5-flash-lite'
});

/**
 * POST /api/chat/message
 * Send a message in a conversation
 */
router.post('/message', async (req, res) => {
    try {
        const { conversationId, message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let convId = conversationId;

        // Create new conversation if none exists
        if (!convId) {
            convId = uuidv4();
            dbRun(
                `INSERT INTO conversations (id, title, status) VALUES (?, ?, 'active')`,
                [convId, message.substring(0, 50)]
            );
        }

        // Check conversation status
        const conv = dbGet('SELECT * FROM conversations WHERE id = ?', [convId]);
        if (conv && conv.status === 'cancelled') {
            return res.status(400).json({ error: 'Conversation has been cancelled' });
        }

        // Store user message
        const userMsgId = uuidv4();
        dbRun(
            `INSERT INTO chat_messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`,
            [userMsgId, convId, message]
        );

        // Get conversation history for context
        const history = dbAll(
            `SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
            [convId]
        );

        // Build chat history for Gemini (exclude the current message, it goes as the new input)
        const chatHistory = history.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Call Gemini API with the inference logger SDK (using free-tier gemini-2.5-flash-lite)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        
        const { result, outputText } = await logger.wrap(
            async () => {
                const chat = model.startChat({ history: chatHistory });
                const response = await chat.sendMessage(message);
                return response;
            },
            {
                conversationId: convId,
                inputText: message,
                model: 'gemini-2.5-flash-lite',
                metadata: {
                    messageCount: history.length,
                    conversationId: convId
                }
            }
        );

        // Store assistant response
        const assistantMsgId = uuidv4();
        dbRun(
            `INSERT INTO chat_messages (id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)`,
            [assistantMsgId, convId, outputText]
        );

        // Update conversation timestamp
        dbRun(
            `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [convId]
        );

        res.json({
            conversationId: convId,
            message: {
                id: assistantMsgId,
                role: 'assistant',
                content: outputText
            }
        });

    } catch (error) {
        console.error('[Chat Error]', error);
        res.status(500).json({ 
            error: 'Failed to generate response', 
            message: error.message 
        });
    }
});

/**
 * GET /api/chat/conversations
 * List all conversations
 */
router.get('/conversations', (req, res) => {
    try {
        const conversations = dbAll(`
            SELECT c.*, 
                   COUNT(m.id) as message_count,
                   MAX(m.created_at) as last_message_at
            FROM conversations c
            LEFT JOIN chat_messages m ON c.id = m.conversation_id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        `);

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/chat/conversations/:id
 * Get a specific conversation with messages
 */
router.get('/conversations/:id', (req, res) => {
    try {
        const conversation = dbGet('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = dbAll(
            `SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
            [req.params.id]
        );

        res.json({ ...conversation, messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/chat/conversations/:id/cancel
 * Cancel a conversation
 */
router.patch('/conversations/:id/cancel', (req, res) => {
    try {
        const result = dbRun(
            `UPDATE conversations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json({ success: true, message: 'Conversation cancelled' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/chat/conversations/:id/resume
 * Resume a cancelled conversation
 */
router.patch('/conversations/:id/resume', (req, res) => {
    try {
        const result = dbRun(
            `UPDATE conversations SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json({ success: true, message: 'Conversation resumed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

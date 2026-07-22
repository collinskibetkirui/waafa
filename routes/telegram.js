const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');

/**
 * Test Telegram connection
 * GET /api/telegram/test
 */
router.get('/test', async (req, res) => {
    try {
        const result = await telegramService.testConnection();
        res.json({
            success: result.success,
            message: result.success ? '✅ Telegram connected!' : '❌ Connection failed',
            error: result.error || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Send custom message
 * POST /api/telegram/send
 * Body: { message }
 */
router.post('/send', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }
        
        const result = await telegramService.sendMessage(message);
        res.json({
            success: result.success,
            message: result.success ? '✅ Message sent' : '❌ Failed to send',
            error: result.error || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
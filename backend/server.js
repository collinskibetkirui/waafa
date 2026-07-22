const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const loanRoutes = require('./routes/loan');
const telegramRoutes = require('./routes/telegram');
const { promisePool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ============================================
// SERVE FRONTEND STATIC FILES
// ============================================
// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));

// ============================================
// API ROUTES (These come BEFORE the catch-all)
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/telegram', telegramRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: {
            connected: true,
            name: process.env.DB_NAME || 'waafi_loan_system'
        },
        telegram: {
            enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
        }
    });
});

// ============================================
// CATCH-ALL: Serve index.html for any non-API route
// ============================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'waafi_loan_system'}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('='.repeat(60));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await promisePool.end();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
    process.exit(0);
});

module.exports = app;
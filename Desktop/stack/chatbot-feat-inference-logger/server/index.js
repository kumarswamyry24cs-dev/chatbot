/**
 * Main Server Entry Point
 * 
 * Express server that hosts:
 * - Chat API (multi-turn conversations with Gemini)
 * - Ingestion Pipeline (receives and stores inference logs)
 * - Dashboard API (metrics and analytics)
 * - Static frontend serving (in production)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check (available before DB init)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Start server with async database initialization
async function startServer() {
    try {
        // Initialize database (async for sql.js)
        await initDatabase();
        console.log('[Server] Database initialized');

        // API Routes
        app.use('/api/chat', require('./routes/chat'));
        app.use('/api/ingest', require('./routes/ingest'));
        app.use('/api/dashboard', require('./routes/dashboard'));

        // Serve frontend in production
        if (process.env.NODE_ENV === 'production') {
            app.use(express.static(path.join(__dirname, '../frontend/dist')));
            app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
            });
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════╗
║   LLM Inference Logger - Server Running         ║
╠══════════════════════════════════════════════════╣
║   API:        http://localhost:${PORT}              ║
║   Chat:       http://localhost:${PORT}/api/chat     ║
║   Ingest:     http://localhost:${PORT}/api/ingest   ║
║   Dashboard:  http://localhost:${PORT}/api/dashboard║
╚══════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;

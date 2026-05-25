/**
 * Dashboard Routes
 * 
 * Provides metrics and analytics for inference logs:
 * - Latency stats
 * - Throughput (requests over time)
 * - Error rates
 * - Model usage breakdown
 */

const express = require('express');
const { dbGet, dbAll } = require('../database/init');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get overall statistics
 */
router.get('/stats', (req, res) => {
    try {
        const totalRequests = dbGet('SELECT COUNT(*) as count FROM inference_logs');
        const successCount = dbGet("SELECT COUNT(*) as count FROM inference_logs WHERE status = 'success'");
        const errorCount = dbGet("SELECT COUNT(*) as count FROM inference_logs WHERE status = 'error'");
        const timeoutCount = dbGet("SELECT COUNT(*) as count FROM inference_logs WHERE status = 'timeout'");

        const avgLatency = dbGet('SELECT AVG(latency_ms) as avg, MIN(latency_ms) as min, MAX(latency_ms) as max FROM inference_logs');
        const totalTokens = dbGet('SELECT SUM(total_tokens) as total, SUM(input_tokens) as input, SUM(output_tokens) as output FROM inference_logs');
        const totalConversations = dbGet('SELECT COUNT(*) as count FROM conversations');

        res.json({
            requests: {
                total: totalRequests.count,
                success: successCount.count,
                errors: errorCount.count,
                timeouts: timeoutCount.count,
                errorRate: totalRequests.count > 0 
                    ? ((errorCount.count + timeoutCount.count) / totalRequests.count * 100).toFixed(2) 
                    : 0
            },
            latency: {
                avg: Math.round(avgLatency.avg || 0),
                min: avgLatency.min || 0,
                max: avgLatency.max || 0
            },
            tokens: {
                total: totalTokens.total || 0,
                input: totalTokens.input || 0,
                output: totalTokens.output || 0
            },
            conversations: totalConversations.count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard/latency
 * Get latency data over time (last 24 hours, grouped by hour)
 */
router.get('/latency', (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;

        const data = dbAll(`
            SELECT 
                strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
                AVG(latency_ms) as avg_latency,
                MIN(latency_ms) as min_latency,
                MAX(latency_ms) as max_latency,
                COUNT(*) as request_count
            FROM inference_logs
            WHERE timestamp >= datetime('now', '-' || ? || ' hours')
            GROUP BY hour
            ORDER BY hour ASC
        `, [hours]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard/throughput
 * Get throughput data (requests per minute over last hour)
 */
router.get('/throughput', (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 60;

        const data = dbAll(`
            SELECT 
                strftime('%Y-%m-%d %H:%M:00', timestamp) as minute,
                COUNT(*) as requests,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM inference_logs
            WHERE timestamp >= datetime('now', '-' || ? || ' minutes')
            GROUP BY minute
            ORDER BY minute ASC
        `, [minutes]);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard/errors
 * Get recent errors
 */
router.get('/errors', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;

        const errors = dbAll(`
            SELECT id, request_id, model, provider, status, latency_ms, 
                   error_message, input_preview, timestamp
            FROM inference_logs
            WHERE status IN ('error', 'timeout')
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limit]);

        res.json(errors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard/logs
 * Get paginated inference logs
 */
router.get('/logs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status;

        let query = 'SELECT * FROM inference_logs';
        let countQuery = 'SELECT COUNT(*) as total FROM inference_logs';
        const params = [];
        const countParams = [];

        if (status && ['success', 'error', 'timeout'].includes(status)) {
            query += ' WHERE status = ?';
            countQuery += ' WHERE status = ?';
            params.push(status);
            countParams.push(status);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const total = dbGet(countQuery, countParams);
        const logs = dbAll(query, params);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total: total.total,
                totalPages: Math.ceil(total.total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard/models
 * Get model usage breakdown
 */
router.get('/models', (req, res) => {
    try {
        const data = dbAll(`
            SELECT 
                model,
                provider,
                COUNT(*) as total_requests,
                AVG(latency_ms) as avg_latency,
                SUM(total_tokens) as total_tokens,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
            FROM inference_logs
            GROUP BY model, provider
            ORDER BY total_requests DESC
        `);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

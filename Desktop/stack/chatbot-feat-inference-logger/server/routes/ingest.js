/**
 * Ingestion Pipeline API
 * 
 * Receives logs from the SDK, validates/parses payloads,
 * extracts useful metadata, and stores processed data in the database.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll } = require('../database/init');

const router = express.Router();

/**
 * POST /api/ingest
 * Receives inference log from SDK
 */
router.post('/', (req, res) => {
    try {
        const payload = req.body;

        // Validate required fields
        const validation = validatePayload(payload);
        if (!validation.valid) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validation.errors 
            });
        }

        // Extract and normalize metadata
        const normalizedLog = normalizePayload(payload);

        // Store in database
        const logId = uuidv4();
        dbRun(
            `INSERT INTO inference_logs (id, conversation_id, request_id, model, provider, status, latency_ms, input_tokens, output_tokens, total_tokens, input_preview, output_preview, error_message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                logId,
                normalizedLog.conversationId,
                normalizedLog.requestId,
                normalizedLog.model,
                normalizedLog.provider,
                normalizedLog.status,
                normalizedLog.latencyMs,
                normalizedLog.inputTokens,
                normalizedLog.outputTokens,
                normalizedLog.totalTokens,
                normalizedLog.inputPreview,
                normalizedLog.outputPreview,
                normalizedLog.errorMessage,
                normalizedLog.timestamp
            ]
        );

        // Store additional metadata if present
        if (normalizedLog.metadata && Object.keys(normalizedLog.metadata).length > 0) {
            for (const [key, value] of Object.entries(normalizedLog.metadata)) {
                dbRun(
                    `INSERT INTO inference_metadata (inference_log_id, key, value) VALUES (?, ?, ?)`,
                    [logId, key, String(value)]
                );
            }
        }

        res.status(201).json({ 
            success: true, 
            logId,
            message: 'Log ingested successfully' 
        });

    } catch (error) {
        console.error('[Ingestion Error]', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

/**
 * GET /api/ingest/health
 * Health check for ingestion service
 */
router.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'ingestion-pipeline' });
});

/**
 * Validate incoming payload
 */
function validatePayload(payload) {
    const errors = [];

    if (!payload.requestId) errors.push('requestId is required');
    if (!payload.model) errors.push('model is required');
    if (!payload.status || !['success', 'error', 'timeout'].includes(payload.status)) {
        errors.push('status must be one of: success, error, timeout');
    }
    if (payload.latencyMs === undefined || payload.latencyMs === null) {
        errors.push('latencyMs is required');
    }
    if (typeof payload.latencyMs !== 'number' || payload.latencyMs < 0) {
        errors.push('latencyMs must be a non-negative number');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Normalize and sanitize the payload
 */
function normalizePayload(payload) {
    return {
        requestId: payload.requestId,
        conversationId: payload.conversationId || null,
        model: payload.model.trim(),
        provider: (payload.provider || 'unknown').trim(),
        status: payload.status,
        latencyMs: Math.round(payload.latencyMs),
        inputTokens: parseInt(payload.inputTokens) || 0,
        outputTokens: parseInt(payload.outputTokens) || 0,
        totalTokens: parseInt(payload.totalTokens) || 0,
        inputPreview: (payload.inputPreview || '').substring(0, 500),
        outputPreview: (payload.outputPreview || '').substring(0, 500),
        errorMessage: payload.errorMessage || null,
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: payload.metadata || {}
    };
}

module.exports = router;

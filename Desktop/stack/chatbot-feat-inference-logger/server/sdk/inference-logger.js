/**
 * Lightweight Inference Logger SDK
 * 
 * Wraps LLM API calls and captures metadata including:
 * - model, provider, latency, token usage, timestamps
 * - request status/errors, conversation/session ID
 * - input/output previews
 * 
 * Sends logs to the ingestion endpoint in near real-time.
 */

const { v4: uuidv4 } = require('uuid');

class InferenceLogger {
    constructor(options = {}) {
        this.ingestionUrl = options.ingestionUrl || 'http://localhost:3001/api/ingest';
        this.provider = options.provider || 'google';
        this.model = options.model || 'gemini-2.5-flash-lite';
        this.maxPreviewLength = options.maxPreviewLength || 500;
        this.enabled = options.enabled !== false;
        this.onError = options.onError || ((err) => console.error('[InferenceLogger] Error:', err.message));
    }

    /**
     * Wraps an LLM API call and logs the inference metadata
     * @param {Function} apiCall - Async function that makes the actual LLM call
     * @param {Object} context - Additional context (conversationId, input text, etc.)
     * @returns {Object} - { result, log } where result is the API response
     */
    async wrap(apiCall, context = {}) {
        const requestId = uuidv4();
        const startTime = Date.now();
        let status = 'success';
        let errorMessage = null;
        let result = null;
        let outputText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let totalTokens = 0;

        try {
            result = await apiCall();

            // Extract token usage from Gemini response
            if (result && result.response && result.response.usageMetadata) {
                inputTokens = result.response.usageMetadata.promptTokenCount || 0;
                outputTokens = result.response.usageMetadata.candidatesTokenCount || 0;
                totalTokens = result.response.usageMetadata.totalTokenCount || 0;
            } else if (result && result.usageMetadata) {
                inputTokens = result.usageMetadata.promptTokenCount || 0;
                outputTokens = result.usageMetadata.candidatesTokenCount || 0;
                totalTokens = result.usageMetadata.totalTokenCount || 0;
            }

            // Extract output text
            if (result && result.response && typeof result.response.text === 'function') {
                outputText = result.response.text() || '';
            } else if (result && typeof result.text === 'function') {
                outputText = result.text() || '';
            } else if (typeof result === 'string') {
                outputText = result;
            }
        } catch (error) {
            status = error.message?.includes('timeout') ? 'timeout' : 'error';
            errorMessage = error.message || 'Unknown error';
            throw error;
        } finally {
            const latencyMs = Date.now() - startTime;

            const logEntry = {
                requestId,
                conversationId: context.conversationId || null,
                model: context.model || this.model,
                provider: this.provider,
                status,
                latencyMs,
                inputTokens,
                outputTokens,
                totalTokens,
                inputPreview: this._truncate(context.inputText || ''),
                outputPreview: this._truncate(outputText),
                errorMessage,
                timestamp: new Date().toISOString(),
                metadata: context.metadata || {}
            };

            // Fire and forget - don't block the response
            if (this.enabled) {
                this._sendLog(logEntry);
            }
        }

        return { result, outputText };
    }

    /**
     * Send log to ingestion endpoint (fire-and-forget)
     */
    async _sendLog(logEntry) {
        try {
            const response = await fetch(this.ingestionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry)
            });

            if (!response.ok) {
                this.onError(new Error(`Ingestion failed: ${response.status}`));
            }
        } catch (error) {
            this.onError(error);
        }
    }

    /**
     * Truncate text for preview storage
     */
    _truncate(text) {
        if (!text) return '';
        if (text.length <= this.maxPreviewLength) return text;
        return text.substring(0, this.maxPreviewLength) + '...';
    }
}

module.exports = { InferenceLogger };

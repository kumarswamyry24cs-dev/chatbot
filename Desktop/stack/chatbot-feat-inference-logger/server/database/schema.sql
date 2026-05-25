-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT 'New Conversation',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Inference logs table - captures all LLM call metadata
CREATE TABLE IF NOT EXISTS inference_logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    request_id TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google',
    status TEXT NOT NULL CHECK(status IN ('success', 'error', 'timeout')),
    latency_ms INTEGER NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    input_preview TEXT,
    output_preview TEXT,
    error_message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

-- Metadata table for additional key-value metadata per inference log
CREATE TABLE IF NOT EXISTS inference_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inference_log_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (inference_log_id) REFERENCES inference_logs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_logs_conversation ON inference_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON inference_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_status ON inference_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_model ON inference_logs(model);
CREATE INDEX IF NOT EXISTS idx_metadata_log ON inference_metadata(inference_log_id);

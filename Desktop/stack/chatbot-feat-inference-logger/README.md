# LLM Inference Logger

A lightweight inference logging and ingestion system for LLM applications. Features a multi-turn chatbot powered by Google Gemini, a custom SDK that transparently captures inference metadata, an ingestion pipeline, and a real-time monitoring dashboard.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Chat UI  │  │  Dashboard   │  │   Logs Viewer    │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
└───────┼────────────────┼───────────────────┼────────────┘
        │                │                   │
        ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                Express API Server (Node.js)               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Chat API │  │ Dashboard API│  │  Ingestion API   │  │
│  └────┬─────┘  └──────┬───────┘  └────────▲─────────┘  │
│       │                │                   │             │
│       ▼                │                   │             │
│  ┌─────────────┐      │                   │             │
│  │ Gemini API  │      │                   │             │
│  │  (via SDK)  │──────┼───────────────────┘             │
│  └─────────────┘      │                                 │
│       │                │                                 │
│       ▼                ▼                                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │           SQLite Database (WAL mode)             │    │
│  │  conversations │ chat_messages │ inference_logs  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Multi-turn Chatbot** - Gemini 2.0 Flash powered conversations with full context
- **Inference Logging SDK** - Transparent wrapper that captures all LLM call metadata
- **Ingestion Pipeline** - Validates, normalizes, and stores inference logs
- **Real-time Dashboard** - Latency, throughput, error rate monitoring
- **Conversation Management** - Create, list, cancel, and resume conversations
- **Docker Support** - One-command deployment with Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+ 
- A Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/kumarswamy603digital/chatbot.git
cd chatbot

# 2. Create environment file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Install dependencies
npm install
cd frontend && npm install && cd ..

# 4. Start the application
npm run dev
```

The backend runs on `http://localhost:3001` and the frontend on `http://localhost:5173`.

### Docker Deployment (One Command)

```bash
# Set your API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Start everything
docker-compose up --build
```

Access the application at `http://localhost:3001`.

## Project Structure

```
├── server/
│   ├── index.js                 # Express server entry point
│   ├── database/
│   │   ├── init.js              # Database initialization & connection
│   │   └── schema.sql           # SQLite schema definitions
│   ├── sdk/
│   │   └── inference-logger.js  # Lightweight inference logging SDK
│   └── routes/
│       ├── chat.js              # Chat API (conversations, messages)
│       ├── ingest.js            # Ingestion pipeline API
│       └── dashboard.js         # Metrics & analytics API
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root component with routing
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx     # Multi-turn chat interface
│   │   │   ├── DashboardPage.jsx # Metrics dashboard
│   │   │   └── LogsPage.jsx     # Inference logs viewer
│   │   └── styles.css           # Global styles
│   └── vite.config.js           # Vite configuration with API proxy
├── docker-compose.yml           # One-command deployment
├── Dockerfile                   # Multi-stage production build
└── .env.example                 # Environment variables template
```

## Schema Design

### conversations
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| title | TEXT | Auto-generated from first message |
| status | TEXT | active, cancelled, completed |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### chat_messages
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| conversation_id | TEXT | FK to conversations |
| role | TEXT | user, assistant, system |
| content | TEXT | Message content |
| created_at | DATETIME | Creation timestamp |

### inference_logs
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| conversation_id | TEXT | FK to conversations (nullable) |
| request_id | TEXT | Unique request identifier |
| model | TEXT | Model name (e.g., gemini-2.0-flash) |
| provider | TEXT | Provider (e.g., google) |
| status | TEXT | success, error, timeout |
| latency_ms | INTEGER | Request duration in milliseconds |
| input_tokens | INTEGER | Prompt token count |
| output_tokens | INTEGER | Response token count |
| total_tokens | INTEGER | Total tokens used |
| input_preview | TEXT | First 500 chars of input |
| output_preview | TEXT | First 500 chars of output |
| error_message | TEXT | Error details if failed |
| timestamp | DATETIME | When the inference occurred |

### inference_metadata
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| inference_log_id | TEXT | FK to inference_logs |
| key | TEXT | Metadata key |
| value | TEXT | Metadata value |

## Architecture Notes

### Ingestion Flow

1. **Chat request arrives** → Chat API handler processes the message
2. **SDK wraps the Gemini call** → Timer starts, request is made to Gemini API
3. **Response received** → SDK captures latency, token counts, status, previews
4. **Fire-and-forget logging** → SDK sends log to ingestion endpoint asynchronously (non-blocking)
5. **Ingestion validates** → Payload schema validation, field normalization
6. **Database storage** → Structured insert into `inference_logs` + `inference_metadata`

### Logging Strategy

- **Non-blocking**: The SDK uses fire-and-forget HTTP calls to the ingestion endpoint. The chat response is never delayed by logging.
- **Fail-safe**: If the ingestion endpoint is down, logs are silently dropped with an error callback. This prevents logging failures from cascading to users.
- **Structured**: All logs follow a consistent schema with required fields validated at ingestion time.
- **Preview-based**: Input/output are stored as truncated previews (500 chars) to balance observability with storage efficiency.

### Scaling Considerations

- **SQLite with WAL mode**: Supports concurrent reads with single-writer. Suitable for up to ~1000 writes/second on modern hardware. For higher throughput, migrate to PostgreSQL.
- **Async ingestion**: The fire-and-forget pattern means the SDK can buffer logs. Future improvement: add a local queue with batch writes.
- **Stateless API server**: The Express server is stateless (DB is the only state). Can be horizontally scaled behind a load balancer with a shared database.
- **Frontend CDN**: The React frontend builds to static files that can be served from a CDN.
- **Event-based potential**: The ingestion pipeline is designed to be easily converted to an event-driven architecture (e.g., Redis Streams or Kafka) for higher throughput scenarios.

### Failure Handling Assumptions

- **Gemini API failures**: Caught by the SDK, logged as `status: 'error'` with the error message. The chat endpoint returns a 500 to the frontend with a user-friendly message.
- **Database unavailable**: Server startup will fail (fail-fast). Runtime DB errors return 500 responses.
- **Ingestion failures**: Non-blocking. Failed log submissions are reported via the `onError` callback but don't affect user experience.
- **Network timeouts**: Classified as `status: 'timeout'` in logs. The Gemini SDK has default timeout handling.

## Design Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **SQLite** | Zero-config simplicity vs. limited concurrent writes. Perfect for prototyping/single-server, easy to migrate later. |
| **Monorepo** | Single deployment unit vs. independent scaling. Chosen for simplicity and development speed. |
| **Fire-and-forget logging** | Zero latency impact vs. potential log loss. Acceptable for monitoring (not billing). |
| **In-process ingestion** | Simpler architecture vs. less isolation. Could be extracted to a separate service. |
| **Token preview (500 chars)** | Storage efficiency vs. full audit capability. Full content available in chat_messages table. |
| **No external queue** | Fewer dependencies vs. less resilient to bursts. SQLite WAL handles moderate load well. |

## What I Would Improve With More Time

- **Message queue** (Redis/RabbitMQ) between SDK and ingestion for guaranteed delivery
- **PostgreSQL** migration for production-grade concurrent writes
- **Streaming responses** from Gemini with progressive token logging
- **PII redaction** layer in the ingestion pipeline (regex + NER-based)
- **Multi-provider support** (OpenAI, Anthropic, Cohere) in the SDK
- **WebSocket** for real-time dashboard updates instead of polling
- **Rate limiting** and authentication on API endpoints
- **Prometheus metrics** export for production monitoring
- **Kubernetes manifests** for production deployment
- **End-to-end tests** with Playwright for the frontend

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/message` | Send a message (creates conversation if needed) |
| GET | `/api/chat/conversations` | List all conversations |
| GET | `/api/chat/conversations/:id` | Get conversation with messages |
| PATCH | `/api/chat/conversations/:id/cancel` | Cancel a conversation |
| PATCH | `/api/chat/conversations/:id/resume` | Resume a cancelled conversation |
| POST | `/api/ingest` | Ingest an inference log |
| GET | `/api/ingest/health` | Ingestion service health check |
| GET | `/api/dashboard/stats` | Overall statistics |
| GET | `/api/dashboard/latency` | Latency over time |
| GET | `/api/dashboard/throughput` | Throughput per minute |
| GET | `/api/dashboard/errors` | Recent errors |
| GET | `/api/dashboard/logs` | Paginated inference logs |
| GET | `/api/dashboard/models` | Model usage breakdown |
| GET | `/api/health` | Server health check |

## License

MIT

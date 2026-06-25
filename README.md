# OnCall AI Agent Control Plane API

A comprehensive REST API for managing an AI-powered on-call agent that handles incident response, runbook execution, escalation policies, knowledge base management, and observability.

## Setup

### Prerequisites

- Node.js 18+ (recommended: Node.js 22)
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the server
npm start
```

### Development

```bash
# Start with auto-reload
npm run dev

# Run tests
npm test
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `API_KEY` | `oncall-agent-secret-key-2024` | Bearer token for authentication |
| `NODE_ENV` | `development` | Environment (development, production, test) |

## Authentication

All endpoints (except `GET /api/v1/agent/health`) require Bearer token authentication:

```bash
curl -H "Authorization: Bearer oncall-agent-secret-key-2024" http://localhost:3000/api/v1/agent/status
```

## API Endpoints

### 1. Agent Lifecycle (`/api/v1/agent/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get agent status (uptime, active incidents, health) |
| POST | `/start` | Start agent with config profile |
| POST | `/stop` | Gracefully stop agent |
| PATCH | `/config` | Update runtime configuration |
| GET | `/health` | Deep health check for all integrations |

### 2. Incident Management (`/api/v1/incidents/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List incidents (query: status, sort, limit) |
| GET | `/:incident_id` | Get incident details with AI diagnosis |
| POST | `/triage` | Trigger AI triage for an incoming alert |
| POST | `/:incident_id/acknowledge` | Acknowledge incident |
| GET | `/:incident_id/diagnosis` | Get AI diagnosis with confidence score |
| POST | `/:incident_id/resolve` | Resolve incident |

### 3. Runbook Execution (`/api/v1/runbooks/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List available runbooks (query: service, status) |
| GET | `/:runbook_id` | Get runbook details |
| POST | `/execute` | Execute a runbook |
| GET | `/executions/:execution_id` | Get execution status |
| POST | `/executions/:execution_id/approve` | Approve pending execution |

### 4. Escalation Policies (`/api/v1/escalation-policies/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List escalation policies |
| POST | `/` | Create escalation policy |
| POST | `/escalate` | Trigger manual escalation |

### 5. Knowledge Base (`/api/v1/knowledge-base/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/search` | Semantic search across knowledge base |
| POST | `/documents` | Ingest a document |
| GET | `/services/:service_name/dependencies` | Get service dependency map |

### 6. Communications & Notifications (`/api/v1/notifications/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send` | Send incident update notification |
| GET | `/incidents/:incident_id/communications` | Get communication log |
| POST | `/agent/chat` | Ask AI agent a question |

### 7. Metrics & Observability (`/api/v1/observability/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/metrics` | Query service metrics |
| GET | `/deployments` | Get recent deployments (query: service, limit, since) |
| POST | `/logs` | Fetch correlated logs |

## Example Requests

### Get Agent Status

```bash
curl -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  http://localhost:3000/api/v1/agent/status
```

### Triage an Alert

```bash
curl -X POST -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"service": "payment-service", "metric": "latency_p99", "value": "5000", "threshold": "1000", "description": "High latency detected"}' \
  http://localhost:3000/api/v1/incidents/triage
```

### Execute a Runbook

```bash
curl -X POST -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"runbook_id": "rb-001", "target_service": "payment-service"}' \
  http://localhost:3000/api/v1/runbooks/execute
```

### Search Knowledge Base

```bash
curl -X POST -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"query": "payment service architecture"}' \
  http://localhost:3000/api/v1/knowledge-base/search
```

### Ask the AI Agent

```bash
curl -X POST -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"question": "What incidents are currently active?"}' \
  http://localhost:3000/api/v1/notifications/agent/chat
```

### Query Metrics

```bash
curl -X POST -H "Authorization: Bearer oncall-agent-secret-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"service": "payment-service", "metric": "latency_p99", "timeRange": "1h"}' \
  http://localhost:3000/api/v1/observability/metrics
```

## Architecture

- **Express.js** REST API with modular route handlers
- **Bearer Token** authentication middleware
- **In-memory** data stores with realistic mock data (no external database required)
- **Centralized** error handling middleware
- **Helmet** for security headers
- **CORS** enabled for cross-origin requests
- **Morgan** for HTTP request logging

## Project Structure

```
.
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── index.js              # Express app entry point
│   ├── middleware/
│   │   ├── auth.js           # Bearer token authentication
│   │   └── errorHandler.js   # Centralized error handling
│   ├── data/
│   │   └── store.js          # In-memory state and mock data
│   └── routes/
│       ├── agent.js           # Agent lifecycle endpoints
│       ├── incidents.js       # Incident management endpoints
│       ├── runbooks.js        # Runbook execution endpoints
│       ├── escalationPolicies.js  # Escalation policy endpoints
│       ├── knowledgeBase.js   # Knowledge base endpoints
│       ├── notifications.js   # Notifications & chat endpoints
│       └── observability.js   # Metrics & observability endpoints
└── tests/
    └── api.test.js           # Comprehensive API tests
```

## License

MIT

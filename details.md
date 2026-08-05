# Repository Details

## Overview

**OnCall AI Agent Control Plane API** is a Node.js/Express REST API that serves as the management layer for an AI-powered on-call agent. The system handles incident response workflows, runbook execution, escalation policies, knowledge base management, and observability -- all through a unified API surface.

## Purpose

This project provides a control plane for automating and orchestrating on-call operations. It enables:

- Automated incident triage with AI-driven diagnosis
- Runbook execution with approval workflows
- Escalation policy management with configurable tiers
- Knowledge base search for rapid resolution context
- Centralized communication and notification dispatch
- Metrics querying and deployment tracking for observability

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 4.21 |
| Security | Helmet | 7.1 |
| Logging | Morgan | 1.10 |
| Testing | Jest + Supertest | 29.7 / 7.0 |
| Auth | Bearer Token | Custom middleware |
| Data | In-memory stores | No external DB |

## API Surface

The API exposes 28 endpoints across 7 route modules:

1. **Agent Lifecycle** (`/api/v1/agent/`) - Start, stop, configure, and health-check the AI agent
2. **Incident Management** (`/api/v1/incidents/`) - Triage, acknowledge, diagnose, and resolve incidents
3. **Runbook Execution** (`/api/v1/runbooks/`) - List, execute, and approve runbook operations
4. **Escalation Policies** (`/api/v1/escalation-policies/`) - Define and trigger escalation chains
5. **Knowledge Base** (`/api/v1/knowledge-base/`) - Semantic search and document ingestion
6. **Communications** (`/api/v1/notifications/`) - Notifications, communication logs, and AI chat
7. **Observability** (`/api/v1/observability/`) - Metrics queries, deployment history, and log correlation

## Architecture Highlights

- **Stateless design** - All state is held in-memory via `src/data/store.js`, making the service easy to spin up without external dependencies
- **Modular routing** - Each domain has its own route file under `src/routes/`, promoting separation of concerns
- **Middleware pipeline** - Authentication and error handling are centralized in `src/middleware/`
- **Security-first** - Helmet for HTTP headers, Bearer token auth on all mutation endpoints
- **Test coverage** - Comprehensive API-level tests via Jest and Supertest in `tests/api.test.js`

## Project Structure

```
testing-prod/
├── package.json              # Dependencies and scripts
├── package-lock.json         # Locked dependency tree
├── README.md                 # Full usage and API documentation
├── details.md                # This file
├── src/
│   ├── index.js              # Express app setup and server bootstrap
│   ├── middleware/
│   │   ├── auth.js           # Bearer token authentication guard
│   │   └── errorHandler.js   # Centralized error response handler
│   ├── data/
│   │   └── store.js          # In-memory data stores with seed data
│   └── routes/
│       ├── agent.js              # Agent lifecycle endpoints
│       ├── incidents.js          # Incident management endpoints
│       ├── runbooks.js           # Runbook execution endpoints
│       ├── escalationPolicies.js # Escalation policy endpoints
│       ├── knowledgeBase.js      # Knowledge base endpoints
│       ├── notifications.js      # Notification and chat endpoints
│       └── observability.js      # Metrics and observability endpoints
└── tests/
    └── api.test.js           # API integration tests
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the server (default port 3000)
npm start

# Start with hot-reload for development
npm run dev

# Run the test suite
npm test
```

## Authentication

All endpoints except the health check (`GET /api/v1/agent/health`) require a Bearer token in the `Authorization` header. The default token for development is configured via the `API_KEY` environment variable.

## Key Design Decisions

- **No external database** - In-memory stores keep the service self-contained and easy to test. This is intentional for a control plane that prioritizes speed and simplicity over long-term persistence.
- **Realistic mock data** - The store ships with pre-seeded incidents, runbooks, and service maps so the API is immediately usable without setup.
- **Single test file** - All API tests live in one file for straightforward test execution and CI integration.
- **Versioned API** - All routes are prefixed with `/api/v1/` to support future versioning.

## License

This project is licensed under the MIT License.

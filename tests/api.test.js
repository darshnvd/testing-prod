const request = require('supertest');

const API_KEY = 'oncall-agent-secret-key-2024';
const AUTH_HEADER = `Bearer ${API_KEY}`;

// Set API_KEY env var for test environment before loading app
process.env.API_KEY = API_KEY;

const app = require('../src/index');
const store = require('../src/data/store');

// Capture the initial state for reset
function getInitialState() {
  return {
    agentState: {
      status: 'running',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      config: {
        profile: 'production',
        autoTriageEnabled: true,
        autoEscalateAfterMinutes: 15,
        maxConcurrentIncidents: 10,
        notificationChannels: ['slack', 'pagerduty', 'email']
      },
      integrations: {
        pagerduty: { status: 'connected', lastSync: new Date(Date.now() - 60000).toISOString() },
        slack: { status: 'connected', lastSync: new Date(Date.now() - 30000).toISOString() },
        datadog: { status: 'connected', lastSync: new Date(Date.now() - 45000).toISOString() },
        jira: { status: 'connected', lastSync: new Date(Date.now() - 120000).toISOString() }
      }
    }
  };
}

describe('OnCall AI Agent API', () => {
  beforeEach(() => {
    // Reset agent state before each test to avoid ordering dependencies
    const initial = getInitialState();
    Object.assign(store.agentState, initial.agentState);
    store.agentState.config = { ...initial.agentState.config };
    store.agentState.integrations = JSON.parse(JSON.stringify(initial.agentState.integrations));

    // Clear any dynamically added escalations
    store.escalations.length = 0;
  });
  // === Authentication Middleware ===
  describe('Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app).get('/api/v1/agent/status');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Missing Authorization header');
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject requests with non-Bearer format', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', 'Basic sometoken');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid Authorization header format');
    });

    it('should accept requests with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
    });

    it('should allow unauthenticated access to /api/v1/agent/health', async () => {
      const res = await request(app).get('/api/v1/agent/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
    });

    it('should allow unauthenticated access to /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('should allow unauthenticated access to /api/v1/health/ready', async () => {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });

    it('should allow unauthenticated access to /api/v1/health/live', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });
  });

  // === Agent Lifecycle ===
  describe('Agent Lifecycle', () => {
    it('GET /api/v1/agent/status should return agent status', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.status).toBeDefined();
      expect(res.body.uptime).toBeDefined();
      expect(res.body.activeIncidents).toBeGreaterThanOrEqual(0);
      expect(res.body.health).toBeDefined();
      expect(res.body.config).toBeDefined();
    });

    it('POST /api/v1/agent/stop should stop the agent', async () => {
      const res = await request(app)
        .post('/api/v1/agent/stop')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('stopped');
    });

    it('POST /api/v1/agent/stop should clear startedAt', async () => {
      await request(app)
        .post('/api/v1/agent/stop')
        .set('Authorization', AUTH_HEADER);
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.uptime.ms).toBe(0);
    });

    it('POST /api/v1/agent/start should start the agent', async () => {
      // First stop the agent so we can start it
      store.agentState.status = 'stopped';
      store.agentState.startedAt = null;

      const res = await request(app)
        .post('/api/v1/agent/start')
        .set('Authorization', AUTH_HEADER)
        .send({ profile: 'production' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('started');
      expect(res.body.config).toBeDefined();
    });

    it('POST /api/v1/agent/start should return 409 if already running', async () => {
      const res = await request(app)
        .post('/api/v1/agent/start')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(409);
    });

    it('PATCH /api/v1/agent/config should update configuration', async () => {
      const res = await request(app)
        .patch('/api/v1/agent/config')
        .set('Authorization', AUTH_HEADER)
        .send({ autoTriageEnabled: false, maxConcurrentIncidents: 5 });
      expect(res.status).toBe(200);
      expect(res.body.config.autoTriageEnabled).toBe(false);
      expect(res.body.config.maxConcurrentIncidents).toBe(5);
    });

    it('PATCH /api/v1/agent/config should reject empty body', async () => {
      const res = await request(app)
        .patch('/api/v1/agent/config')
        .set('Authorization', AUTH_HEADER)
        .send({});
      expect(res.status).toBe(400);
    });

    it('PATCH /api/v1/agent/config should reject invalid keys', async () => {
      const res = await request(app)
        .patch('/api/v1/agent/config')
        .set('Authorization', AUTH_HEADER)
        .send({ injectedKey: true, unknownField: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid configuration keys');
    });

    it('GET /api/v1/agent/health should return deep health check', async () => {
      const res = await request(app)
        .get('/api/v1/agent/health')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.integrations).toBeDefined();
      expect(Array.isArray(res.body.integrations)).toBe(true);
      expect(res.body.system).toBeDefined();
    });
  });

  // === Incident Management ===
  describe('Incident Management', () => {
    it('GET /api/v1/incidents should return list of incidents', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.incidents)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/incidents should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?status=active')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      res.body.incidents.forEach(incident => {
        expect(incident.status).toBe('active');
      });
    });

    it('GET /api/v1/incidents should sort by severity', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?sort=severity')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < res.body.incidents.length; i++) {
        expect(severityOrder[res.body.incidents[i].severity])
          .toBeGreaterThanOrEqual(severityOrder[res.body.incidents[i - 1].severity]);
      }
    });

    it('GET /api/v1/incidents should limit results', async () => {
      const res = await request(app)
        .get('/api/v1/incidents?limit=2')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.incidents.length).toBeLessThanOrEqual(2);
    });

    it('GET /api/v1/incidents/:id should return incident details', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-001')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('inc-001');
      expect(res.body.title).toBeDefined();
      expect(res.body.diagnosis).toBeDefined();
    });

    it('GET /api/v1/incidents/:id should return 404 for unknown incident', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-999')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('POST /api/v1/incidents/triage should create incident from alert', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/triage')
        .set('Authorization', AUTH_HEADER)
        .send({
          alert_source: 'datadog',
          service: 'inventory-service',
          metric: 'error_rate',
          value: '15',
          threshold: '5',
          description: 'High error rate on inventory-service'
        });
      expect(res.status).toBe(201);
      expect(res.body.incident).toBeDefined();
      expect(res.body.incident.diagnosis).toBeDefined();
      expect(res.body.incident.diagnosis.confidence).toBeGreaterThan(0);
    });

    it('POST /api/v1/incidents/triage should require service and description', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/triage')
        .set('Authorization', AUTH_HEADER)
        .send({ alert_source: 'datadog' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/incidents/:id/acknowledge should acknowledge incident', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/acknowledge')
        .set('Authorization', AUTH_HEADER)
        .send({ acknowledged_by: 'test-user@company.com' });
      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('acknowledged');
    });

    it('GET /api/v1/incidents/:id/diagnosis should return AI diagnosis', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-001/diagnosis')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.diagnosis).toBeDefined();
      expect(res.body.diagnosis.confidence).toBeGreaterThan(0);
      expect(res.body.diagnosis.suggestedActions).toBeDefined();
    });

    it('POST /api/v1/incidents/:id/resolve should resolve incident', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-003/resolve')
        .set('Authorization', AUTH_HEADER)
        .send({ resolution_notes: 'Scaled up replicas to handle traffic' });
      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('resolved');
      expect(res.body.incident.resolvedAt).toBeDefined();
    });
  });

  // === Runbook Execution ===
  describe('Runbook Execution', () => {
    it('GET /api/v1/runbooks should return list of runbooks', async () => {
      const res = await request(app)
        .get('/api/v1/runbooks')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.runbooks)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/runbooks should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/runbooks?status=active')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      res.body.runbooks.forEach(rb => {
        expect(rb.status).toBe('active');
      });
    });

    it('GET /api/v1/runbooks/:id should return runbook details', async () => {
      const res = await request(app)
        .get('/api/v1/runbooks/rb-001')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('rb-001');
      expect(res.body.steps).toBeDefined();
    });

    it('GET /api/v1/runbooks/:id should return 404 for unknown runbook', async () => {
      const res = await request(app)
        .get('/api/v1/runbooks/rb-999')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(404);
    });

    it('POST /api/v1/runbooks/execute should execute a runbook', async () => {
      const res = await request(app)
        .post('/api/v1/runbooks/execute')
        .set('Authorization', AUTH_HEADER)
        .send({
          runbook_id: 'rb-001',
          target_service: 'payment-service',
          parameters: { replicas: 3 }
        });
      expect(res.status).toBe(201);
      expect(res.body.execution).toBeDefined();
      expect(res.body.execution.runbookId).toBe('rb-001');
      expect(res.body.execution.status).toBeDefined();
    });

    it('POST /api/v1/runbooks/execute should require runbook_id', async () => {
      const res = await request(app)
        .post('/api/v1/runbooks/execute')
        .set('Authorization', AUTH_HEADER)
        .send({ target_service: 'payment-service' });
      expect(res.status).toBe(400);
    });

    let executionId;
    it('POST /api/v1/runbooks/execute should create execution with pending_approval', async () => {
      const res = await request(app)
        .post('/api/v1/runbooks/execute')
        .set('Authorization', AUTH_HEADER)
        .send({ runbook_id: 'rb-001', target_service: 'user-service' });
      expect(res.status).toBe(201);
      expect(res.body.execution.status).toBe('pending_approval');
      executionId = res.body.execution.id;
    });

    it('GET /api/v1/runbooks/executions/:id should return execution status', async () => {
      const res = await request(app)
        .get(`/api/v1/runbooks/executions/${executionId}`)
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(executionId);
    });

    it('POST /api/v1/runbooks/executions/:id/approve should approve execution', async () => {
      const res = await request(app)
        .post(`/api/v1/runbooks/executions/${executionId}/approve`)
        .set('Authorization', AUTH_HEADER)
        .send({ approved_by: 'senior-engineer@company.com' });
      expect(res.status).toBe(200);
      expect(res.body.execution.status).toBe('running');
      expect(res.body.execution.approvedBy).toBe('senior-engineer@company.com');
    });
  });

  // === Escalation Policies ===
  describe('Escalation Policies', () => {
    it('GET /api/v1/escalation-policies should return list of policies', async () => {
      const res = await request(app)
        .get('/api/v1/escalation-policies')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.policies)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('POST /api/v1/escalation-policies should create a policy', async () => {
      const res = await request(app)
        .post('/api/v1/escalation-policies')
        .set('Authorization', AUTH_HEADER)
        .send({
          name: 'Test Policy',
          description: 'A test escalation policy',
          levels: [
            { level: 1, targets: ['test@company.com'], timeoutMinutes: 10 }
          ],
          services: ['test-service']
        });
      expect(res.status).toBe(201);
      expect(res.body.policy.name).toBe('Test Policy');
      expect(res.body.policy.id).toBeDefined();
    });

    it('POST /api/v1/escalation-policies should require name and levels', async () => {
      const res = await request(app)
        .post('/api/v1/escalation-policies')
        .set('Authorization', AUTH_HEADER)
        .send({ description: 'Missing name and levels' });
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/escalation-policies/escalate should trigger escalation', async () => {
      const res = await request(app)
        .post('/api/v1/escalation-policies/escalate')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-001',
          reason: 'No response from on-call after 15 minutes'
        });
      expect(res.status).toBe(200);
      expect(res.body.escalation).toBeDefined();
      expect(res.body.escalation.incidentId).toBe('inc-001');
    });

    it('POST /api/v1/escalation-policies/escalate should require incident_id', async () => {
      const res = await request(app)
        .post('/api/v1/escalation-policies/escalate')
        .set('Authorization', AUTH_HEADER)
        .send({ reason: 'test' });
      expect(res.status).toBe(400);
    });
  });

  // === Knowledge Base ===
  describe('Knowledge Base', () => {
    it('POST /api/v1/knowledge-base/search should search documents', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base/search')
        .set('Authorization', AUTH_HEADER)
        .send({ query: 'payment' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].relevanceScore).toBeDefined();
    });

    it('POST /api/v1/knowledge-base/search should require query', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base/search')
        .set('Authorization', AUTH_HEADER)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/v1/knowledge-base/documents should ingest a document', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base/documents')
        .set('Authorization', AUTH_HEADER)
        .send({
          title: 'Test Document',
          service: 'test-service',
          content: 'This is a test document for the knowledge base',
          tags: ['test', 'documentation']
        });
      expect(res.status).toBe(201);
      expect(res.body.document.id).toBeDefined();
      expect(res.body.document.title).toBe('Test Document');
    });

    it('POST /api/v1/knowledge-base/documents should require title and content', async () => {
      const res = await request(app)
        .post('/api/v1/knowledge-base/documents')
        .set('Authorization', AUTH_HEADER)
        .send({ service: 'test' });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/knowledge-base/services/:name/dependencies should return dependency map', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base/services/payment-service/dependencies')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('payment-service');
      expect(Array.isArray(res.body.dependencies)).toBe(true);
      expect(res.body.dependents).toBeDefined();
    });

    it('GET /api/v1/knowledge-base/services/:name/dependencies should 404 for unknown service', async () => {
      const res = await request(app)
        .get('/api/v1/knowledge-base/services/unknown-service/dependencies')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(404);
    });
  });

  // === Notifications & Communications ===
  describe('Notifications & Communications', () => {
    it('POST /api/v1/notifications/send should send notification', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/send')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-001',
          channel: '#incidents-critical',
          message: 'Update: Investigation in progress',
          type: 'slack'
        });
      expect(res.status).toBe(201);
      expect(res.body.notification).toBeDefined();
      expect(res.body.notification.incidentId).toBe('inc-001');
    });

    it('POST /api/v1/notifications/send should require incident_id and message', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/send')
        .set('Authorization', AUTH_HEADER)
        .send({ channel: '#test' });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/notifications/incidents/:id/communications should return comm log', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/incidents/inc-001/communications')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.incidentId).toBe('inc-001');
      expect(Array.isArray(res.body.communications)).toBe(true);
    });

    it('POST /api/v1/notifications/agent/chat should respond to questions', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/agent/chat')
        .set('Authorization', AUTH_HEADER)
        .send({ question: 'What incidents are currently active?' });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
      expect(res.body.confidence).toBeGreaterThan(0);
      expect(res.body.sources).toBeDefined();
    });

    it('POST /api/v1/notifications/agent/chat should require question', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/agent/chat')
        .set('Authorization', AUTH_HEADER)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // === Observability ===
  describe('Metrics & Observability', () => {
    it('POST /api/v1/observability/metrics should return service metrics', async () => {
      const res = await request(app)
        .post('/api/v1/observability/metrics')
        .set('Authorization', AUTH_HEADER)
        .send({
          service: 'payment-service',
          metric: 'latency_p99',
          timeRange: '1h',
          aggregation: 'avg'
        });
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('payment-service');
      expect(res.body.metric).toBe('latency_p99');
      expect(Array.isArray(res.body.datapoints)).toBe(true);
      expect(res.body.summary).toBeDefined();
    });

    it('POST /api/v1/observability/metrics should require service and metric', async () => {
      const res = await request(app)
        .post('/api/v1/observability/metrics')
        .set('Authorization', AUTH_HEADER)
        .send({ timeRange: '1h' });
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/observability/deployments should return deployments', async () => {
      const res = await request(app)
        .get('/api/v1/observability/deployments')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.deployments)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/observability/deployments should filter by service', async () => {
      const res = await request(app)
        .get('/api/v1/observability/deployments?service=payment-service')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      res.body.deployments.forEach(d => {
        expect(d.service).toBe('payment-service');
      });
    });

    it('GET /api/v1/observability/deployments should limit results', async () => {
      const res = await request(app)
        .get('/api/v1/observability/deployments?limit=2')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
      expect(res.body.deployments.length).toBeLessThanOrEqual(2);
    });

    it('POST /api/v1/observability/logs should return correlated logs', async () => {
      const res = await request(app)
        .post('/api/v1/observability/logs')
        .set('Authorization', AUTH_HEADER)
        .send({
          service: 'payment-service',
          level: 'error',
          timeRange: '15m'
        });
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('payment-service');
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('POST /api/v1/observability/logs should require service', async () => {
      const res = await request(app)
        .post('/api/v1/observability/logs')
        .set('Authorization', AUTH_HEADER)
        .send({ level: 'error' });
      expect(res.status).toBe(400);
    });
  });

  // === 404 handling ===
  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/v1/unknown-route')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});

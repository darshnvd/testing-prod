const request = require('supertest');

const API_KEY = 'oncall-agent-secret-key-2024';
const AUTH_HEADER = `Bearer ${API_KEY}`;

process.env.API_KEY = API_KEY;

const app = require('../src/index');
const store = require('../src/data/store');

describe('Incident Timeline API', () => {
  // Reset incident state before each test to avoid ordering dependencies
  let originalIncidents;

  beforeAll(() => {
    originalIncidents = JSON.parse(JSON.stringify(store.incidents));
  });

  beforeEach(() => {
    // Deep reset incidents to original state
    store.incidents.length = 0;
    const fresh = JSON.parse(JSON.stringify(originalIncidents));
    fresh.forEach(inc => store.incidents.push(inc));
  });

  describe('GET /api/v1/incidents/:id/timeline', () => {
    it('should return timeline events for an incident sorted newest-first', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-001/timeline')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.incidentId).toBe('inc-001');
      expect(Array.isArray(res.body.timeline)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);

      // Verify sorted newest-first
      for (let i = 1; i < res.body.timeline.length; i++) {
        const prev = new Date(res.body.timeline[i - 1].timestamp).getTime();
        const curr = new Date(res.body.timeline[i].timestamp).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('should filter timeline events by type', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-002/timeline?type=status_change')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.timeline.length).toBeGreaterThan(0);
      res.body.timeline.forEach(event => {
        expect(event.type).toBe('status_change');
      });
    });

    it('should return empty array when filtering by non-existent type', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-001/timeline?type=nonexistent')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.timeline).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return 404 for unknown incident', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-999/timeline')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('should return timeline with correct event structure', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/inc-001/timeline')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      const event = res.body.timeline[0];
      expect(event.id).toBeDefined();
      expect(event.type).toBeDefined();
      expect(event.message).toBeDefined();
      expect(event.author).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/incidents/:id/timeline/events', () => {
    it('should add a custom timeline event', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          type: 'note',
          message: 'Investigating database connection pool settings',
          author: 'engineer@company.com'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Timeline event added');
      expect(res.body.event.type).toBe('note');
      expect(res.body.event.message).toBe('Investigating database connection pool settings');
      expect(res.body.event.author).toBe('engineer@company.com');
      expect(res.body.event.id).toBeDefined();
      expect(res.body.event.timestamp).toBeDefined();
    });

    it('should persist the custom event in the timeline', async () => {
      await request(app)
        .post('/api/v1/incidents/inc-001/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          type: 'escalation',
          message: 'Escalated to senior engineer',
          author: 'oncall-agent'
        });

      const res = await request(app)
        .get('/api/v1/incidents/inc-001/timeline')
        .set('Authorization', AUTH_HEADER);

      const addedEvent = res.body.timeline.find(e => e.type === 'escalation');
      expect(addedEvent).toBeDefined();
      expect(addedEvent.message).toBe('Escalated to senior engineer');
    });

    it('should return 400 when type is missing', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          message: 'Some message',
          author: 'engineer@company.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('should return 400 when message is missing', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          type: 'note',
          author: 'engineer@company.com'
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when author is missing', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          type: 'note',
          message: 'Some message'
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown incident', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-999/timeline/events')
        .set('Authorization', AUTH_HEADER)
        .send({
          type: 'note',
          message: 'Test',
          author: 'test@company.com'
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('Auto-generated timeline events on status changes', () => {
    it('should add timeline event when incident is acknowledged', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-001/acknowledge')
        .set('Authorization', AUTH_HEADER)
        .send({ acknowledged_by: 'responder@company.com' });

      expect(res.status).toBe(200);

      const timelineRes = await request(app)
        .get('/api/v1/incidents/inc-001/timeline')
        .set('Authorization', AUTH_HEADER);

      const ackEvent = timelineRes.body.timeline.find(
        e => e.type === 'status_change' && e.message.includes('acknowledged')
      );
      expect(ackEvent).toBeDefined();
      expect(ackEvent.author).toBe('responder@company.com');
      expect(ackEvent.message).toContain('responder@company.com');
    });

    it('should add timeline event when incident is resolved', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/inc-003/resolve')
        .set('Authorization', AUTH_HEADER)
        .send({ resolution_notes: 'Scaled up replicas' });

      expect(res.status).toBe(200);

      const timelineRes = await request(app)
        .get('/api/v1/incidents/inc-003/timeline')
        .set('Authorization', AUTH_HEADER);

      const resolveEvent = timelineRes.body.timeline.find(
        e => e.type === 'status_change' && e.message.includes('resolved')
      );
      expect(resolveEvent).toBeDefined();
      expect(resolveEvent.message).toContain('Scaled up replicas');
    });
  });
});

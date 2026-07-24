const request = require('supertest');

const API_KEY = 'oncall-agent-secret-key-2024';
const AUTH_HEADER = `Bearer ${API_KEY}`;

process.env.API_KEY = API_KEY;

const app = require('../src/index');
const store = require('../src/data/store');

describe('Postmortems API', () => {
  beforeEach(() => {
    // Reset postmortems to seed data before each test
    store.postmortems.length = 0;
    store.postmortems.push(
      {
        id: 'pm-001',
        incident_id: 'inc-004',
        title: 'SSL Certificate Expiry on Checkout Service',
        status: 'published',
        summary: 'SSL certificate auto-renewal failed due to missing IAM permissions.',
        root_cause: 'Certificate manager IAM role was missing the acm:RequestCertificate permission.',
        impact: 'No customer-facing impact as the certificate was renewed manually before expiry.',
        lessons_learned: [
          'IAM policy changes should trigger automated validation',
          'Certificate expiry monitoring threshold should be extended'
        ],
        action_items: [
          { description: 'Add acm:RequestCertificate to cert-manager IAM role', owner: 'infra-team@company.com', due_date: '2024-02-01', status: 'completed' }
        ],
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-16T10:00:00.000Z',
        author: 'ops-team@company.com'
      },
      {
        id: 'pm-002',
        incident_id: 'inc-004',
        title: 'SSL Cert Renewal Process Improvement Plan',
        status: 'draft',
        summary: 'Follow-up postmortem focusing on systemic improvements.',
        root_cause: 'Lack of centralized certificate lifecycle management.',
        impact: 'Potential for similar incidents across 12 other services.',
        lessons_learned: [
          'Centralized certificate management would reduce operational risk'
        ],
        action_items: [
          { description: 'Evaluate centralized cert management solutions', owner: 'infra-team@company.com', due_date: '2024-03-01', status: 'pending' }
        ],
        created_at: '2024-01-17T10:00:00.000Z',
        updated_at: '2024-01-18T10:00:00.000Z',
        author: 'sre-team@company.com'
      }
    );
  });

  describe('GET /api/v1/postmortems', () => {
    it('should list all postmortems', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.postmortems).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should filter postmortems by incident_id', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems?incident_id=inc-004')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.postmortems).toHaveLength(2);
      expect(res.body.postmortems.every(pm => pm.incident_id === 'inc-004')).toBe(true);
    });

    it('should filter postmortems by status', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems?status=published')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.postmortems).toHaveLength(1);
      expect(res.body.postmortems[0].status).toBe('published');
    });

    it('should return empty array for non-matching filters', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems?incident_id=inc-999')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.postmortems).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe('GET /api/v1/postmortems/:id', () => {
    it('should get a single postmortem by id', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems/pm-001')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('pm-001');
      expect(res.body.title).toBe('SSL Certificate Expiry on Checkout Service');
      expect(res.body.incident_id).toBe('inc-004');
      expect(res.body.lessons_learned).toBeInstanceOf(Array);
      expect(res.body.action_items).toBeInstanceOf(Array);
    });

    it('should return 404 for unknown postmortem id', async () => {
      const res = await request(app)
        .get('/api/v1/postmortems/pm-999')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.message).toContain('pm-999');
    });
  });

  describe('POST /api/v1/postmortems', () => {
    it('should create a postmortem with valid data', async () => {
      const newPostmortem = {
        incident_id: 'inc-004',
        title: 'New Postmortem',
        summary: 'Test summary for postmortem',
        root_cause: 'Test root cause analysis',
        impact: 'Test impact assessment',
        lessons_learned: ['Lesson 1', 'Lesson 2'],
        action_items: [
          { description: 'Fix the thing', owner: 'team@company.com', due_date: '2024-03-01', status: 'pending' }
        ],
        author: 'test-author@company.com'
      };

      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send(newPostmortem);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Postmortem created');
      expect(res.body.postmortem.id).toMatch(/^pm-/);
      expect(res.body.postmortem.status).toBe('draft');
      expect(res.body.postmortem.incident_id).toBe('inc-004');
      expect(res.body.postmortem.summary).toBe('Test summary for postmortem');
      expect(res.body.postmortem.lessons_learned).toHaveLength(2);
      expect(res.body.postmortem.action_items).toHaveLength(1);
      expect(res.body.postmortem.author).toBe('test-author@company.com');
      expect(res.body.postmortem.created_at).toBeDefined();
      expect(res.body.postmortem.updated_at).toBeDefined();
    });

    it('should reject creation with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send({ incident_id: 'inc-004', summary: 'Only partial data' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Missing required fields');
    });

    it('should reject creation with non-array lessons_learned', async () => {
      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-004',
          summary: 'Summary',
          root_cause: 'Root cause',
          impact: 'Impact',
          lessons_learned: 'not an array',
          action_items: []
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('lessons_learned must be an array');
    });

    it('should reject creation with non-array action_items', async () => {
      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-004',
          summary: 'Summary',
          root_cause: 'Root cause',
          impact: 'Impact',
          lessons_learned: ['lesson'],
          action_items: 'not an array'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('action_items must be an array');
    });

    it('should return 404 for non-existent incident_id', async () => {
      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-999',
          summary: 'Summary',
          root_cause: 'Root cause',
          impact: 'Impact',
          lessons_learned: ['lesson'],
          action_items: [{ description: 'action', owner: 'owner', due_date: '2024-03-01', status: 'pending' }]
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.message).toContain('inc-999');
    });

    it('should generate default title from incident if not provided', async () => {
      const res = await request(app)
        .post('/api/v1/postmortems')
        .set('Authorization', AUTH_HEADER)
        .send({
          incident_id: 'inc-004',
          summary: 'Summary',
          root_cause: 'Root cause',
          impact: 'Impact',
          lessons_learned: ['lesson'],
          action_items: [{ description: 'action', owner: 'owner', due_date: '2024-03-01', status: 'pending' }]
        });

      expect(res.status).toBe(201);
      expect(res.body.postmortem.title).toContain('SSL certificate expiring on checkout-service');
    });
  });

  describe('PATCH /api/v1/postmortems/:id', () => {
    it('should update postmortem status from draft to published', async () => {
      const res = await request(app)
        .patch('/api/v1/postmortems/pm-002')
        .set('Authorization', AUTH_HEADER)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Postmortem updated');
      expect(res.body.postmortem.status).toBe('published');
      expect(res.body.postmortem.updated_at).toBeDefined();
    });

    it('should reject invalid status value', async () => {
      const res = await request(app)
        .patch('/api/v1/postmortems/pm-002')
        .set('Authorization', AUTH_HEADER)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('Invalid status');
    });

    it('should return 404 for unknown postmortem id', async () => {
      const res = await request(app)
        .patch('/api/v1/postmortems/pm-999')
        .set('Authorization', AUTH_HEADER)
        .send({ status: 'published' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.message).toContain('pm-999');
    });

    it('should update other fields along with status', async () => {
      const res = await request(app)
        .patch('/api/v1/postmortems/pm-002')
        .set('Authorization', AUTH_HEADER)
        .send({
          status: 'published',
          summary: 'Updated summary',
          lessons_learned: ['New lesson 1', 'New lesson 2', 'New lesson 3']
        });

      expect(res.status).toBe(200);
      expect(res.body.postmortem.status).toBe('published');
      expect(res.body.postmortem.summary).toBe('Updated summary');
      expect(res.body.postmortem.lessons_learned).toHaveLength(3);
    });
  });
});

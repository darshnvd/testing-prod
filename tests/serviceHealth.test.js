const request = require('supertest');

const API_KEY = 'oncall-agent-secret-key-2024';
const AUTH_HEADER = `Bearer ${API_KEY}`;

// Set API_KEY env var for test environment before loading app
process.env.API_KEY = API_KEY;

const app = require('../src/index');

describe('Service Health Dashboard', () => {
  describe('GET /api/v1/services', () => {
    it('should return a list of all known services', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('services');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.services)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);

      // Verify expected services are present
      const serviceNames = res.body.services.map(s => s.name);
      expect(serviceNames).toContain('payment-service');
      expect(serviceNames).toContain('user-service');
      expect(serviceNames).toContain('api-gateway');
      expect(serviceNames).toContain('checkout-service');
      expect(serviceNames).toContain('inventory-service');
    });

    it('should return services with expected structure', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      const service = res.body.services[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('activeIncidentCount');
      expect(service).toHaveProperty('healthScore');
      expect(['healthy', 'degraded', 'critical']).toContain(service.status);
      expect(service.healthScore).toBeGreaterThanOrEqual(0);
      expect(service.healthScore).toBeLessThanOrEqual(100);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/services');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/services/:name/health', () => {
    it('should return detailed health for a known service', async () => {
      const res = await request(app)
        .get('/api/v1/services/payment-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'payment-service');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('healthScore');
      expect(res.body).toHaveProperty('activeIncidents');
      expect(res.body).toHaveProperty('recentDeployments');
      expect(res.body).toHaveProperty('dependencies');
      expect(res.body).toHaveProperty('dependents');
      expect(res.body).toHaveProperty('lastChecked');
      expect(['healthy', 'degraded', 'critical']).toContain(res.body.status);
    });

    it('should return 404 for unknown service', async () => {
      const res = await request(app)
        .get('/api/v1/services/nonexistent-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
      expect(res.body).toHaveProperty('message');
    });

    it('should compute health score based on incident severity', async () => {
      // payment-service has 1 critical active incident -> 100 - 40 = 60
      const res = await request(app)
        .get('/api/v1/services/payment-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(60);
      expect(res.body.status).toBe('degraded');
    });

    it('should return score 100 for service with no active incidents', async () => {
      // checkout-service has only a resolved incident
      const res = await request(app)
        .get('/api/v1/services/checkout-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(100);
      expect(res.body.status).toBe('healthy');
      expect(res.body.activeIncidents).toHaveLength(0);
    });

    it('should include active incidents in response', async () => {
      const res = await request(app)
        .get('/api/v1/services/payment-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.activeIncidents.length).toBeGreaterThan(0);
      const incident = res.body.activeIncidents[0];
      expect(incident).toHaveProperty('id');
      expect(incident).toHaveProperty('title');
      expect(incident).toHaveProperty('severity');
      expect(incident).toHaveProperty('status');
    });

    it('should include recent deployments', async () => {
      const res = await request(app)
        .get('/api/v1/services/payment-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.recentDeployments.length).toBeGreaterThan(0);
      const deployment = res.body.recentDeployments[0];
      expect(deployment).toHaveProperty('id');
      expect(deployment).toHaveProperty('version');
      expect(deployment).toHaveProperty('status');
      expect(deployment).toHaveProperty('deployedAt');
    });

    it('should include dependencies and dependents', async () => {
      const res = await request(app)
        .get('/api/v1/services/payment-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.dependencies)).toBe(true);
      expect(res.body.dependencies.length).toBeGreaterThan(0);
      expect(Array.isArray(res.body.dependents)).toBe(true);
      expect(res.body.dependents.length).toBeGreaterThan(0);
    });

    it('should return empty arrays for service without dependency data', async () => {
      const res = await request(app)
        .get('/api/v1/services/checkout-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.dependencies).toEqual([]);
      expect(res.body.dependents).toEqual([]);
    });

    it('should handle service with acknowledged incident', async () => {
      // user-service has 1 high severity acknowledged incident -> 100 - 25 = 75
      const res = await request(app)
        .get('/api/v1/services/user-service/health')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(75);
      expect(res.body.status).toBe('healthy');
    });
  });
});

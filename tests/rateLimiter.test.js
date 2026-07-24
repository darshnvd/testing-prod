const request = require('supertest');

const API_KEY = 'oncall-agent-secret-key-2024';
const AUTH_HEADER = `Bearer ${API_KEY}`;

// Set API_KEY env var for test environment before loading app
process.env.API_KEY = API_KEY;

const app = require('../src/index');
const { resetRateLimiterState } = require('../src/middleware/rateLimiter');

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear rate limiter state between tests
    resetRateLimiterState();
  });

  describe('Requests within limit', () => {
    it('should allow requests within the rate limit', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(200);
    });

    it('should include rate limit headers on successful responses', async () => {
      const res = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should decrement remaining count with each request', async () => {
      const res1 = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);

      const res2 = await request(app)
        .get('/api/v1/agent/status')
        .set('Authorization', AUTH_HEADER);

      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);
      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Rate limit exceeded', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Use a very low limit for testing
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');

      // We will test directly with the app using default limits
      // Send requests until we exceed the limit (default 100)
      // Instead, let's test with a custom express app with low limit
      const express = require('express');
      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 60000, maxRequests: 3 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(testApp)
          .get('/test')
          .set('Authorization', AUTH_HEADER);
        expect(res.status).toBe(200);
      }

      // Reset state for this specific test app context
      reset();

      // Re-send requests to the custom app
      for (let i = 0; i < 3; i++) {
        await request(testApp)
          .get('/test')
          .set('Authorization', AUTH_HEADER);
      }

      // 4th request should be rate limited
      const limitedRes = await request(testApp)
        .get('/test')
        .set('Authorization', AUTH_HEADER);

      expect(limitedRes.status).toBe(429);
      expect(limitedRes.body.error).toBe('Too Many Requests');
      expect(limitedRes.body.message).toContain('Rate limit exceeded');
      expect(limitedRes.body.retryAfter).toBeDefined();
    });

    it('should return proper JSON body on 429', async () => {
      const express = require('express');
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');
      reset();

      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 60000, maxRequests: 2 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // Exhaust limit
      await request(testApp).get('/test').set('Authorization', AUTH_HEADER);
      await request(testApp).get('/test').set('Authorization', AUTH_HEADER);

      // Exceed limit
      const res = await request(testApp)
        .get('/test')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('error', 'Too Many Requests');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('retryAfter');
      expect(typeof res.body.retryAfter).toBe('number');
    });

    it('should include rate limit headers on 429 responses', async () => {
      const express = require('express');
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');
      reset();

      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 60000, maxRequests: 1 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // Exhaust limit
      await request(testApp).get('/test').set('Authorization', AUTH_HEADER);

      // Exceed limit
      const res = await request(testApp)
        .get('/test')
        .set('Authorization', AUTH_HEADER);

      expect(res.status).toBe(429);
      expect(res.headers['x-ratelimit-limit']).toBe('1');
      expect(res.headers['x-ratelimit-remaining']).toBe('0');
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Independent limits per API key', () => {
    it('should track rate limits independently for different API keys', async () => {
      const express = require('express');
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');
      reset();

      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 60000, maxRequests: 2 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // Exhaust limit for key A
      await request(testApp).get('/test').set('Authorization', 'Bearer key-a');
      await request(testApp).get('/test').set('Authorization', 'Bearer key-a');

      // Key A should be rate limited
      const resA = await request(testApp)
        .get('/test')
        .set('Authorization', 'Bearer key-a');
      expect(resA.status).toBe(429);

      // Key B should still work
      const resB = await request(testApp)
        .get('/test')
        .set('Authorization', 'Bearer key-b');
      expect(resB.status).toBe(200);
    });
  });

  describe('Window reset', () => {
    it('should allow requests again after the window resets', async () => {
      const express = require('express');
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');
      reset();

      // Use a very short window for testing
      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 100, maxRequests: 2 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // Exhaust limit
      await request(testApp).get('/test').set('Authorization', AUTH_HEADER);
      await request(testApp).get('/test').set('Authorization', AUTH_HEADER);

      // Should be rate limited
      const limitedRes = await request(testApp)
        .get('/test')
        .set('Authorization', AUTH_HEADER);
      expect(limitedRes.status).toBe(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      const res = await request(testApp)
        .get('/test')
        .set('Authorization', AUTH_HEADER);
      expect(res.status).toBe(200);
    });
  });

  describe('Bypass for unauthenticated requests', () => {
    it('should pass through requests without Authorization header', async () => {
      const express = require('express');
      const { createRateLimiter, resetRateLimiterState: reset } = require('../src/middleware/rateLimiter');
      reset();

      const testApp = express();
      testApp.use(express.json());
      testApp.use(createRateLimiter({ windowMs: 60000, maxRequests: 1 }));
      testApp.get('/test', (req, res) => {
        res.json({ ok: true });
      });

      // Multiple requests without auth should all pass the rate limiter
      const res1 = await request(testApp).get('/test');
      const res2 = await request(testApp).get('/test');

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });
});

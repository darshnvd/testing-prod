const express = require('express');
const router = express.Router();

/**
 * GET /api/v1/health
 * Health check endpoint for container orchestration and monitoring.
 * Returns service status, uptime, and memory usage.
 */
router.get('/', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    memory: {
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
    }
  };

  res.status(200).json(healthInfo);
});

/**
 * GET /api/v1/health/ready
 * Readiness probe - indicates whether the service is ready to accept traffic.
 */
router.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/health/live
 * Liveness probe - indicates whether the service is running.
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

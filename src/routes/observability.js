const express = require('express');
const router = express.Router();
const { deployments } = require('../data/store');

// POST /api/v1/observability/metrics - Query service metrics
router.post('/metrics', (req, res) => {
  const { service, metric, timeRange, aggregation } = req.body || {};

  if (!service || !metric) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: service, metric'
    });
  }

  // Generate realistic mock metrics
  const metrics = generateMetrics(service, metric, timeRange || '1h', aggregation || 'avg');

  res.json({
    service,
    metric,
    timeRange: timeRange || '1h',
    aggregation: aggregation || 'avg',
    datapoints: metrics.datapoints,
    summary: metrics.summary
  });
});

// GET /api/v1/observability/deployments - Get recent deployments
router.get('/deployments', (req, res) => {
  let { service, limit, since } = req.query;
  let filtered = [...deployments];

  if (service) {
    filtered = filtered.filter(d => d.service === service);
  }

  if (since) {
    const sinceDate = new Date(since);
    filtered = filtered.filter(d => new Date(d.deployedAt) >= sinceDate);
  }

  filtered.sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));

  if (limit) {
    filtered = filtered.slice(0, parseInt(limit, 10));
  }

  res.json({
    deployments: filtered,
    total: filtered.length
  });
});

// POST /api/v1/observability/logs - Fetch correlated logs
router.post('/logs', (req, res) => {
  const { service, level, timeRange, query, limit } = req.body || {};

  if (!service) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: service'
    });
  }

  // Generate realistic mock logs
  const logs = generateLogs(service, level, timeRange || '15m', query, limit || 50);

  res.json({
    service,
    level: level || 'all',
    timeRange: timeRange || '15m',
    logs: logs,
    total: logs.length
  });
});

function generateMetrics(service, metric, timeRange, aggregation) {
  const now = Date.now();
  const rangeMs = parseTimeRange(timeRange);
  const points = 12;
  const interval = rangeMs / points;

  const baseValues = {
    'latency_p99': { base: 250, variance: 100, unit: 'ms' },
    'latency_p50': { base: 45, variance: 20, unit: 'ms' },
    'error_rate': { base: 0.5, variance: 2, unit: '%' },
    'request_rate': { base: 1500, variance: 500, unit: 'req/s' },
    'cpu_usage': { base: 45, variance: 15, unit: '%' },
    'memory_usage': { base: 65, variance: 10, unit: '%' }
  };

  const config = baseValues[metric] || { base: 100, variance: 30, unit: 'units' };

  const datapoints = [];
  for (let i = 0; i < points; i++) {
    const timestamp = new Date(now - rangeMs + (i * interval)).toISOString();
    const value = config.base + (Math.random() * config.variance * 2 - config.variance);
    datapoints.push({
      timestamp,
      value: Math.round(value * 100) / 100
    });
  }

  const values = datapoints.map(d => d.value);
  const summary = {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    unit: config.unit
  };

  return { datapoints, summary };
}

function generateLogs(service, level, timeRange, query, limit) {
  const levels = ['debug', 'info', 'warn', 'error'];
  const now = Date.now();
  const rangeMs = parseTimeRange(timeRange);

  const logTemplates = {
    'payment-service': [
      { level: 'info', message: 'Transaction processed successfully', context: { transactionId: 'txn-123' } },
      { level: 'warn', message: 'Connection pool utilization above 80%', context: { poolSize: 20, active: 17 } },
      { level: 'error', message: 'Database query timeout after 5000ms', context: { query: 'SELECT * FROM orders', duration: 5000 } },
      { level: 'info', message: 'Health check passed', context: { uptime: '3600s' } },
      { level: 'error', message: 'Failed to process payment: gateway timeout', context: { provider: 'stripe', timeout: 30000 } }
    ],
    'user-service': [
      { level: 'info', message: 'User authenticated successfully', context: { userId: 'usr-456' } },
      { level: 'warn', message: 'Memory usage approaching threshold', context: { current: '850MB', limit: '1024MB' } },
      { level: 'error', message: 'Session store connection failed', context: { redis: 'redis://localhost:6379' } },
      { level: 'info', message: 'Cache hit ratio: 94%', context: { hits: 940, misses: 60 } }
    ],
    'api-gateway': [
      { level: 'info', message: 'Request routed successfully', context: { path: '/api/v1/users', upstream: 'user-service' } },
      { level: 'warn', message: 'Rate limit approaching for client', context: { clientId: 'client-789', remaining: 50 } },
      { level: 'error', message: 'Upstream service returned 502', context: { upstream: 'inventory-service', attempts: 3 } },
      { level: 'info', message: 'Circuit breaker state: closed', context: { service: 'payment-service', errorRate: '2%' } }
    ]
  };

  const templates = logTemplates[service] || [
    { level: 'info', message: `${service} log entry`, context: {} }
  ];

  const logs = [];
  const maxLogs = Math.min(limit, 50);

  for (let i = 0; i < maxLogs; i++) {
    const template = templates[i % templates.length];
    if (level && template.level !== level) continue;

    const timestamp = new Date(now - Math.random() * rangeMs).toISOString();
    logs.push({
      timestamp,
      level: template.level,
      service,
      message: template.message,
      context: template.context
    });
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (query) {
    return logs.filter(l => l.message.toLowerCase().includes(query.toLowerCase()));
  }

  return logs;
}

function parseTimeRange(range) {
  const match = range.match(/^(\d+)([mhd])$/);
  if (!match) return 3600000; // default 1h

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'm': return value * 60000;
    case 'h': return value * 3600000;
    case 'd': return value * 86400000;
    default: return 3600000;
  }
}

module.exports = router;

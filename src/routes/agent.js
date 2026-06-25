const express = require('express');
const router = express.Router();
const { agentState, incidents } = require('../data/store');

// GET /api/v1/agent/status - Get agent status
router.get('/status', (req, res) => {
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'acknowledged');
  const uptimeMs = agentState.startedAt
    ? Date.now() - new Date(agentState.startedAt).getTime()
    : 0;

  res.json({
    status: agentState.status,
    uptime: {
      ms: uptimeMs,
      human: formatUptime(uptimeMs)
    },
    activeIncidents: activeIncidents.length,
    health: {
      overall: 'healthy',
      integrations: agentState.integrations
    },
    config: agentState.config
  });
});

// POST /api/v1/agent/start - Start agent with config profile
router.post('/start', (req, res) => {
  const { profile } = req.body || {};

  if (agentState.status === 'running') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Agent is already running'
    });
  }

  agentState.status = 'running';
  agentState.startedAt = new Date().toISOString();
  if (profile) {
    agentState.config.profile = profile;
  }

  res.status(200).json({
    message: 'Agent started successfully',
    status: agentState.status,
    startedAt: agentState.startedAt,
    config: agentState.config
  });
});

// POST /api/v1/agent/stop - Gracefully stop agent
router.post('/stop', (req, res) => {
  if (agentState.status === 'stopped') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Agent is already stopped'
    });
  }

  agentState.status = 'stopped';
  agentState.startedAt = null;

  res.status(200).json({
    message: 'Agent stopped gracefully',
    status: agentState.status,
    stoppedAt: new Date().toISOString()
  });
});

// Whitelist of allowed config keys
const ALLOWED_CONFIG_KEYS = [
  'profile',
  'autoTriageEnabled',
  'autoEscalateAfterMinutes',
  'maxConcurrentIncidents',
  'notificationChannels'
];

// PATCH /api/v1/agent/config - Update runtime configuration
router.patch('/config', (req, res) => {
  const updates = req.body;

  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'No configuration updates provided'
    });
  }

  const invalidKeys = Object.keys(updates).filter(key => !ALLOWED_CONFIG_KEYS.includes(key));
  if (invalidKeys.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid configuration keys: ${invalidKeys.join(', ')}. Allowed keys: ${ALLOWED_CONFIG_KEYS.join(', ')}`
    });
  }

  Object.assign(agentState.config, updates);

  res.json({
    message: 'Configuration updated successfully',
    config: agentState.config
  });
});

// GET /api/v1/agent/health - Deep health check for all integrations
router.get('/health', (req, res) => {
  const integrationStatuses = Object.entries(agentState.integrations).map(([name, info]) => ({
    name,
    status: info.status,
    lastSync: info.lastSync,
    healthy: info.status === 'connected'
  }));

  const allHealthy = integrationStatuses.every(i => i.healthy);

  res.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    agent: {
      status: agentState.status,
      uptime: agentState.startedAt
        ? Date.now() - new Date(agentState.startedAt).getTime()
        : 0
    },
    integrations: integrationStatuses,
    system: {
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    }
  });
});

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

module.exports = router;

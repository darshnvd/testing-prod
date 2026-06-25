const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { communications, incidents } = require('../data/store');

// POST /notifications/send - Send incident update notification
router.post('/send', (req, res) => {
  const { incident_id, channel, message, type } = req.body || {};

  if (!incident_id || !message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: incident_id, message'
    });
  }

  const incident = incidents.find(i => i.id === incident_id);
  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${incident_id} not found`
    });
  }

  const notification = {
    id: `comm-${uuidv4().slice(0, 8)}`,
    incidentId: incident_id,
    type: type || 'slack',
    channel: channel || '#incidents',
    message,
    sentAt: new Date().toISOString(),
    sentBy: 'api-user'
  };

  communications.push(notification);

  res.status(201).json({
    message: 'Notification sent successfully',
    notification
  });
});

// GET /incidents/:incident_id/communications - Get communication log
router.get('/incidents/:incident_id/communications', (req, res) => {
  const incidentId = req.params.incident_id;
  const incident = incidents.find(i => i.id === incidentId);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${incidentId} not found`
    });
  }

  const logs = communications.filter(c => c.incidentId === incidentId);

  res.json({
    incidentId,
    communications: logs,
    total: logs.length
  });
});

// POST /agent/chat - Ask AI agent a question
router.post('/agent/chat', (req, res) => {
  const { question, context } = req.body || {};

  if (!question) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: question'
    });
  }

  // Simulate AI agent response based on keywords
  const response = generateAgentResponse(question, context);

  res.json({
    question,
    response: response.answer,
    confidence: response.confidence,
    sources: response.sources,
    timestamp: new Date().toISOString()
  });
});

function generateAgentResponse(question, context) {
  const questionLower = question.toLowerCase();

  if (questionLower.includes('incident') || questionLower.includes('alert')) {
    return {
      answer: 'There are currently 2 active incidents: a critical latency issue on payment-service and elevated 5xx errors on the API gateway. The payment-service issue appears to be related to database connection pool exhaustion. I recommend checking the recent deployment and increasing the pool size.',
      confidence: 0.88,
      sources: ['incident-store', 'recent-deployments', 'metrics-analysis']
    };
  }

  if (questionLower.includes('deploy') || questionLower.includes('release')) {
    return {
      answer: 'The most recent deployment was payment-service v2.4.1 (30 minutes ago) which fixed connection pool timeout handling. There is also a rolling back deployment for inventory-service v3.1.0. I recommend monitoring the payment-service deployment closely given the current latency incident.',
      confidence: 0.92,
      sources: ['deployment-log', 'incident-correlation']
    };
  }

  if (questionLower.includes('runbook') || questionLower.includes('restart')) {
    return {
      answer: 'I have 4 runbooks available. For the current situation, I recommend "Restart Service Pods" (rb-001) for immediate mitigation, or "Scale Up Service" (rb-002) if you need to handle increased load. Both require approval before execution.',
      confidence: 0.85,
      sources: ['runbook-catalog', 'incident-context']
    };
  }

  return {
    answer: `I understand your question about "${question}". Based on the current system state, there are 2 active incidents being monitored, 4 runbooks available for remediation, and all integrations are connected and healthy. Can you provide more specific details about what you need help with?`,
    confidence: 0.7,
    sources: ['system-state', 'knowledge-base']
  };
}

module.exports = router;

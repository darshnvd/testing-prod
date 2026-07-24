const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { incidents, communications } = require('../data/store');

// GET /api/v1/incidents - List active incidents
router.get('/', (req, res) => {
  let { status, sort, limit } = req.query;

  let filtered = [...incidents];

  if (status) {
    filtered = filtered.filter(i => i.status === status);
  }

  if (sort === 'severity') {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  } else if (sort === 'created') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (limit) {
    filtered = filtered.slice(0, parseInt(limit, 10));
  }

  res.json({
    incidents: filtered,
    total: filtered.length,
    filters: { status, sort, limit }
  });
});

// GET /api/v1/incidents/:incident_id - Get incident details
router.get('/:incident_id', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  res.json(incident);
});

// POST /api/v1/incidents/triage - Trigger AI triage for an incoming alert
router.post('/triage', (req, res) => {
  const { alert_source, service, metric, value, threshold, description } = req.body || {};

  if (!service || !description) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: service, description'
    });
  }

  const newIncident = {
    id: `inc-${uuidv4().slice(0, 8)}`,
    title: description || `Alert from ${alert_source} on ${service}`,
    status: 'active',
    severity: determineSeverity(metric, value, threshold),
    service: service,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    acknowledgedBy: null,
    resolvedAt: null,
    diagnosis: {
      summary: `AI triage initiated for ${service} - analyzing ${metric || 'alert'} anomaly`,
      confidence: 0.75,
      rootCause: 'Analysis in progress - correlating with recent changes and metrics',
      suggestedActions: [
        `Check ${service} logs for errors`,
        'Review recent deployments',
        'Check dependent service health'
      ],
      relatedEvents: []
    },
    alerts: [
      { source: alert_source || 'manual', metric: metric || 'unknown', value: value || 'N/A', threshold: threshold || 'N/A' }
    ]
  };

  incidents.push(newIncident);

  res.status(201).json({
    message: 'Triage initiated',
    incident: newIncident
  });
});

// POST /api/v1/incidents/:incident_id/acknowledge - Acknowledge incident
router.post('/:incident_id/acknowledge', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  if (incident.status === 'resolved') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Cannot acknowledge a resolved incident'
    });
  }

  const { acknowledged_by } = req.body || {};
  const acknowledger = acknowledged_by || 'api-user';
  incident.status = 'acknowledged';
  incident.acknowledgedBy = acknowledger;
  incident.updatedAt = new Date().toISOString();

  // Auto-append timeline event for acknowledgement
  if (!incident.timeline) {
    incident.timeline = [];
  }
  incident.timeline.push({
    id: uuidv4(),
    type: 'status_change',
    message: `Incident acknowledged by ${acknowledger}`,
    author: acknowledger,
    timestamp: new Date().toISOString()
  });

  res.json({
    message: 'Incident acknowledged',
    incident
  });
});

// GET /api/v1/incidents/:incident_id/diagnosis - Get AI diagnosis
router.get('/:incident_id/diagnosis', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  res.json({
    incidentId: incident.id,
    diagnosis: incident.diagnosis,
    generatedAt: new Date().toISOString()
  });
});

// POST /api/v1/incidents/:incident_id/resolve - Resolve incident
router.post('/:incident_id/resolve', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  if (incident.status === 'resolved') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Incident is already resolved'
    });
  }

  const { resolution_notes } = req.body || {};
  incident.status = 'resolved';
  incident.resolvedAt = new Date().toISOString();
  incident.updatedAt = new Date().toISOString();
  incident.resolutionNotes = resolution_notes || 'Resolved via API';

  // Auto-append timeline event for resolution
  if (!incident.timeline) {
    incident.timeline = [];
  }
  incident.timeline.push({
    id: uuidv4(),
    type: 'status_change',
    message: `Incident resolved - ${resolution_notes || 'Resolved via API'}`,
    author: 'api-user',
    timestamp: new Date().toISOString()
  });

  res.json({
    message: 'Incident resolved',
    incident
  });
});

// GET /api/v1/incidents/:incident_id/timeline - Get incident timeline
router.get('/:incident_id/timeline', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  let timeline = incident.timeline || [];

  // Support optional ?type= filter
  const { type } = req.query;
  if (type) {
    timeline = timeline.filter(event => event.type === type);
  }

  // Sort newest-first
  timeline = [...timeline].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    incidentId: incident.id,
    timeline,
    total: timeline.length
  });
});

// POST /api/v1/incidents/:incident_id/timeline/events - Add custom timeline event
router.post('/:incident_id/timeline/events', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.incident_id);

  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${req.params.incident_id} not found`
    });
  }

  const { type, message, author } = req.body || {};

  if (!type || !message || !author) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: type, message, author'
    });
  }

  if (!incident.timeline) {
    incident.timeline = [];
  }

  const event = {
    id: uuidv4(),
    type,
    message,
    author,
    timestamp: new Date().toISOString()
  };

  incident.timeline.push(event);

  res.status(201).json({
    message: 'Timeline event added',
    event
  });
});

function determineSeverity(metric, value, threshold) {
  if (!value || !threshold) return 'medium';
  const numValue = parseFloat(value);
  const numThreshold = parseFloat(threshold);
  if (isNaN(numValue) || isNaN(numThreshold)) return 'medium';

  const ratio = numValue / numThreshold;
  if (ratio >= 4) return 'critical';
  if (ratio >= 2) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

module.exports = router;

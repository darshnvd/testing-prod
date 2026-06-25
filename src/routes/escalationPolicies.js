const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { escalationPolicies, incidents, escalations } = require('../data/store');

// GET /api/v1/escalation-policies - List escalation policies
router.get('/', (req, res) => {
  res.json({
    policies: escalationPolicies,
    total: escalationPolicies.length
  });
});

// POST /api/v1/escalation-policies - Create escalation policy
router.post('/', (req, res) => {
  const { name, description, levels, services } = req.body || {};

  if (!name || !levels || !Array.isArray(levels)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: name, levels (array)'
    });
  }

  const policy = {
    id: `ep-${uuidv4().slice(0, 8)}`,
    name,
    description: description || '',
    levels,
    services: services || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  escalationPolicies.push(policy);

  res.status(201).json({
    message: 'Escalation policy created',
    policy
  });
});

// POST /api/v1/escalation-policies/escalate - Trigger manual escalation
router.post('/escalate', (req, res) => {
  const { incident_id, reason, target_level } = req.body || {};

  if (!incident_id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: incident_id'
    });
  }

  const incident = incidents.find(i => i.id === incident_id);
  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${incident_id} not found`
    });
  }

  // Find matching policy for the incident's service
  const policy = escalationPolicies.find(p => p.services.includes(incident.service));

  const escalation = {
    id: `esc-${uuidv4().slice(0, 8)}`,
    incidentId: incident_id,
    policyId: policy ? policy.id : null,
    policyName: policy ? policy.name : 'Default',
    targetLevel: target_level || (policy ? policy.levels.length : 1),
    reason: reason || 'Manual escalation triggered',
    escalatedAt: new Date().toISOString(),
    notifiedTargets: policy
      ? policy.levels[(target_level || policy.levels.length) - 1]?.targets || []
      : ['engineering-manager@company.com']
  };

  escalations.push(escalation);

  res.json({
    message: 'Escalation triggered',
    escalation
  });
});

module.exports = router;

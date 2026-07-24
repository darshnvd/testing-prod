const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { postmortems, incidents } = require('../data/store');

// GET /api/v1/postmortems - List all postmortems with optional filters
router.get('/', (req, res) => {
  const { incident_id, status } = req.query;

  let results = [...postmortems];

  if (incident_id) {
    results = results.filter(pm => pm.incident_id === incident_id);
  }

  if (status) {
    results = results.filter(pm => pm.status === status);
  }

  res.json({
    postmortems: results,
    total: results.length
  });
});

// GET /api/v1/postmortems/:id - Get single postmortem
router.get('/:id', (req, res) => {
  const postmortem = postmortems.find(pm => pm.id === req.params.id);

  if (!postmortem) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Postmortem ${req.params.id} not found`
    });
  }

  res.json(postmortem);
});

// POST /api/v1/postmortems - Create a new postmortem
router.post('/', (req, res) => {
  const { incident_id, title, summary, root_cause, impact, lessons_learned, action_items, author } = req.body || {};

  if (!incident_id || !summary || !root_cause || !impact || !lessons_learned || !action_items) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: incident_id, summary, root_cause, impact, lessons_learned, action_items'
    });
  }

  if (!Array.isArray(lessons_learned)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'lessons_learned must be an array'
    });
  }

  if (!Array.isArray(action_items)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'action_items must be an array'
    });
  }

  const incident = incidents.find(i => i.id === incident_id);
  if (!incident) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Incident ${incident_id} not found`
    });
  }

  const now = new Date().toISOString();
  const postmortem = {
    id: `pm-${uuidv4().slice(0, 8)}`,
    incident_id,
    title: title || `Postmortem for ${incident.title}`,
    status: 'draft',
    summary,
    root_cause,
    impact,
    lessons_learned,
    action_items,
    created_at: now,
    updated_at: now,
    author: author || 'unknown'
  };

  postmortems.push(postmortem);

  res.status(201).json({
    message: 'Postmortem created',
    postmortem
  });
});

// PATCH /api/v1/postmortems/:id - Update postmortem status
router.patch('/:id', (req, res) => {
  const postmortem = postmortems.find(pm => pm.id === req.params.id);

  if (!postmortem) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Postmortem ${req.params.id} not found`
    });
  }

  const { status, summary, root_cause, impact, lessons_learned, action_items, title } = req.body || {};

  if (status) {
    const validStatuses = ['draft', 'published'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    postmortem.status = status;
  }

  if (title) postmortem.title = title;
  if (summary) postmortem.summary = summary;
  if (root_cause) postmortem.root_cause = root_cause;
  if (impact) postmortem.impact = impact;
  if (lessons_learned) postmortem.lessons_learned = lessons_learned;
  if (action_items) postmortem.action_items = action_items;

  postmortem.updated_at = new Date().toISOString();

  res.json({
    message: 'Postmortem updated',
    postmortem
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runbooks, executions } = require('../data/store');

// GET /api/v1/runbooks - List available runbooks
router.get('/', (req, res) => {
  let { service, status } = req.query;
  let filtered = [...runbooks];

  if (service) {
    filtered = filtered.filter(r => r.service === service || r.service === 'any');
  }

  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  res.json({
    runbooks: filtered,
    total: filtered.length
  });
});

// GET /api/v1/runbooks/:runbook_id - Get runbook details
router.get('/:runbook_id', (req, res) => {
  const runbook = runbooks.find(r => r.id === req.params.runbook_id);

  if (!runbook) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Runbook ${req.params.runbook_id} not found`
    });
  }

  res.json(runbook);
});

// POST /api/v1/runbooks/execute - Execute a runbook
router.post('/execute', (req, res) => {
  const { runbook_id, target_service, parameters } = req.body || {};

  if (!runbook_id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: runbook_id'
    });
  }

  const runbook = runbooks.find(r => r.id === runbook_id);
  if (!runbook) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Runbook ${runbook_id} not found`
    });
  }

  const hasApprovalStep = runbook.steps.some(s => s.type === 'approval_required');

  const execution = {
    id: `exec-${uuidv4().slice(0, 8)}`,
    runbookId: runbook_id,
    runbookName: runbook.name,
    targetService: target_service || runbook.service,
    status: hasApprovalStep ? 'pending_approval' : 'running',
    parameters: parameters || {},
    startedAt: new Date().toISOString(),
    completedAt: null,
    currentStep: 1,
    totalSteps: runbook.steps.length,
    steps: runbook.steps.map(s => ({
      ...s,
      status: s.order === 1 && !hasApprovalStep ? 'running' : 'pending'
    })),
    initiatedBy: 'api-user'
  };

  executions.push(execution);

  res.status(201).json({
    message: hasApprovalStep ? 'Execution created - awaiting approval' : 'Execution started',
    execution
  });
});

// GET /api/v1/runbooks/executions/:execution_id - Get execution status
router.get('/executions/:execution_id', (req, res) => {
  const execution = executions.find(e => e.id === req.params.execution_id);

  if (!execution) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Execution ${req.params.execution_id} not found`
    });
  }

  res.json(execution);
});

// POST /api/v1/runbooks/executions/:execution_id/approve - Approve pending execution
router.post('/executions/:execution_id/approve', (req, res) => {
  const execution = executions.find(e => e.id === req.params.execution_id);

  if (!execution) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Execution ${req.params.execution_id} not found`
    });
  }

  if (execution.status !== 'pending_approval') {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Execution is not pending approval. Current status: ${execution.status}`
    });
  }

  const { approved_by } = req.body || {};
  execution.status = 'running';
  execution.approvedBy = approved_by || 'api-user';
  execution.approvedAt = new Date().toISOString();
  execution.steps = execution.steps.map((s, i) => ({
    ...s,
    status: i === 0 ? 'running' : s.status
  }));

  res.json({
    message: 'Execution approved and started',
    execution
  });
});

module.exports = router;

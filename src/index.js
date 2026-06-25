require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authenticate = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const agentRoutes = require('./routes/agent');
const incidentRoutes = require('./routes/incidents');
const runbookRoutes = require('./routes/runbooks');
const escalationPolicyRoutes = require('./routes/escalationPolicies');
const knowledgeBaseRoutes = require('./routes/knowledgeBase');
const notificationsRoutes = require('./routes/notifications');
const observabilityRoutes = require('./routes/observability');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { skip: () => process.env.NODE_ENV === 'test' }));
app.use(express.json());

// Authentication middleware (applied before routes)
app.use(authenticate);

// Route mounting
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/runbooks', runbookRoutes);
app.use('/api/v1/escalation-policies', escalationPolicyRoutes);
app.use('/api/v1/knowledge-base', knowledgeBaseRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/observability', observabilityRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'OnCall AI Agent Control Plane API',
    version: '1.0.0',
    documentation: '/api/v1',
    endpoints: {
      agent: '/api/v1/agent',
      incidents: '/api/v1/incidents',
      runbooks: '/api/v1/runbooks',
      escalationPolicies: '/api/v1/escalation-policies',
      knowledgeBase: '/api/v1/knowledge-base',
      notifications: '/api/v1/notifications',
      observability: '/api/v1/observability'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use(errorHandler);

// Start server (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`OnCall AI Agent API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;

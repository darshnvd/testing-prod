const { v4: uuidv4 } = require('uuid');

// Agent state
const agentState = {
  status: 'running',
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  config: {
    profile: 'production',
    autoTriageEnabled: true,
    autoEscalateAfterMinutes: 15,
    maxConcurrentIncidents: 10,
    notificationChannels: ['slack', 'pagerduty', 'email']
  },
  integrations: {
    pagerduty: { status: 'connected', lastSync: new Date(Date.now() - 60000).toISOString() },
    slack: { status: 'connected', lastSync: new Date(Date.now() - 30000).toISOString() },
    datadog: { status: 'connected', lastSync: new Date(Date.now() - 45000).toISOString() },
    jira: { status: 'connected', lastSync: new Date(Date.now() - 120000).toISOString() }
  }
};

// Incidents
const incidents = [
  {
    id: 'inc-001',
    title: 'High latency on payment-service',
    status: 'active',
    severity: 'critical',
    service: 'payment-service',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    acknowledgedBy: null,
    resolvedAt: null,
    diagnosis: {
      summary: 'Database connection pool exhaustion causing request queuing',
      confidence: 0.92,
      rootCause: 'Connection pool max size (20) reached due to slow queries on orders table',
      suggestedActions: [
        'Increase connection pool size to 50',
        'Add index on orders.created_at column',
        'Enable query timeout of 5s'
      ],
      relatedEvents: ['deploy-xyz-123 (30 min ago)', 'DB CPU spike at 14:23 UTC']
    },
    alerts: [
      { source: 'datadog', metric: 'p99_latency', value: '4500ms', threshold: '1000ms' }
    ]
  },
  {
    id: 'inc-002',
    title: 'Memory leak in user-service',
    status: 'acknowledged',
    severity: 'high',
    service: 'user-service',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    acknowledgedBy: 'engineer@company.com',
    resolvedAt: null,
    diagnosis: {
      summary: 'Gradual memory increase indicating possible memory leak in session handling',
      confidence: 0.78,
      rootCause: 'Session objects not being garbage collected due to circular references in middleware',
      suggestedActions: [
        'Restart pods as immediate mitigation',
        'Review session middleware for circular references',
        'Add memory limit alerts at 80% threshold'
      ],
      relatedEvents: ['Version 2.3.1 deployed 6 hours ago']
    },
    alerts: [
      { source: 'datadog', metric: 'memory_usage', value: '89%', threshold: '80%' }
    ]
  },
  {
    id: 'inc-003',
    title: 'Elevated 5xx errors on API gateway',
    status: 'active',
    severity: 'medium',
    service: 'api-gateway',
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 120000).toISOString(),
    acknowledgedBy: null,
    resolvedAt: null,
    diagnosis: {
      summary: 'Upstream service timeouts causing cascading 502 errors',
      confidence: 0.85,
      rootCause: 'Inventory-service experiencing cold starts after scale-down event',
      suggestedActions: [
        'Increase minimum replica count for inventory-service',
        'Add circuit breaker with fallback response',
        'Review autoscaling cooldown period'
      ],
      relatedEvents: ['Scale-down event at 13:45 UTC', 'Traffic spike at 14:00 UTC']
    },
    alerts: [
      { source: 'cloudwatch', metric: '5xx_rate', value: '12%', threshold: '5%' }
    ]
  },
  {
    id: 'inc-004',
    title: 'SSL certificate expiring on checkout-service',
    status: 'resolved',
    severity: 'low',
    service: 'checkout-service',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    acknowledgedBy: 'ops-team@company.com',
    resolvedAt: new Date(Date.now() - 43200000).toISOString(),
    diagnosis: {
      summary: 'SSL certificate expires in 7 days - auto-renewal failed',
      confidence: 0.99,
      rootCause: 'Certificate manager IAM role missing acm:RequestCertificate permission',
      suggestedActions: [
        'Manually renew certificate',
        'Fix IAM role permissions for cert-manager',
        'Add monitoring for cert expiry < 14 days'
      ],
      relatedEvents: ['IAM policy change 2 weeks ago']
    },
    alerts: [
      { source: 'internal', metric: 'cert_days_remaining', value: '7', threshold: '14' }
    ]
  }
];

// Runbooks
const runbooks = [
  {
    id: 'rb-001',
    name: 'Restart Service Pods',
    description: 'Performs a rolling restart of all pods for a given service',
    service: 'any',
    status: 'active',
    steps: [
      { order: 1, action: 'Check current pod health', type: 'automated' },
      { order: 2, action: 'Cordon unhealthy nodes', type: 'automated' },
      { order: 3, action: 'Initiate rolling restart', type: 'approval_required' },
      { order: 4, action: 'Verify pod health post-restart', type: 'automated' },
      { order: 5, action: 'Uncordon nodes', type: 'automated' }
    ],
    estimatedDuration: '5-10 minutes',
    lastExecuted: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'platform-team'
  },
  {
    id: 'rb-002',
    name: 'Scale Up Service',
    description: 'Increases replica count for a service to handle traffic spikes',
    service: 'any',
    status: 'active',
    steps: [
      { order: 1, action: 'Check current replica count', type: 'automated' },
      { order: 2, action: 'Verify cluster capacity', type: 'automated' },
      { order: 3, action: 'Scale deployment to target replicas', type: 'approval_required' },
      { order: 4, action: 'Wait for pods to become ready', type: 'automated' },
      { order: 5, action: 'Verify load balancer targets', type: 'automated' }
    ],
    estimatedDuration: '3-5 minutes',
    lastExecuted: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'sre-team'
  },
  {
    id: 'rb-003',
    name: 'Database Failover',
    description: 'Performs a controlled failover to database replica',
    service: 'payment-service',
    status: 'active',
    steps: [
      { order: 1, action: 'Verify replica sync status', type: 'automated' },
      { order: 2, action: 'Enable maintenance mode', type: 'approval_required' },
      { order: 3, action: 'Promote replica to primary', type: 'approval_required' },
      { order: 4, action: 'Update connection strings', type: 'automated' },
      { order: 5, action: 'Disable maintenance mode', type: 'automated' },
      { order: 6, action: 'Verify application connectivity', type: 'automated' }
    ],
    estimatedDuration: '10-15 minutes',
    lastExecuted: null,
    createdBy: 'dba-team'
  },
  {
    id: 'rb-004',
    name: 'Clear Application Cache',
    description: 'Purges Redis cache for a service and warms critical paths',
    service: 'user-service',
    status: 'inactive',
    steps: [
      { order: 1, action: 'Identify cache keys by pattern', type: 'automated' },
      { order: 2, action: 'Flush matching cache entries', type: 'approval_required' },
      { order: 3, action: 'Warm critical cache paths', type: 'automated' },
      { order: 4, action: 'Monitor cache hit ratio', type: 'automated' }
    ],
    estimatedDuration: '2-5 minutes',
    lastExecuted: new Date(Date.now() - 604800000).toISOString(),
    createdBy: 'backend-team'
  }
];

// Runbook executions
const executions = [];

// Escalation policies
const escalationPolicies = [
  {
    id: 'ep-001',
    name: 'Critical Service Policy',
    description: 'Escalation path for critical service incidents',
    levels: [
      { level: 1, targets: ['on-call-engineer@company.com'], timeoutMinutes: 5 },
      { level: 2, targets: ['senior-engineer@company.com', 'team-lead@company.com'], timeoutMinutes: 10 },
      { level: 3, targets: ['engineering-manager@company.com', 'vp-engineering@company.com'], timeoutMinutes: 15 }
    ],
    services: ['payment-service', 'api-gateway', 'checkout-service'],
    createdAt: new Date(Date.now() - 2592000000).toISOString(),
    updatedAt: new Date(Date.now() - 604800000).toISOString()
  },
  {
    id: 'ep-002',
    name: 'Non-Critical Services Policy',
    description: 'Standard escalation for non-critical service alerts',
    levels: [
      { level: 1, targets: ['on-call-engineer@company.com'], timeoutMinutes: 15 },
      { level: 2, targets: ['team-lead@company.com'], timeoutMinutes: 30 }
    ],
    services: ['user-service', 'notification-service', 'analytics-service'],
    createdAt: new Date(Date.now() - 2592000000).toISOString(),
    updatedAt: new Date(Date.now() - 1209600000).toISOString()
  },
  {
    id: 'ep-003',
    name: 'Infrastructure Policy',
    description: 'Escalation for infrastructure-level incidents',
    levels: [
      { level: 1, targets: ['infra-on-call@company.com'], timeoutMinutes: 5 },
      { level: 2, targets: ['sre-lead@company.com'], timeoutMinutes: 10 },
      { level: 3, targets: ['cto@company.com'], timeoutMinutes: 20 }
    ],
    services: ['kubernetes-cluster', 'database-primary', 'cdn', 'dns'],
    createdAt: new Date(Date.now() - 1296000000).toISOString(),
    updatedAt: new Date(Date.now() - 259200000).toISOString()
  }
];

// Knowledge base documents
const knowledgeBase = [
  {
    id: 'kb-001',
    title: 'Payment Service Architecture',
    service: 'payment-service',
    content: 'The payment service handles all transaction processing. It connects to PostgreSQL for persistence, Redis for caching, and communicates with external payment providers (Stripe, PayPal) via REST APIs.',
    tags: ['architecture', 'payment', 'database'],
    dependencies: ['postgresql', 'redis', 'stripe-api', 'paypal-api', 'api-gateway'],
    createdAt: new Date(Date.now() - 7776000000).toISOString()
  },
  {
    id: 'kb-002',
    title: 'User Service Troubleshooting Guide',
    service: 'user-service',
    content: 'Common issues: 1) Memory leaks - check for unclosed connections. 2) High latency - verify Redis cache connectivity. 3) Auth failures - check JWT token expiry configuration.',
    tags: ['troubleshooting', 'user-service', 'memory', 'auth'],
    dependencies: ['redis', 'auth-service', 'postgresql'],
    createdAt: new Date(Date.now() - 5184000000).toISOString()
  },
  {
    id: 'kb-003',
    title: 'API Gateway Configuration',
    service: 'api-gateway',
    content: 'The API gateway uses Kong with custom rate limiting and circuit breaker plugins. Rate limits: 1000 req/min for authenticated, 100 req/min for anonymous. Circuit breaker opens at 50% error rate.',
    tags: ['configuration', 'api-gateway', 'rate-limiting', 'circuit-breaker'],
    dependencies: ['kong', 'redis', 'all-backend-services'],
    createdAt: new Date(Date.now() - 6048000000).toISOString()
  },
  {
    id: 'kb-004',
    title: 'Incident Response Playbook',
    service: 'all',
    content: 'Step 1: Acknowledge alert within 5 minutes. Step 2: Assess severity and impact. Step 3: Engage relevant on-call. Step 4: Mitigate and communicate. Step 5: Resolve and document.',
    tags: ['incident-response', 'playbook', 'process'],
    dependencies: [],
    createdAt: new Date(Date.now() - 8640000000).toISOString()
  }
];

// Service dependency map
const serviceDependencies = {
  'payment-service': {
    service: 'payment-service',
    dependencies: [
      { name: 'postgresql', type: 'database', critical: true },
      { name: 'redis', type: 'cache', critical: false },
      { name: 'stripe-api', type: 'external', critical: true },
      { name: 'api-gateway', type: 'internal', critical: true },
      { name: 'notification-service', type: 'internal', critical: false }
    ],
    dependents: ['checkout-service', 'refund-service', 'analytics-service']
  },
  'user-service': {
    service: 'user-service',
    dependencies: [
      { name: 'postgresql', type: 'database', critical: true },
      { name: 'redis', type: 'cache', critical: true },
      { name: 'auth-service', type: 'internal', critical: true }
    ],
    dependents: ['api-gateway', 'notification-service', 'analytics-service']
  },
  'api-gateway': {
    service: 'api-gateway',
    dependencies: [
      { name: 'kong', type: 'infrastructure', critical: true },
      { name: 'redis', type: 'cache', critical: false },
      { name: 'payment-service', type: 'internal', critical: true },
      { name: 'user-service', type: 'internal', critical: true },
      { name: 'inventory-service', type: 'internal', critical: false }
    ],
    dependents: ['web-frontend', 'mobile-app', 'partner-api']
  }
};

// Communication logs
const communications = [
  {
    id: 'comm-001',
    incidentId: 'inc-001',
    type: 'slack',
    channel: '#incidents-critical',
    message: 'CRITICAL: High latency detected on payment-service. P99 latency at 4500ms (threshold: 1000ms). AI agent investigating.',
    sentAt: new Date(Date.now() - 1700000).toISOString(),
    sentBy: 'oncall-agent'
  },
  {
    id: 'comm-002',
    incidentId: 'inc-001',
    type: 'pagerduty',
    channel: 'payment-oncall',
    message: 'Payment service latency critical - immediate action required',
    sentAt: new Date(Date.now() - 1680000).toISOString(),
    sentBy: 'oncall-agent'
  },
  {
    id: 'comm-003',
    incidentId: 'inc-002',
    type: 'slack',
    channel: '#incidents-high',
    message: 'HIGH: Memory usage at 89% on user-service. Possible memory leak detected. Suggested action: rolling restart.',
    sentAt: new Date(Date.now() - 7000000).toISOString(),
    sentBy: 'oncall-agent'
  }
];

// Deployments
const deployments = [
  {
    id: 'deploy-001',
    service: 'payment-service',
    version: '2.4.1',
    status: 'completed',
    deployedAt: new Date(Date.now() - 1800000).toISOString(),
    deployedBy: 'ci-pipeline',
    commitSha: 'abc123f',
    changeLog: 'Fix: connection pool timeout handling'
  },
  {
    id: 'deploy-002',
    service: 'user-service',
    version: '2.3.1',
    status: 'completed',
    deployedAt: new Date(Date.now() - 21600000).toISOString(),
    deployedBy: 'ci-pipeline',
    commitSha: 'def456a',
    changeLog: 'Feature: Add session management improvements'
  },
  {
    id: 'deploy-003',
    service: 'api-gateway',
    version: '1.8.0',
    status: 'completed',
    deployedAt: new Date(Date.now() - 43200000).toISOString(),
    deployedBy: 'ci-pipeline',
    commitSha: 'ghi789b',
    changeLog: 'Update: Rate limiting configuration'
  },
  {
    id: 'deploy-004',
    service: 'inventory-service',
    version: '3.1.0',
    status: 'rolling_back',
    deployedAt: new Date(Date.now() - 3600000).toISOString(),
    deployedBy: 'ci-pipeline',
    commitSha: 'jkl012c',
    changeLog: 'Feature: New inventory sync mechanism'
  }
];

module.exports = {
  agentState,
  incidents,
  runbooks,
  executions,
  escalationPolicies,
  knowledgeBase,
  serviceDependencies,
  communications,
  deployments
};

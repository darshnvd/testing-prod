const express = require('express');
const router = express.Router();
const { incidents, deployments, serviceDependencies } = require('../data/store');

/**
 * Get all known services from the union of incidents, deployments, and serviceDependencies.
 */
function getAllServiceNames() {
  const serviceSet = new Set();

  incidents.forEach(inc => serviceSet.add(inc.service));
  deployments.forEach(dep => serviceSet.add(dep.service));
  Object.keys(serviceDependencies).forEach(name => serviceSet.add(name));

  return Array.from(serviceSet).sort();
}

/**
 * Get active incidents for a service (status is 'active' or 'acknowledged').
 */
function getActiveIncidents(serviceName) {
  return incidents.filter(
    inc => inc.service === serviceName && (inc.status === 'active' || inc.status === 'acknowledged')
  );
}

/**
 * Compute health score (0-100) based on active incidents.
 * Deductions: critical: -40, high: -25, medium: -15, low: -5
 */
function computeHealthScore(activeIncidents) {
  const deductions = { critical: 40, high: 25, medium: 15, low: 5 };
  let score = 100;

  activeIncidents.forEach(inc => {
    score -= deductions[inc.severity] || 0;
  });

  return Math.max(0, Math.min(100, score));
}

/**
 * Derive status from health score.
 */
function getStatusFromScore(score) {
  if (score < 30) return 'critical';
  if (score < 70) return 'degraded';
  return 'healthy';
}

/**
 * Check if a service name exists in any data source.
 */
function serviceExists(serviceName) {
  const inIncidents = incidents.some(inc => inc.service === serviceName);
  const inDeployments = deployments.some(dep => dep.service === serviceName);
  const inDependencies = serviceName in serviceDependencies;
  return inIncidents || inDeployments || inDependencies;
}

// GET /api/v1/services - List all known services with health status
router.get('/', (req, res) => {
  const serviceNames = getAllServiceNames();

  const services = serviceNames.map(name => {
    const active = getActiveIncidents(name);
    const healthScore = computeHealthScore(active);
    return {
      name,
      status: getStatusFromScore(healthScore),
      activeIncidentCount: active.length,
      healthScore
    };
  });

  res.json({
    services,
    total: services.length
  });
});

// GET /api/v1/services/:name/health - Detailed health view for a service
router.get('/:name/health', (req, res) => {
  const { name } = req.params;

  if (!serviceExists(name)) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Service ${name} not found`
    });
  }

  const activeIncidents = getActiveIncidents(name);
  const healthScore = computeHealthScore(activeIncidents);
  const status = getStatusFromScore(healthScore);

  // Recent deployments (last 5)
  const recentDeployments = deployments
    .filter(dep => dep.service === name)
    .sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt))
    .slice(0, 5)
    .map(dep => ({
      id: dep.id,
      version: dep.version,
      status: dep.status,
      deployedAt: dep.deployedAt
    }));

  // Dependencies and dependents
  const depInfo = serviceDependencies[name];
  const dependencies = depInfo ? depInfo.dependencies : [];
  const dependents = depInfo ? depInfo.dependents : [];

  res.json({
    name,
    status,
    healthScore,
    activeIncidents: activeIncidents.map(inc => ({
      id: inc.id,
      title: inc.title,
      severity: inc.severity,
      status: inc.status
    })),
    recentDeployments,
    dependencies,
    dependents,
    lastChecked: new Date().toISOString()
  });
});

module.exports = router;

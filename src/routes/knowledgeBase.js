const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { knowledgeBase, serviceDependencies } = require('../data/store');

// POST /api/v1/knowledge-base/search - Semantic search across knowledge base
router.post('/search', (req, res) => {
  const { query, service, tags, limit } = req.body || {};

  if (!query) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required field: query'
    });
  }

  // Simulate semantic search with simple keyword matching
  const queryLower = query.toLowerCase();
  let results = knowledgeBase.filter(doc => {
    const contentMatch = doc.content.toLowerCase().includes(queryLower);
    const titleMatch = doc.title.toLowerCase().includes(queryLower);
    const tagMatch = doc.tags.some(t => t.toLowerCase().includes(queryLower));
    return contentMatch || titleMatch || tagMatch;
  });

  if (service) {
    results = results.filter(doc => doc.service === service || doc.service === 'all');
  }

  if (tags && Array.isArray(tags)) {
    results = results.filter(doc => tags.some(t => doc.tags.includes(t)));
  }

  const maxResults = limit ? parseInt(limit, 10) : 10;
  results = results.slice(0, maxResults);

  // Add relevance scores
  const scoredResults = results.map(doc => ({
    ...doc,
    relevanceScore: calculateRelevance(query, doc)
  }));

  scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  res.json({
    query,
    results: scoredResults,
    total: scoredResults.length
  });
});

// POST /api/v1/knowledge-base/documents - Ingest a document
router.post('/documents', (req, res) => {
  const { title, service, content, tags } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required fields: title, content'
    });
  }

  const document = {
    id: `kb-${uuidv4().slice(0, 8)}`,
    title,
    service: service || 'general',
    content,
    tags: tags || [],
    dependencies: [],
    createdAt: new Date().toISOString()
  };

  knowledgeBase.push(document);

  res.status(201).json({
    message: 'Document ingested successfully',
    document
  });
});

// GET /api/v1/knowledge-base/services/:service_name/dependencies - Get service dependency map
router.get('/services/:service_name/dependencies', (req, res) => {
  const serviceName = req.params.service_name;
  const deps = serviceDependencies[serviceName];

  if (!deps) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Service dependency map for '${serviceName}' not found. Available services: ${Object.keys(serviceDependencies).join(', ')}`
    });
  }

  res.json(deps);
});

function calculateRelevance(query, doc) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  let score = 0;

  queryTerms.forEach(term => {
    if (doc.title.toLowerCase().includes(term)) score += 0.4;
    if (doc.content.toLowerCase().includes(term)) score += 0.3;
    if (doc.tags.some(t => t.includes(term))) score += 0.2;
    if (doc.service.toLowerCase().includes(term)) score += 0.1;
  });

  return Math.min(score, 1.0);
}

module.exports = router;

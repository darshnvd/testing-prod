const authenticate = (req, res, next) => {
  // Skip auth for health check endpoint
  if (req.path === '/api/v1/agent/health' && req.method === 'GET') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Bearer <token>'
    });
  }

  const token = authHeader.slice(7);
  const apiKey = process.env.API_KEY || 'oncall-agent-secret-key-2024';

  if (token !== apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};

module.exports = authenticate;

// Paths that do not require authentication
const AUTH_EXEMPT_PATHS = [
  { path: '/api/v1/agent/health', method: 'GET' }
];

function isAuthExempt(req) {
  return AUTH_EXEMPT_PATHS.some(
    exempt => req.path === exempt.path && req.method === exempt.method
  );
}

// Resolve the API key at module load time; fail fast if not configured
const apiKey = process.env.API_KEY;
if (!apiKey && process.env.NODE_ENV !== 'test') {
  throw new Error('API_KEY environment variable is required. Set it before starting the server.');
}

const authenticate = (req, res, next) => {
  // Skip auth for exempt endpoints
  if (isAuthExempt(req)) {
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
  const effectiveKey = process.env.API_KEY;

  if (!effectiveKey || token !== effectiveKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};

module.exports = authenticate;

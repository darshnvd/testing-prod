/**
 * Sliding window rate limiter middleware.
 * Tracks request counts per API key using an in-memory store.
 */

// In-memory store: Map<apiKey, Array<timestamp>>
const clientRequests = new Map();

/**
 * Creates a rate limiter middleware with configurable options.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.maxRequests - Maximum requests allowed per window (default: 100)
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 100;

  return (req, res, next) => {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no valid auth header, let the request pass through
      // (auth middleware will handle rejection)
      return next();
    }

    const apiKey = authHeader.slice(7);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create the request log for this client
    if (!clientRequests.has(apiKey)) {
      clientRequests.set(apiKey, []);
    }

    const requests = clientRequests.get(apiKey);

    // Remove timestamps outside the current window (sliding window)
    while (requests.length > 0 && requests[0] <= windowStart) {
      requests.shift();
    }

    // Calculate reset time (end of current window from the oldest request, or from now)
    const resetTime = requests.length > 0
      ? requests[0] + windowMs
      : now + windowMs;

    // Check if limit is exceeded
    if (requests.length >= maxRequests) {
      const remaining = 0;

      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((resetTime - now) / 1000)
      });
    }

    // Record this request
    requests.push(now);

    const remaining = maxRequests - requests.length;

    // Add rate limit headers to the response
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    next();
  };
}

/**
 * Resets the rate limiter state. Useful for testing.
 */
function resetRateLimiterState() {
  clientRequests.clear();
}

module.exports = { createRateLimiter, resetRateLimiterState };

const cacheControlNoStore = 'no-store, no-cache, must-revalidate, private';
const cspDirectives = [
  "default-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "upgrade-insecure-requests"
].join('; ');

export default function security(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Content-Security-Policy', cspDirectives);
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-API-Version', '2.3.0');
  res.setHeader('X-Request-Id', req.requestId || 'unknown');

  res.setHeader('Cache-Control', cacheControlNoStore);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
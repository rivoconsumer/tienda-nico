import { config } from './config.js';

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

/** Límite simple de pedidos por IP (en memoria). */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, hit] of hits) if (hit.reset < now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip || 'desconocida';
    const now = Date.now();
    let hit = hits.get(key);
    if (!hit || hit.reset < now) {
      hit = { count: 0, reset: now + windowMs };
      hits.set(key, hit);
    }
    hit.count += 1;
    if (hit.count > max) {
      res.set('Retry-After', String(Math.ceil((hit.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' });
    }
    next();
  };
}

/** Dirección pública de la tienda (para los links de Mercado Pago). */
export function baseUrl(req) {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}

export function isSecure(req) {
  return req.secure || (config.isProduction && config.publicUrl.startsWith('https://'));
}

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** JSON seguro para incrustar dentro de una etiqueta <script>. */
export const safeJson = (data) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  });
  if (isSecure(req)) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
}

// Sesión del panel: una cookie firmada (HMAC) que vence a los 7 días.
// Si cambiás la contraseña, todas las sesiones abiertas se cierran solas.
import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'tienda_admin';
const COOKIE_PATH = '/api/admin';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const passwordHash = crypto.createHash('sha256').update(config.admin.password).digest();

const sign = (payload) =>
  crypto.createHmac('sha256', config.admin.sessionSecret).update(payload).update(passwordHash).digest('base64url');

const sameText = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function checkPassword(input) {
  const attempt = crypto.createHash('sha256').update(String(input ?? '')).digest();
  return crypto.timingSafeEqual(attempt, passwordHash);
}

export function startSession(res, secure) {
  const expires = String(Date.now() + MAX_AGE_MS);
  res.cookie(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: MAX_AGE_MS,
    path: COOKIE_PATH,
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE, { path: COOKIE_PATH });
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function isAdmin(req) {
  const value = readCookie(req, COOKIE);
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameText(sign(expires), signature);
}

export function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Tu sesión venció. Volvé a ingresar.' });
  // Encabezado propio en las acciones que modifican datos: evita envíos desde otros sitios.
  if (!['GET', 'HEAD'].includes(req.method) && req.get('x-admin') !== '1') {
    return res.status(403).json({ error: 'Solicitud no permitida.' });
  }
  next();
}

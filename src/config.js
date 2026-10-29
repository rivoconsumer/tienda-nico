import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');

// Carga el archivo .env si existe (Node 22+ lo trae incorporado).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // Sin .env: se usan las variables del sistema o los valores por defecto.
}

const env = (name, fallback = '') => (process.env[name] ?? fallback).toString().trim();

function friendlyPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}

const adminPassword = env('ADMIN_PASSWORD');
const publicUrl = env('PUBLIC_URL').replace(/\/+$/, '');
const trustProxy = env('TRUST_PROXY');

export const config = {
  port: Number(env('PORT', '3000')) || 3000,
  publicUrl,
  dataDir: path.resolve(ROOT, env('DATA_DIR', 'data')),
  isProduction: env('NODE_ENV') === 'production',
  trustProxy: trustProxy === '' ? false : Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
  timezone: env('STORE_TIMEZONE', 'America/Argentina/Buenos_Aires'),
  currency: env('CURRENCY', 'ARS'),

  admin: {
    password: adminPassword || friendlyPassword(),
    temporary: !adminPassword,
    sessionSecret: env('SESSION_SECRET') || randomBytes(32).toString('hex'),
  },

  mp: {
    accessToken: env('MP_ACCESS_TOKEN'),
    webhookSecret: env('MP_WEBHOOK_SECRET'),
    statementDescriptor: env('MP_STATEMENT_DESCRIPTOR'),
    maxInstallments: Number(env('MP_MAX_INSTALLMENTS', '0')) || 0,
    // Solo para pruebas automáticas: permite apuntar a un simulador local.
    apiBase: env('MP_API_BASE', 'https://api.mercadopago.com').replace(/\/+$/, ''),
  },
};

export const paths = {
  public: path.join(ROOT, 'public'),
  uploads: path.join(config.dataDir, 'uploads'),
  database: path.join(config.dataDir, 'tienda.db'),
};

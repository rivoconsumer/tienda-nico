// Herramientas para las pruebas: levanta la tienda con una base de datos temporal
// y un simulador de la API de Mercado Pago.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Simulador mínimo de la API de Mercado Pago. */
export async function startMercadoPagoMock() {
  const state = { preferences: [], payments: new Map(), failPreferences: false, requests: [] };
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, 'http://mock');
    state.requests.push({ method: req.method, path: url.pathname, auth: req.headers.authorization });
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
      if (state.failPreferences) return send(500, { message: 'internal_error' });
      const pref = JSON.parse(body);
      const id = `pref-${state.preferences.length + 1}`;
      state.preferences.push({ id, body: pref });
      return send(201, { id, init_point: `https://mp.test/checkout?pref=${id}`, sandbox_init_point: `https://sandbox.mp.test/checkout?pref=${id}` });
    }
    const paymentMatch = url.pathname.match(/^\/v1\/payments\/(\d+)$/);
    if (req.method === 'GET' && paymentMatch) {
      const payment = state.payments.get(paymentMatch[1]);
      return payment ? send(200, payment) : send(404, { message: 'Payment not found' });
    }
    if (req.method === 'GET' && url.pathname === '/v1/payments/search') {
      const ref = url.searchParams.get('external_reference');
      return send(200, { results: [...state.payments.values()].filter((p) => p.external_reference === ref) });
    }
    send(404, { message: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { url: `http://localhost:${server.address().port}`, state, close: () => server.close() };
}

/** Arranca la tienda en un puerto libre con su propia carpeta de datos. */
export async function startStore(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-test-'));
  const port = 4000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
    cwd: ROOT,
    // TRUST_PROXY permite simular clientes con distintas IP (X-Forwarded-For) para los límites por IP.
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: 'clave-de-prueba', NODE_ENV: 'test', TRUST_PROXY: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${base}/api/config`);
      if (res.ok) break;
    } catch {
      /* todavía arrancando */
    }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error(`La tienda no arrancó:\n${output}`);
  }
  return {
    base,
    dataDir,
    output: () => output,
    async stop() {
      child.kill();
      await new Promise((r) => child.once('exit', r));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`;

/**
 * Cliente HTTP con cookies, para la API pública y la del panel.
 * Por defecto cada pedido sale de una IP distinta; con { ip } se fija una.
 */
export function client(base, { ip } = {}) {
  let cookie = '';
  async function request(method, url, body, { admin = false, raw, headers = {} } = {}) {
    const h = { 'X-Forwarded-For': ip ?? randomIp(), ...headers };
    if (cookie) h.Cookie = cookie;
    if (admin) h['X-Admin'] = '1';
    let payload;
    if (raw) {
      payload = raw.data;
      h['Content-Type'] = raw.type;
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      h['Content-Type'] = 'application/json';
    }
    const res = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: (url, opts) => request('GET', url, undefined, opts),
    post: (url, body, opts) => request('POST', url, body, opts),
    put: (url, body, opts) => request('PUT', url, body, opts),
    patch: (url, body, opts) => request('PATCH', url, body, opts),
    del: (url, opts) => request('DELETE', url, undefined, opts),
    async login(password = 'clave-de-prueba') {
      return request('POST', '/api/admin/login', { password });
    },
  };
}

export const customer = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '11 5555-1234',
  dni: '30111222',
};

export const address = {
  method: 'envio',
  street: 'Av. Corrientes',
  number: '1234',
  city: 'CABA',
  province: 'Ciudad Autónoma de Buenos Aires',
  zip: 'C1043AAZ',
};

/** Firma un webhook igual que Mercado Pago (x-signature). */
export function signWebhook(secret, dataId, requestId = crypto.randomUUID()) {
  const ts = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

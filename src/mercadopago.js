// Integración con Mercado Pago (Checkout Pro).
// Flujo: se crea una "preferencia" con los productos del pedido, el cliente paga
// en Mercado Pago y vuelve a la tienda. Mercado Pago además avisa por webhook,
// y en ambos casos se consulta el pago a la API antes de marcar el pedido como pagado.
import crypto from 'node:crypto';
import { config } from './config.js';

export const mpConfigured = () => Boolean(config.mp.accessToken);

/** 'demo' (sin credenciales), 'test' (credenciales de prueba) o 'live'. */
export function mpMode() {
  if (!config.mp.accessToken) return 'demo';
  return config.mp.accessToken.startsWith('TEST-') ? 'test' : 'live';
}

async function mpFetch(pathname, { method = 'GET', body, idempotencyKey } = {}) {
  const res = await fetch(config.mp.apiBase + pathname, {
    method,
    headers: {
      Authorization: `Bearer ${config.mp.accessToken}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const error = new Error(`Mercado Pago respondió ${res.status}: ${data?.message || data?.error || 'error desconocido'}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { name: parts[0], surname: parts.slice(1).join(' ') || undefined };
}

/**
 * Crea la preferencia de pago para un pedido.
 * @returns {Promise<{id: string, url: string}>}
 */
export async function createPreference(order, baseUrl) {
  const https = baseUrl.startsWith('https://');
  const orderUrl = `${baseUrl}/pedido/${order.token}`;

  const items = order.items.map((item) => ({
    id: String(item.product_id ?? item.id),
    title: item.color ? `${item.name} (${item.color})` : item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    currency_id: config.currency,
    category_id: 'fashion',
    ...(https && item.image_url?.startsWith('/') ? { picture_url: baseUrl + item.image_url } : {}),
  }));
  if (order.shipping > 0) {
    items.push({ id: 'envio', title: 'Envío a domicilio', quantity: 1, unit_price: order.shipping, currency_id: config.currency });
  }

  const payer = splitName(order.customer_name);
  // Con credenciales de prueba no se envía el email real: Mercado Pago exige usuarios de prueba.
  if (mpMode() === 'live') payer.email = order.customer_email;
  if (/^\d{7,9}$/.test(order.customer_dni || '')) payer.identification = { type: 'DNI', number: order.customer_dni };

  const body = {
    items,
    payer,
    external_reference: String(order.id),
    back_urls: {
      success: `${orderUrl}?mp=ok`,
      pending: `${orderUrl}?mp=pendiente`,
      failure: `${orderUrl}?mp=error`,
    },
    metadata: { order_id: order.id },
  };
  // Mercado Pago solo puede volver y avisar a direcciones públicas con https.
  if (https) {
    body.auto_return = 'approved';
    body.notification_url = `${baseUrl}/api/webhooks/mercadopago?source_news=webhooks`;
  }
  if (config.mp.statementDescriptor) body.statement_descriptor = config.mp.statementDescriptor;
  if (config.mp.maxInstallments > 0) body.payment_methods = { installments: config.mp.maxInstallments };

  const preference = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body,
    idempotencyKey: `pref-${order.token}-${Date.now()}`,
  });
  const url = mpMode() === 'test' && preference.sandbox_init_point ? preference.sandbox_init_point : preference.init_point;
  if (!url) throw new Error('Mercado Pago no devolvió el link de pago.');
  return { id: preference.id, url };
}

export function getPayment(id) {
  if (!/^\d+$/.test(String(id))) throw new Error('ID de pago inválido');
  return mpFetch(`/v1/payments/${id}`);
}

export async function searchPaymentsByOrder(orderId) {
  const data = await mpFetch(
    `/v1/payments/search?external_reference=${encodeURIComponent(String(orderId))}&sort=date_created&criteria=desc&limit=20`,
  );
  return data?.results || [];
}

/**
 * Valida la firma x-signature de los webhooks.
 * Plantilla oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
 */
export function verifyWebhookSignature({ signature, requestId, dataId }) {
  if (!config.mp.webhookSecret) return { checked: false };
  if (!signature) return { checked: true, provided: false, valid: false };
  const parts = {};
  for (const piece of signature.split(',')) {
    const [key, value] = piece.split('=').map((s) => s?.trim());
    if (key && value) parts[key] = value;
  }
  if (!parts.ts || !parts.v1) return { checked: true, provided: true, valid: false };

  let manifest = '';
  if (dataId) {
    const id = String(dataId);
    manifest += `id:${/^[a-z0-9]+$/i.test(id) ? id.toLowerCase() : id};`;
  }
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;

  const expected = crypto.createHmac('sha256', config.mp.webhookSecret).update(manifest).digest('hex');
  const valid =
    expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  return { checked: true, provided: true, valid };
}

const PAYMENT_TYPES = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  account_money: 'Dinero en cuenta',
  ticket: 'Efectivo',
  bank_transfer: 'Transferencia',
  digital_currency: 'Cuotas sin tarjeta',
  digital_wallet: 'Billetera digital',
};

/** Texto corto para el panel, por ejemplo "Tarjeta de crédito VISA ···· 4242 · 3 cuotas". */
export function describePayment(p) {
  const type = PAYMENT_TYPES[p.payment_type_id] || p.payment_type_id || 'Mercado Pago';
  const method = p.payment_method_id && !['account_money'].includes(p.payment_method_id) ? ` ${p.payment_method_id.toUpperCase()}` : '';
  const last4 = p.card?.last_four_digits ? ` ···· ${p.card.last_four_digits}` : '';
  const installments = p.installments > 1 ? ` · ${p.installments} cuotas` : '';
  return `${type}${method}${last4}${installments}`;
}

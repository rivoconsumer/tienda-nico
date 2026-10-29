import crypto from 'node:crypto';
import express from 'express';
import { db } from '../db.js';
import { baseUrl, rateLimit } from '../http.js';
import { publicConfig } from '../settings.js';
import { listPublicProducts, getPublicProduct } from '../products.js';
import {
  createOrder, getOrderByToken, orderPublicView, applyMpPayment, setStatus, addEvent,
  updatePaymentInfo, checkStockForOrder,
} from '../orders.js';
import { mpConfigured, createPreference, getPayment } from '../mercadopago.js';

export const publicRouter = express.Router();

const orderLimiter = rateLimit({ windowMs: 10 * 60_000, max: 20, message: 'Hiciste muchos pedidos seguidos. Esperá unos minutos.' });
const payLimiter = rateLimit({ windowMs: 10 * 60_000, max: 30 });
const lookupLimiter = rateLimit({ windowMs: 10 * 60_000, max: 30 });

publicRouter.get('/config', (req, res) => res.json(publicConfig()));

publicRouter.get('/products', (req, res) => res.json(listPublicProducts()));

publicRouter.get('/products/:slug', (req, res) => {
  const product = getPublicProduct(req.params.slug);
  if (!product) return res.status(404).json({ error: 'No encontramos ese producto.' });
  res.json(product);
});

async function startMercadoPago(order, req) {
  try {
    const preference = await createPreference(order, baseUrl(req));
    updatePaymentInfo(order.id, { preferenceId: preference.id });
    return preference.url;
  } catch (error) {
    console.error(`[mercadopago] No se pudo crear el pago del pedido #${order.id}:`, error.message, error.data ?? '');
    addEvent(order.id, 'alerta', `No se pudo iniciar el pago en Mercado Pago (${error.message}).`);
    return null;
  }
}

publicRouter.post('/orders', orderLimiter, async (req, res) => {
  const order = createOrder(req.body);
  let redirect = `/pedido/${order.token}`;
  if (order.payment_method === 'mercadopago') {
    if (mpConfigured()) {
      const url = await startMercadoPago(order, req);
      redirect = url ?? `/pedido/${order.token}?mp=no-disponible`;
    } else {
      redirect = `/pago-demo/${order.token}`;
    }
  }
  console.log(`[pedido] #${order.id} creado · ${order.payment_method} · $${order.total}`);
  res.status(201).json({ number: order.id, token: order.token, redirect });
});

publicRouter.get('/orders/:token', async (req, res) => {
  let order = getOrderByToken(req.params.token);
  if (!order) return res.status(404).json({ error: 'No encontramos ese pedido.' });

  // Al volver de Mercado Pago llega el ID del pago: se consulta para no depender solo del webhook.
  const paymentId = String(req.query.payment_id || req.query.collection_id || '');
  if (paymentId && /^\d+$/.test(paymentId) && mpConfigured() && order.status === 'pendiente') {
    try {
      const payment = await getPayment(paymentId);
      if (String(payment.external_reference) === String(order.id)) {
        applyMpPayment(payment);
        order = getOrderByToken(req.params.token);
      }
    } catch (error) {
      console.warn(`[mercadopago] No se pudo verificar el pago ${paymentId}:`, error.message);
    }
  }
  res.json(orderPublicView(order));
});

publicRouter.post('/orders/:token/pay', payLimiter, async (req, res) => {
  const order = getOrderByToken(req.params.token);
  if (!order) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  if (order.payment_method !== 'mercadopago' || order.status !== 'pendiente') {
    return res.status(409).json({ error: 'Este pedido no tiene pagos pendientes.' });
  }
  const stockProblem = checkStockForOrder(order);
  if (stockProblem) return res.status(409).json({ error: stockProblem });
  if (!mpConfigured()) return res.json({ redirect: `/pago-demo/${order.token}` });

  const url = await startMercadoPago(order, req);
  if (!url) return res.status(502).json({ error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.' });
  res.json({ redirect: url });
});

publicRouter.post('/orders/lookup', lookupLimiter, (req, res) => {
  const number = Number(String(req.body?.number ?? '').replace(/\D/g, ''));
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const row = number && email ? db.prepare('SELECT token FROM orders WHERE id = ? AND customer_email = ?').get(number, email) : null;
  if (!row) return res.status(404).json({ error: 'No encontramos un pedido con esos datos. Revisá el número y el email.' });
  res.json({ token: row.token });
});

// Botón de arrepentimiento (Resolución 424/2020): registra la solicitud y devuelve un código de trámite.
publicRouter.post('/orders/arrepentimiento', lookupLimiter, (req, res) => {
  const number = Number(String(req.body?.number ?? '').replace(/\D/g, ''));
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().replace(/\s+/g, ' ').slice(0, 500) : '';
  const row = number && email ? db.prepare('SELECT id FROM orders WHERE id = ? AND customer_email = ?').get(number, email) : null;
  if (!row) return res.status(404).json({ error: 'No encontramos un pedido con esos datos. Revisá el número y el email.' });
  const code = `ARR-${row.id}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  addEvent(row.id, 'arrepentimiento', `Botón de arrepentimiento: el cliente pidió revocar la compra (trámite ${code}).${reason ? ` Comentario: ${reason}` : ''}`);
  console.log(`[pedido] #${row.id} · solicitud de arrepentimiento ${code}`);
  res.status(201).json({ code });
});

// Modo demo (sin credenciales de Mercado Pago): permite simular el pago.
publicRouter.post('/demo/orders/:token/pay', (req, res) => {
  if (mpConfigured()) return res.status(404).json({ error: 'No disponible.' });
  const order = getOrderByToken(req.params.token);
  if (!order) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  if (order.payment_method !== 'mercadopago' || order.status !== 'pendiente') {
    return res.status(409).json({ error: 'Este pedido no tiene pagos pendientes.' });
  }
  const approved = req.body?.approved === true;
  const paymentId = `DEMO-${Date.now().toString().slice(-6)}`;
  updatePaymentInfo(order.id, {
    paymentId,
    paymentStatus: approved ? 'approved' : 'rejected',
    paymentDetail: 'Pago simulado (modo demo)',
  });
  if (approved) {
    setStatus(order.id, 'pagado', { note: 'Pago aprobado (simulado en modo demo)', kind: 'pago' });
  } else {
    addEvent(order.id, 'pago', 'Pago rechazado (simulado en modo demo)');
  }
  res.json({ redirect: `/pedido/${order.token}?mp=${approved ? 'ok' : 'error'}` });
});

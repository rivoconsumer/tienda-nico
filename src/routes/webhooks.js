import express from 'express';
import { rateLimit } from '../http.js';
import { applyMpPayment } from '../orders.js';
import { mpConfigured, getPayment, verifyWebhookSignature } from '../mercadopago.js';

export const webhookRouter = express.Router();

const limiter = rateLimit({ windowMs: 60_000, max: 120 });

// Mercado Pago avisa acá cada vez que un pago cambia de estado.
// Nunca se confía en el contenido del aviso: se consulta el pago a la API con el Access Token.
webhookRouter.post('/mercadopago', limiter, express.json({ limit: '100kb' }), async (req, res) => {
  if (!mpConfigured()) return res.sendStatus(200);

  const type = req.query.type || req.query.topic || req.body?.type || req.body?.topic;
  const queryDataId = req.query['data.id'];
  const dataId = String(queryDataId || req.body?.data?.id || req.query.id || '');

  const signature = verifyWebhookSignature({
    signature: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId: queryDataId || req.body?.data?.id,
  });
  if (signature.checked && signature.provided && !signature.valid) {
    console.warn('[webhook] Firma inválida: se descarta el aviso.');
    return res.sendStatus(401);
  }

  if (type !== 'payment' || !/^\d+$/.test(dataId)) return res.sendStatus(200);

  try {
    const payment = await getPayment(dataId);
    const result = applyMpPayment(payment);
    console.log(`[webhook] Pago ${dataId} (${payment.status}) →`, result);
    res.sendStatus(200);
  } catch (error) {
    console.error(`[webhook] Error procesando el pago ${dataId}:`, error.message);
    // 500 hace que Mercado Pago reintente más tarde; si el pago no existe, no tiene sentido reintentar.
    res.sendStatus(error.status === 404 ? 200 : 500);
  }
});

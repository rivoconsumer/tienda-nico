import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { db, backupTo } from '../db.js';
import { config, paths } from '../config.js';
import { rateLimit, isSecure, ValidationError } from '../http.js';
import { checkPassword, startSession, endSession, isAdmin, requireAdmin } from '../auth.js';
import { getSettings, updateSettings, transferAvailable } from '../settings.js';
import { SAMPLE_PRODUCTS } from '../seed.js';
import { listAllProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../products.js';
import {
  STATUSES, STATUS_LABELS, getOrder, listOrders, orderAdminView, updateOrderAdmin, deleteOrder,
  dashboardStats, ordersForExport, applyMpPayment,
} from '../orders.js';
import { mpMode, mpConfigured, searchPaymentsByOrder } from '../mercadopago.js';

export const adminRouter = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, message: 'Demasiados intentos. Esperá 15 minutos.' });

adminRouter.post('/login', loginLimiter, (req, res) => {
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'La contraseña no es correcta.' });
  startSession(res, isSecure(req));
  res.json({ ok: true });
});

adminRouter.post('/logout', (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

adminRouter.get('/me', (req, res) => {
  res.json({
    authenticated: isAdmin(req),
    temporaryPassword: config.admin.temporary,
    storeName: getSettings().store_name,
    paymentMode: mpMode(),
  });
});

adminRouter.use(requireAdmin);

// ── Resumen ───────────────────────────────────────────────────
function setupChecklist() {
  const s = getSettings();
  const mode = mpMode();
  const sampleSlugs = SAMPLE_PRODUCTS.map((p) => p.slug);
  const samples = db
    .prepare(`SELECT COUNT(*) AS n FROM products WHERE slug IN (${sampleSlugs.map(() => '?').join(',')}) AND created_at = updated_at`)
    .get(...sampleSlugs).n;
  return [
    {
      id: 'mp',
      done: mode === 'live',
      title: mode === 'test' ? 'Mercado Pago está en modo prueba' : 'Conectá Mercado Pago',
      text:
        mode === 'test'
          ? 'Estás usando credenciales de prueba (TEST-). Cuando quieras cobrar de verdad, poné tu Access Token de producción en MP_ACCESS_TOKEN.'
          : 'Ahora los pagos se simulan (modo demo). Cargá tu Access Token en MP_ACCESS_TOKEN (archivo .env) y reiniciá la tienda.',
    },
    {
      id: 'url',
      done: mode === 'demo' || config.publicUrl.startsWith('https://'),
      title: 'Configurá la dirección pública',
      text: 'Completá PUBLIC_URL con la dirección https de tu tienda para que Mercado Pago avise los pagos automáticamente.',
    },
    {
      id: 'password',
      done: !config.admin.temporary,
      title: 'Fijá la contraseña del panel',
      text: 'Estás usando una contraseña temporal que cambia en cada reinicio. Definí ADMIN_PASSWORD en el archivo .env.',
    },
    {
      id: 'transfer',
      done: !s.transfer_enabled || transferAvailable(s),
      title: 'Completá los datos para transferencias',
      text: 'Cargá tu alias o CBU en Ajustes para ofrecer el pago por transferencia con descuento.',
      action: 'ajustes',
    },
    {
      id: 'contact',
      done: Boolean(s.contact_whatsapp || s.contact_email),
      title: 'Agregá tus datos de contacto',
      text: 'Con WhatsApp o email cargados, tus clientes pueden escribirte desde la tienda.',
      action: 'ajustes',
    },
    {
      id: 'fiscal',
      done: Boolean(s.data_fiscal_url),
      title: 'Agregá tu Data Fiscal',
      text: 'Pegá en Ajustes el link del QR de Data Fiscal de ARCA (ex AFIP). Es obligatorio para vender online en Argentina.',
      action: 'ajustes',
    },
    {
      id: 'products',
      done: samples === 0,
      title: 'Personalizá los productos de ejemplo',
      text: `Hay ${samples} ${samples === 1 ? 'producto' : 'productos'} de ejemplo sin editar. Cambiales fotos, precios y stock, o borralos.`,
      action: 'productos',
    },
  ];
}

adminRouter.get('/dashboard', (req, res) => {
  const recent = listOrders({ page: 1, pageSize: 6 }).orders;
  res.json({ stats: dashboardStats(), recent, checklist: setupChecklist(), paymentMode: mpMode() });
});

// ── Pedidos ───────────────────────────────────────────────────
adminRouter.get('/orders', (req, res) => {
  res.json(listOrders({ status: req.query.status, q: req.query.q, page: req.query.page, pageSize: req.query.pageSize }));
});

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

adminRouter.get('/orders.csv', (req, res) => {
  const orders = ordersForExport({ status: req.query.status, q: req.query.q });
  const dateFmt = new Intl.DateTimeFormat('es-AR', {
    timeZone: config.timezone, dateStyle: 'short', timeStyle: 'short',
  });
  const header = ['Pedido', 'Fecha', 'Estado', 'Cliente', 'Email', 'Teléfono', 'DNI', 'Entrega', 'Dirección',
    'Localidad', 'Provincia', 'CP', 'Pago', 'Detalle del pago', 'Productos', 'Subtotal', 'Descuento', 'Envío',
    'Total', 'Seguimiento', 'Notas del cliente'];
  const rows = orders.map((o) => [
    o.id,
    dateFmt.format(new Date(o.created_at)),
    STATUS_LABELS[o.status],
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.customer_dni,
    o.delivery_method === 'envio' ? 'Envío' : 'Retiro',
    [o.address_street, o.address_number, o.address_floor].filter(Boolean).join(' '),
    o.address_city,
    o.address_province,
    o.address_zip,
    o.payment_method === 'transferencia' ? 'Transferencia' : 'Mercado Pago',
    o.payment_detail,
    o.items.map((i) => `${i.quantity} × ${i.name}${i.color ? ` (${i.color})` : ''}`).join(' | '),
    o.subtotal, o.discount, o.shipping, o.total,
    o.tracking_code,
    o.notes,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => (typeof v === 'number' ? v : csvCell(v))).join(';')).join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="pedidos-${date}.csv"`,
  });
  res.send(`﻿${csv}`);
});

const orderIdParam = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

adminRouter.get('/orders/:id', (req, res) => {
  const order = getOrder(orderIdParam(req));
  if (!order) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  res.json(orderAdminView(order));
});

adminRouter.patch('/orders/:id', (req, res) => {
  const { status, trackingCode, adminNotes } = req.body ?? {};
  if (status !== undefined && !STATUSES.includes(status)) throw new ValidationError('Estado inválido.', 'status');
  const order = updateOrderAdmin(orderIdParam(req), { status, trackingCode, adminNotes });
  if (!order) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  res.json(orderAdminView(order));
});

adminRouter.delete('/orders/:id', (req, res) => {
  if (!deleteOrder(orderIdParam(req))) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  res.json({ ok: true });
});

// Consulta a Mercado Pago los pagos del pedido (por si se perdió algún aviso).
adminRouter.post('/orders/:id/sync', async (req, res) => {
  const id = orderIdParam(req);
  if (!getOrder(id)) return res.status(404).json({ error: 'No encontramos ese pedido.' });
  if (!mpConfigured()) return res.status(409).json({ error: 'Mercado Pago no está conectado (modo demo).' });
  const payments = await searchPaymentsByOrder(id);
  // Primero los más viejos, así el estado final refleja el pago más reciente.
  for (const payment of [...payments].reverse()) applyMpPayment(payment);
  res.json({ found: payments.length, order: orderAdminView(getOrder(id)) });
});

// ── Productos ─────────────────────────────────────────────────
adminRouter.get('/products', (req, res) => res.json(listAllProducts()));

adminRouter.post('/products', (req, res) => res.status(201).json(createProduct(req.body ?? {})));

adminRouter.put('/products/:id', (req, res) => {
  const product = updateProduct(orderIdParam(req), req.body ?? {});
  if (!product) return res.status(404).json({ error: 'No encontramos ese producto.' });
  res.json(product);
});

adminRouter.patch('/products/:id', (req, res) => {
  // Cambios rápidos desde la lista (stock, activo, destacado)
  const current = getProductById(orderIdParam(req));
  if (!current) return res.status(404).json({ error: 'No encontramos ese producto.' });
  const allowed = ['stock', 'active', 'featured', 'price'];
  const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
  res.json(updateProduct(current.id, { ...current, ...patch }));
});

adminRouter.delete('/products/:id', (req, res) => {
  if (!deleteProduct(orderIdParam(req))) return res.status(404).json({ error: 'No encontramos ese producto.' });
  res.json({ ok: true });
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

function detectImage(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length > 12 && buffer.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(buffer.toString('ascii', 8, 12))) return 'avif';
  return null;
}

adminRouter.post('/upload', express.raw({ type: IMAGE_TYPES, limit: '6mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError('Elegí una imagen JPG, PNG, WEBP o AVIF de hasta 6 MB.', 'image');
  }
  const extension = detectImage(req.body);
  if (!extension) throw new ValidationError('El archivo no parece ser una imagen válida.', 'image');
  const fileName = `${crypto.randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(paths.uploads, fileName), req.body);
  res.status(201).json({ url: `/uploads/${fileName}` });
});

// ── Ajustes ───────────────────────────────────────────────────
adminRouter.get('/settings', (req, res) => {
  res.json({
    settings: getSettings(),
    environment: {
      paymentMode: mpMode(),
      publicUrl: config.publicUrl,
      webhookUrl: config.publicUrl ? `${config.publicUrl}/api/webhooks/mercadopago` : null,
      webhookSecret: Boolean(config.mp.webhookSecret),
      temporaryPassword: config.admin.temporary,
    },
  });
});

adminRouter.put('/settings', (req, res) => {
  const result = updateSettings(req.body ?? {});
  if (!result.ok) return res.status(400).json({ error: result.error, field: result.field });
  res.json({ settings: result.settings });
});

// ── Copia de seguridad de la base de datos ────────────────────
adminRouter.get('/backup', (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  const tempFile = path.join(config.dataDir, `backup-${crypto.randomUUID()}.db`);
  backupTo(tempFile);
  res.download(tempFile, `tienda-${date}.db`, () => fs.rm(tempFile, { force: true }, () => {}));
});

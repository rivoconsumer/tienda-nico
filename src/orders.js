import crypto from 'node:crypto';
import { db, nowIso, transaction } from './db.js';
import { config } from './config.js';
import { ValidationError } from './http.js';
import { getSettings, transferAvailable } from './settings.js';
import { toProduct } from './products.js';
import { describePayment } from './mercadopago.js';

export const STATUSES = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
export const STATUS_LABELS = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  preparando: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
// Estados en los que el stock ya está descontado
const HOLDS_STOCK = new Set(['pagado', 'preparando', 'enviado', 'entregado']);

const PAYMENT_STATUS_TEXT = {
  pending: 'pendiente',
  in_process: 'en revisión',
  authorized: 'autorizado',
  rejected: 'rechazado',
  cancelled: 'cancelado',
  in_mediation: 'en mediación',
  approved: 'aprobado',
  refunded: 'devuelto',
  charged_back: 'con contracargo',
};

export const PROVINCES = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const line = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Misma cuenta que hace el checkout en el navegador. */
export function computeTotals({ subtotal, deliveryMethod, paymentMethod }, s = getSettings()) {
  const discount = paymentMethod === 'transferencia' ? Math.round((subtotal * s.transfer_discount) / 100) : 0;
  const freeShipping = s.free_shipping_from > 0 && subtotal >= s.free_shipping_from;
  const shipping = deliveryMethod === 'envio' && !freeShipping ? s.shipping_cost : 0;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}

export function addEvent(orderId, kind, message) {
  db.prepare('INSERT INTO order_events (order_id, kind, message) VALUES (?, ?, ?)').run(orderId, kind, message);
}

/** Crea un pedido. Los precios y el stock salen siempre de la base, nunca del navegador. */
export function createOrder(input) {
  const s = getSettings();
  const customer = input?.customer ?? {};
  const delivery = input?.delivery ?? {};

  const name = line(customer.name, 100);
  if (name.length < 3) throw new ValidationError('Ingresá tu nombre y apellido.', 'name');
  const email = line(customer.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError('Revisá tu email: parece que tiene un error.', 'email');
  const phone = line(customer.phone, 30);
  if (phone.replace(/\D/g, '').length < 8) throw new ValidationError('Ingresá un teléfono con código de área.', 'phone');
  const dni = line(customer.dni, 15).replace(/\D/g, '');
  if (dni && (dni.length < 7 || dni.length > 9)) throw new ValidationError('El DNI tiene que tener entre 7 y 9 números.', 'dni');

  const deliveryMethod = delivery.method;
  const deliveryOk =
    (deliveryMethod === 'envio' && s.shipping_enabled) || (deliveryMethod === 'retiro' && s.pickup_enabled);
  if (!deliveryOk) throw new ValidationError('Elegí cómo querés recibir tu pedido.', 'delivery');

  const address = { street: null, number: null, floor: null, city: null, province: null, zip: null };
  if (deliveryMethod === 'envio') {
    Object.assign(address, {
      street: line(delivery.street, 120),
      number: line(delivery.number, 20),
      floor: line(delivery.floor, 40) || null,
      city: line(delivery.city, 80),
      province: line(delivery.province, 60),
      zip: line(delivery.zip, 10).toUpperCase(),
    });
    if (!address.street) throw new ValidationError('Ingresá la calle.', 'street');
    if (!address.number) throw new ValidationError('Ingresá la altura (número de la calle).', 'number');
    if (!address.city) throw new ValidationError('Ingresá la localidad.', 'city');
    if (!PROVINCES.includes(address.province)) throw new ValidationError('Elegí la provincia.', 'province');
    if (!/^([A-Z]\d{4}[A-Z]{3}|\d{4})$/.test(address.zip)) {
      throw new ValidationError('Ingresá un código postal válido, por ejemplo 1414 o C1414ABC.', 'zip');
    }
  }

  const paymentMethod = input?.paymentMethod;
  if (paymentMethod === 'transferencia' && !transferAvailable(s)) {
    throw new ValidationError('El pago por transferencia no está disponible en este momento.', 'payment');
  }
  if (!['mercadopago', 'transferencia'].includes(paymentMethod)) {
    throw new ValidationError('Elegí un medio de pago.', 'payment');
  }
  const notes = typeof input?.notes === 'string' ? input.notes.trim().slice(0, 500) : '';

  // Productos: se agrupan las líneas repetidas y se valida todo contra la base.
  const rawItems = Array.isArray(input?.items) ? input.items : [];
  if (rawItems.length === 0) throw new ValidationError('Tu carrito está vacío.', 'items');
  if (rawItems.length > 50) throw new ValidationError('El carrito tiene demasiados productos.', 'items');
  const merged = new Map();
  for (const raw of rawItems) {
    const productId = Number(raw?.productId);
    const quantity = Number(raw?.quantity);
    const color = typeof raw?.color === 'string' ? raw.color.trim().slice(0, 40) : '';
    if (!Number.isInteger(productId) || productId <= 0) throw new ValidationError('Hay un producto inválido en el carrito.', 'items');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new ValidationError('Revisá las cantidades del carrito.', 'items');
    const key = `${productId}|${color}`;
    merged.set(key, { productId, color, quantity: (merged.get(key)?.quantity ?? 0) + quantity });
  }

  const findProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const lines = [];
  const unitsPerProduct = new Map();
  for (const item of merged.values()) {
    const row = findProduct.get(item.productId);
    if (!row) throw new ValidationError('Uno de los productos ya no está disponible. Revisá tu carrito.', 'items');
    const product = toProduct(row);
    let color = null;
    let colorHex = null;
    if (product.colors.length) {
      const match = product.colors.find((c) => c.name === item.color);
      if (!match) throw new ValidationError(`Elegí un color para ${product.name}.`, 'items');
      color = match.name;
      colorHex = match.hex;
    }
    unitsPerProduct.set(product.id, (unitsPerProduct.get(product.id) ?? 0) + item.quantity);
    lines.push({ product, color, colorHex, quantity: item.quantity });
  }
  for (const [productId, units] of unitsPerProduct) {
    const { product } = lines.find((l) => l.product.id === productId);
    if (units > product.stock) {
      throw new ValidationError(
        product.stock > 0
          ? `De ${product.name} quedan ${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}. Ajustá la cantidad.`
          : `${product.name} se quedó sin stock. Sacalo del carrito para seguir.`,
        'items',
      );
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const totals = computeTotals({ subtotal, deliveryMethod, paymentMethod }, s);
  const token = crypto.randomBytes(18).toString('base64url');

  const orderId = transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO orders (token, customer_name, customer_email, customer_phone, customer_dni, delivery_method,
        address_street, address_number, address_floor, address_city, address_province, address_zip, notes,
        payment_method, subtotal, discount, shipping, total)
      VALUES (@token, @name, @email, @phone, @dni, @deliveryMethod, @street, @number, @floor, @city, @province, @zip,
        @notes, @paymentMethod, @subtotal, @discount, @shipping, @total)
    `).run({ token, name, email, phone, dni: dni || null, deliveryMethod, ...address, notes: notes || null, paymentMethod, ...totals });

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, color, color_hex, illustration, image_url, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      insertItem.run(lastInsertRowid, l.product.id, l.product.name, l.color, l.colorHex, l.product.illustration,
        l.product.imageUrl, l.product.price, l.quantity);
    }
    addEvent(lastInsertRowid, 'creado', `Pedido creado · pago con ${paymentMethod === 'transferencia' ? 'transferencia' : 'Mercado Pago'}`);
    return Number(lastInsertRowid);
  })();

  return getOrder(orderId);
}

/** Pedido completo con sus productos y su historial. */
export function getOrder(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  order.events = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(id);
  return order;
}

export function getOrderByToken(token) {
  if (typeof token !== 'string' || !/^[\w-]{10,64}$/.test(token)) return null;
  const row = db.prepare('SELECT id FROM orders WHERE token = ?').get(token);
  return row ? getOrder(row.id) : null;
}

export function updatePaymentInfo(orderId, { paymentId, paymentStatus, paymentDetail, preferenceId }) {
  const fields = [];
  const params = { id: orderId, updated_at: nowIso() };
  if (paymentId !== undefined) { fields.push('payment_id = @paymentId'); params.paymentId = paymentId; }
  if (paymentStatus !== undefined) { fields.push('payment_status = @paymentStatus'); params.paymentStatus = paymentStatus; }
  if (paymentDetail !== undefined) { fields.push('payment_detail = @paymentDetail'); params.paymentDetail = paymentDetail; }
  if (preferenceId !== undefined) { fields.push('mp_preference_id = @preferenceId'); params.preferenceId = preferenceId; }
  if (!fields.length) return;
  db.prepare(`UPDATE orders SET ${fields.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(params);
}

/** Cambia el estado del pedido y ajusta el stock si corresponde. */
export function setStatus(orderId, nextStatus, { note, kind = 'estado' } = {}) {
  if (!STATUSES.includes(nextStatus)) throw new ValidationError('Estado inválido.', 'status');
  return transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return null;
    if (order.status === nextStatus) return order;

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const changeStock = db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?');
    let stockDeducted = order.stock_deducted;

    if (HOLDS_STOCK.has(nextStatus) && !stockDeducted) {
      for (const item of items) {
        if (!item.product_id) continue;
        const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id);
        if (!product) continue;
        if (product.stock < item.quantity) {
          addEvent(orderId, 'alerta', `Stock insuficiente de ${item.name}: quedaban ${product.stock} y este pedido lleva ${item.quantity}.`);
        }
        changeStock.run(-item.quantity, nowIso(), item.product_id);
      }
      stockDeducted = 1;
    } else if (!HOLDS_STOCK.has(nextStatus) && stockDeducted) {
      for (const item of items) if (item.product_id) changeStock.run(item.quantity, nowIso(), item.product_id);
      stockDeducted = 0;
    }

    const paidAt = nextStatus === 'pagado' && !order.paid_at ? nowIso() : order.paid_at;
    db.prepare('UPDATE orders SET status = ?, stock_deducted = ?, paid_at = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, stockDeducted, paidAt, nowIso(), orderId);
    addEvent(orderId, kind, note || `Estado: ${STATUS_LABELS[order.status]} → ${STATUS_LABELS[nextStatus]}`);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  })();
}

/** Aplica al pedido la información de un pago de Mercado Pago (consultado a la API). */
export function applyMpPayment(payment) {
  return transaction(() => applyMpPaymentUnsafe(payment))();
}

function applyMpPaymentUnsafe(payment) {
  const orderId = Number(payment?.external_reference);
  if (!Number.isInteger(orderId)) return { ignored: 'sin referencia de pedido' };
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { ignored: 'pedido inexistente' };

  const paymentId = String(payment.id);
  const status = payment.status;
  const detail = describePayment(payment);
  const statusText = PAYMENT_STATUS_TEXT[status] || status;

  if (status === 'approved') {
    const amount = Number(payment.transaction_amount);
    const currencyOk = !payment.currency_id || payment.currency_id === config.currency;
    if (!(amount + 0.5 >= order.total) || !currencyOk) {
      updatePaymentInfo(order.id, { paymentId, paymentStatus: status, paymentDetail: detail });
      addEvent(order.id, 'alerta', `Pago #${paymentId} aprobado por ${amount} ${payment.currency_id || ''}, pero el pedido es de ${order.total}. Revisalo en Mercado Pago.`);
      return { order: order.id, result: 'monto distinto' };
    }
    if (order.status === 'pendiente' || order.status === 'cancelado') {
      updatePaymentInfo(order.id, { paymentId, paymentStatus: status, paymentDetail: detail });
      if (order.status === 'cancelado') addEvent(order.id, 'alerta', 'Llegó un pago aprobado para un pedido cancelado. Se reactivó como pagado.');
      setStatus(order.id, 'pagado', { note: `Pago aprobado en Mercado Pago (#${paymentId}) · ${detail}`, kind: 'pago' });
      return { order: order.id, result: 'pagado' };
    }
    if (order.payment_id && order.payment_id !== paymentId) {
      const already = db.prepare("SELECT 1 FROM order_events WHERE order_id = ? AND message LIKE ?").get(order.id, `%#${paymentId}%`);
      if (!already) addEvent(order.id, 'alerta', `Llegó otro pago aprobado (#${paymentId}) para este pedido. Puede ser un pago duplicado: revisalo en Mercado Pago.`);
    }
    return { order: order.id, result: 'sin cambios' };
  }

  if (status === 'refunded' || status === 'charged_back') {
    if (order.payment_id === paymentId && order.status !== 'cancelado') {
      updatePaymentInfo(order.id, { paymentStatus: status });
      setStatus(order.id, 'cancelado', {
        note: status === 'refunded' ? `Pago #${paymentId} devuelto en Mercado Pago` : `Contracargo del pago #${paymentId}`,
        kind: 'pago',
      });
      return { order: order.id, result: 'cancelado' };
    }
    return { order: order.id, result: 'sin cambios' };
  }

  // Pendiente, en revisión, rechazado, cancelado, en mediación
  if (order.status === 'pendiente' && (order.payment_id !== paymentId || order.payment_status !== status)) {
    updatePaymentInfo(order.id, { paymentId, paymentStatus: status, paymentDetail: detail });
    addEvent(order.id, 'pago', `Pago ${statusText} en Mercado Pago (#${paymentId}) · ${detail}`);
    return { order: order.id, result: `pago ${statusText}` };
  }
  if (status === 'in_mediation' && order.payment_id === paymentId) {
    addEvent(order.id, 'alerta', 'El comprador abrió un reclamo en Mercado Pago por este pago.');
  }
  return { order: order.id, result: 'sin cambios' };
}

/** Revisa que siga habiendo stock antes de reintentar un pago. */
export function checkStockForOrder(order) {
  const units = new Map();
  for (const item of order.items) {
    if (!item.product_id) continue;
    units.set(item.product_id, (units.get(item.product_id) ?? 0) + item.quantity);
  }
  for (const [productId, qty] of units) {
    const product = db.prepare('SELECT name, stock, active FROM products WHERE id = ?').get(productId);
    if (!product || !product.active || product.stock < qty) {
      return `${product?.name ?? 'Un producto'} ya no tiene stock suficiente. Escribinos y lo resolvemos.`;
    }
  }
  return null;
}

const itemView = (item) => ({
  productId: item.product_id,
  name: item.name,
  color: item.color,
  colorHex: item.color_hex,
  illustration: item.illustration,
  imageUrl: item.image_url,
  unitPrice: item.unit_price,
  quantity: item.quantity,
});

/** Lo que ve el cliente en la página de su pedido. */
export function orderPublicView(order) {
  const s = getSettings();
  const isTransfer = order.payment_method === 'transferencia';
  return {
    number: order.id,
    token: order.token,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    createdAt: order.created_at,
    paidAt: order.paid_at,
    customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
    delivery: {
      method: order.delivery_method,
      street: order.address_street,
      number: order.address_number,
      floor: order.address_floor,
      city: order.address_city,
      province: order.address_province,
      zip: order.address_zip,
      pickupAddress: order.delivery_method === 'retiro' ? s.pickup_address : null,
      pickupHours: order.delivery_method === 'retiro' ? s.pickup_hours : null,
    },
    payment: { method: order.payment_method, status: order.payment_status, detail: order.payment_detail },
    items: order.items.map(itemView),
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total,
    notes: order.notes,
    trackingCode: order.tracking_code,
    canPay: order.payment_method === 'mercadopago' && order.status === 'pendiente',
    transfer: isTransfer
      ? { alias: s.transfer_alias, cbu: s.transfer_cbu, holder: s.transfer_holder, bank: s.transfer_bank, discount: s.transfer_discount }
      : null,
  };
}

/** Vista completa para el panel. */
export function orderAdminView(order) {
  return {
    ...orderPublicView(order),
    id: order.id,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      dni: order.customer_dni,
    },
    payment: {
      method: order.payment_method,
      status: order.payment_status,
      detail: order.payment_detail,
      id: order.payment_id,
      preferenceId: order.mp_preference_id,
    },
    adminNotes: order.admin_notes,
    stockDeducted: Boolean(order.stock_deducted),
    updatedAt: order.updated_at,
    events: (order.events ?? []).map((e) => ({ kind: e.kind, message: e.message, at: e.created_at })),
  };
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function buildFilter({ status, q } = {}) {
  const where = [];
  const params = {};
  if (status && STATUSES.includes(status)) {
    where.push('o.status = @status');
    params.status = status;
  }
  const query = typeof q === 'string' ? q.trim().slice(0, 80) : '';
  if (query) {
    const asNumber = Number(query.replace(/^#/, ''));
    const byNumber = Number.isInteger(asNumber) && asNumber > 0;
    params.q = `%${escapeLike(query)}%`;
    if (byNumber) params.id = asNumber;
    where.push(
      `(o.customer_name LIKE @q ESCAPE '\\' OR o.customer_email LIKE @q ESCAPE '\\' OR o.customer_phone LIKE @q ESCAPE '\\'${byNumber ? ' OR o.id = @id' : ''})`,
    );
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function listOrders({ status, q, page = 1, pageSize = 25 } = {}) {
  const filter = buildFilter({ status, q });
  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${filter.sql}`).get(filter.params).n;
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 200);
  const currentPage = Math.max(Number(page) || 1, 1);
  const rows = db.prepare(`
    SELECT o.*,
      (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS units,
      (SELECT GROUP_CONCAT(name || CASE WHEN quantity > 1 THEN ' ×' || quantity ELSE '' END, ', ') FROM order_items WHERE order_id = o.id) AS summary
      , EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.kind = 'arrepentimiento') AS regret
    FROM orders o ${filter.sql}
    ORDER BY o.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...filter.params, limit, offset: (currentPage - 1) * limit });

  const counts = Object.fromEntries(STATUSES.map((st) => [st, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all()) counts[row.status] = row.n;

  return {
    total,
    page: currentPage,
    pages: Math.max(Math.ceil(total / limit), 1),
    counts,
    orders: rows.map((o) => ({
      id: o.id,
      token: o.token,
      status: o.status,
      createdAt: o.created_at,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      deliveryMethod: o.delivery_method,
      city: o.address_city,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      total: o.total,
      units: o.units ?? 0,
      summary: o.summary ?? '',
      regret: Boolean(o.regret),
    })),
  };
}

/** Pedidos completos para exportar a CSV (hasta 5000, los más nuevos primero). */
export function ordersForExport({ status, q } = {}) {
  const filter = buildFilter({ status, q });
  return db
    .prepare(`SELECT o.id FROM orders o ${filter.sql} ORDER BY o.id DESC LIMIT 5000`)
    .all(filter.params)
    .map((row) => getOrder(row.id));
}

export function updateOrderAdmin(id, { status, trackingCode, adminNotes }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  transaction(() => {
    if (trackingCode !== undefined) {
      const code = String(trackingCode ?? '').trim().slice(0, 80) || null;
      if (code !== order.tracking_code) {
        db.prepare('UPDATE orders SET tracking_code = ?, updated_at = ? WHERE id = ?').run(code, nowIso(), id);
        addEvent(id, 'envio', code ? `Código de seguimiento: ${code}` : 'Se quitó el código de seguimiento');
      }
    }
    if (adminNotes !== undefined) {
      const notes = String(adminNotes ?? '').trim().slice(0, 2000) || null;
      db.prepare('UPDATE orders SET admin_notes = ?, updated_at = ? WHERE id = ?').run(notes, nowIso(), id);
    }
    if (status !== undefined && status !== order.status) {
      setStatus(id, status, { note: `Estado cambiado a "${STATUS_LABELS[status] ?? status}" desde el panel` });
    }
  })();
  return getOrder(id);
}

export function deleteOrder(id) {
  return transaction(() => {
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(id);
    if (!order) return false;
    if (HOLDS_STOCK.has(order.status)) setStatus(id, 'cancelado', { note: 'Pedido eliminado desde el panel' });
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return true;
  })();
}

/** Números para el resumen del panel. */
export function dashboardStats() {
  const tz = config.timezone;
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayKey = (date) => dayFmt.format(new Date(date));
  const today = dayKey(Date.now());
  const [y, m, d] = today.split('-').map(Number);

  const since = new Date(Date.now() - 70 * 86_400_000).toISOString();
  const paid = db.prepare(`
    SELECT total, paid_at FROM orders
    WHERE status IN ('pagado', 'preparando', 'enviado', 'entregado') AND paid_at >= ?
  `).all(since);

  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  const byDay = Object.fromEntries(days.map((k) => [k, { total: 0, orders: 0 }]));
  const monthKey = today.slice(0, 7);
  const prevMonthKey = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  let monthTotal = 0;
  let monthOrders = 0;
  let prevMonthTotal = 0;
  for (const row of paid) {
    const key = dayKey(row.paid_at);
    if (byDay[key]) {
      byDay[key].total += row.total;
      byDay[key].orders += 1;
    }
    if (key.startsWith(monthKey)) {
      monthTotal += row.total;
      monthOrders += 1;
    } else if (key.startsWith(prevMonthKey)) {
      prevMonthTotal += row.total;
    }
  }

  const count = (sql) => db.prepare(sql).get().n;
  return {
    month: {
      total: monthTotal,
      orders: monthOrders,
      average: monthOrders ? Math.round(monthTotal / monthOrders) : 0,
      previousTotal: prevMonthTotal,
    },
    pendingPayment: count("SELECT COUNT(*) AS n FROM orders WHERE status = 'pendiente'"),
    toShip: count("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pagado', 'preparando')"),
    totalOrders: count('SELECT COUNT(*) AS n FROM orders'),
    regretRequests: count(`SELECT COUNT(*) AS n FROM orders o WHERE o.status != 'cancelado'
      AND EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id AND e.kind = 'arrepentimiento')`),
    last14: days.map((k) => ({ date: k, ...byDay[k] })),
    lowStock: db
      .prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= 3 ORDER BY stock, name LIMIT 8')
      .all(),
  };
}

// Pruebas de la integración con Mercado Pago contra un simulador de su API.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStore, startMercadoPagoMock, client, customer, address, signWebhook } from './helpers.js';

const TOTE = 1; // $129.000 · stock 8
const LLAVERO = 11; // $9.500 · stock 40
const SECRET = 'secreto-de-webhooks';

let mp;
let store;
let api;
let admin;
let paymentSeq = 5000;

const newOrder = async (items = [{ productId: LLAVERO, quantity: 1, color: 'Rosa empolvado' }]) => {
  const res = await api.post('/api/orders', { customer, delivery: address, paymentMethod: 'mercadopago', items });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data;
};

const fakePayment = (orderNumber, total, overrides = {}) => {
  const payment = {
    id: ++paymentSeq,
    status: 'approved',
    external_reference: String(orderNumber),
    transaction_amount: total,
    currency_id: 'ARS',
    payment_type_id: 'credit_card',
    payment_method_id: 'visa',
    installments: 3,
    card: { last_four_digits: '4242' },
    ...overrides,
  };
  mp.state.payments.set(String(payment.id), payment);
  return payment;
};

const notify = (paymentId, { signed = true, secret = SECRET, type = 'payment' } = {}) =>
  api.post(`/api/webhooks/mercadopago?data.id=${paymentId}&type=${type}`, {
    action: 'payment.updated', type, data: { id: String(paymentId) },
  }, { headers: signed ? signWebhook(secret, String(paymentId)) : {} });

const adminOrder = async (number) => (await admin.get(`/api/admin/orders/${number}`)).data;
const stockOf = async (id) => (await admin.get('/api/admin/products')).data.find((p) => p.id === id).stock;

before(async () => {
  mp = await startMercadoPagoMock();
  store = await startStore({
    MP_ACCESS_TOKEN: 'TEST-123456',
    MP_WEBHOOK_SECRET: SECRET,
    MP_API_BASE: mp.url,
    PUBLIC_URL: 'https://tienda.test',
  });
  api = client(store.base);
  admin = client(store.base);
  assert.equal((await admin.login()).status, 200);
});

after(async () => {
  await store?.stop();
  mp?.close();
});

describe('Mercado Pago', () => {
  it('informa el modo prueba', async () => {
    assert.equal((await api.get('/api/config')).data.payments.mode, 'test');
  });

  it('crea la preferencia con precios del servidor y los links correctos', async () => {
    const order = await newOrder([
      { productId: TOTE, quantity: 1, color: 'Suela', price: 1 },
      { productId: LLAVERO, quantity: 1, color: 'Manteca' },
    ]);
    assert.match(order.redirect, /^https:\/\/sandbox\.mp\.test\//, 'con credenciales TEST- usa el checkout de prueba');
    const pref = mp.state.preferences.at(-1).body;
    assert.deepEqual(pref.items.map((i) => [i.title, i.unit_price, i.quantity]), [
      ['Tote Siena (Suela)', 129000, 1],
      ['Llavero Nudo (Manteca)', 9500, 1],
    ]);
    assert.ok(pref.items.every((i) => i.currency_id === 'ARS'));
    assert.equal(pref.external_reference, String(order.number));
    assert.equal(pref.back_urls.success, `https://tienda.test/pedido/${order.token}?mp=ok`);
    assert.equal(pref.auto_return, 'approved');
    assert.equal(pref.notification_url, 'https://tienda.test/api/webhooks/mercadopago?source_news=webhooks');
    assert.equal(pref.payer.email, undefined, 'en modo prueba no se manda el email real');
    assert.deepEqual(pref.payer.identification, { type: 'DNI', number: customer.dni });
    assert.equal(mp.state.requests.at(-1).auth, 'Bearer TEST-123456');
  });

  it('agrega el envío como un ítem cuando corresponde', async () => {
    await newOrder();
    const pref = mp.state.preferences.at(-1).body;
    assert.deepEqual(pref.items.at(-1), { id: 'envio', title: 'Envío a domicilio', quantity: 1, unit_price: 6500, currency_id: 'ARS' });
  });

  it('marca el pedido como pagado con un webhook firmado (una sola vez)', async () => {
    const before = await stockOf(TOTE);
    const order = await newOrder([{ productId: TOTE, quantity: 1, color: 'Negro' }]);
    const payment = fakePayment(order.number, 129000);
    const res = await notify(payment.id);
    assert.equal(res.status, 200);
    let detail = await adminOrder(order.number);
    assert.equal(detail.status, 'pagado');
    assert.equal(detail.payment.id, String(payment.id));
    assert.equal(detail.payment.detail, 'Tarjeta de crédito VISA ···· 4242 · 3 cuotas');
    assert.equal(await stockOf(TOTE), before - 1);

    const events = detail.events.length;
    assert.equal((await notify(payment.id)).status, 200);
    detail = await adminOrder(order.number);
    assert.equal(detail.events.length, events, 'un aviso repetido no duplica nada');
    assert.equal(await stockOf(TOTE), before - 1, 'ni descuenta stock dos veces');
  });

  it('rechaza webhooks con firma inválida', async () => {
    const order = await newOrder();
    const payment = fakePayment(order.number, 16000);
    const res = await notify(payment.id, { secret: 'otra-clave' });
    assert.equal(res.status, 401);
    assert.equal((await adminOrder(order.number)).status, 'pendiente');
  });

  it('ignora avisos de pagos inexistentes o de otro tipo', async () => {
    assert.equal((await notify(987654321)).status, 200);
    assert.equal((await notify(123, { type: 'merchant_order' })).status, 200);
  });

  it('confirma el pago al volver de Mercado Pago aunque no llegue el webhook', async () => {
    const order = await newOrder();
    const payment = fakePayment(order.number, 16000);
    const { data } = await api.get(`/api/orders/${order.token}?payment_id=${payment.id}`);
    assert.equal(data.status, 'pagado');
  });

  it('no acepta un pago que pertenece a otro pedido', async () => {
    const first = await newOrder();
    const second = await newOrder();
    const payment = fakePayment(first.number, 16000);
    const { data } = await api.get(`/api/orders/${second.token}?payment_id=${payment.id}`);
    assert.equal(data.status, 'pendiente');
  });

  it('no marca como pagado si el monto no coincide', async () => {
    const order = await newOrder();
    const payment = fakePayment(order.number, 100);
    await notify(payment.id);
    const detail = await adminOrder(order.number);
    assert.equal(detail.status, 'pendiente');
    assert.ok(detail.events.some((e) => e.kind === 'alerta' && e.message.includes(String(payment.id))));
  });

  it('registra el rechazo y permite reintentar con una preferencia nueva', async () => {
    const order = await newOrder();
    const payment = fakePayment(order.number, 16000, { status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' });
    await notify(payment.id);
    const view = (await api.get(`/api/orders/${order.token}`)).data;
    assert.equal(view.status, 'pendiente');
    assert.equal(view.payment.status, 'rejected');
    const count = mp.state.preferences.length;
    const retry = await api.post(`/api/orders/${order.token}/pay`);
    assert.equal(retry.status, 200);
    assert.match(retry.data.redirect, /^https:\/\/sandbox\.mp\.test\//);
    assert.equal(mp.state.preferences.length, count + 1);
  });

  it('cancela el pedido y devuelve el stock si el pago se reintegra', async () => {
    const before = await stockOf(LLAVERO);
    const order = await newOrder([{ productId: LLAVERO, quantity: 2, color: 'Salvia' }]);
    const payment = fakePayment(order.number, 25500);
    await notify(payment.id);
    assert.equal(await stockOf(LLAVERO), before - 2);
    mp.state.payments.set(String(payment.id), { ...payment, status: 'refunded' });
    await notify(payment.id);
    assert.equal((await adminOrder(order.number)).status, 'cancelado');
    assert.equal(await stockOf(LLAVERO), before);
  });

  it('sincroniza desde el panel buscando los pagos del pedido', async () => {
    const order = await newOrder();
    fakePayment(order.number, 16000);
    const res = await admin.post(`/api/admin/orders/${order.number}/sync`, undefined, { admin: true });
    assert.equal(res.status, 200);
    assert.equal(res.data.found, 1);
    assert.equal(res.data.order.status, 'pagado');
  });

  it('si Mercado Pago falla, el pedido queda reservado para pagar después', async () => {
    mp.state.failPreferences = true;
    try {
      const order = await newOrder();
      assert.equal(order.redirect, `/pedido/${order.token}?mp=no-disponible`);
      const detail = await adminOrder(order.number);
      assert.ok(detail.events.some((e) => e.kind === 'alerta'));
      const retry = await api.post(`/api/orders/${order.token}/pay`);
      assert.equal(retry.status, 502);
    } finally {
      mp.state.failPreferences = false;
    }
  });
});

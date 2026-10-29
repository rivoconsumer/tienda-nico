// Pruebas de la tienda en modo demo (sin credenciales de Mercado Pago).
// Correr con: npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStore, client, customer, address } from './helpers.js';

const TOTE = 1; // Tote Siena · $129.000 · stock 8
const LLAVERO = 11; // Llavero Nudo · $9.500 · stock 40
const CINTURON_FINO = 10; // sin stock

let store;
let api;
let admin;

const order = (overrides = {}) => ({
  customer,
  delivery: address,
  paymentMethod: 'mercadopago',
  items: [{ productId: LLAVERO, quantity: 1, color: 'Manteca' }],
  ...overrides,
});

async function stockOf(id) {
  const { data } = await admin.get('/api/admin/products');
  return data.find((p) => p.id === id).stock;
}

before(async () => {
  store = await startStore();
  api = client(store.base);
  admin = client(store.base);
  const login = await admin.login();
  assert.equal(login.status, 200);
});

after(async () => store?.stop());

describe('catálogo y páginas', () => {
  it('devuelve la configuración pública en modo demo', async () => {
    const { status, data } = await api.get('/api/config');
    assert.equal(status, 200);
    assert.equal(data.payments.mode, 'demo');
    assert.equal(data.transfer.enabled, false, 'sin alias ni CBU no se ofrece transferencia');
    assert.equal(data.shipping.cost, 6500);
  });

  it('lista los productos de ejemplo sin datos internos', async () => {
    const { data } = await api.get('/api/products');
    assert.equal(data.length, 12);
    assert.ok(data.every((p) => !('active' in p) && !('sort' in p)));
    const tote = data.find((p) => p.id === TOTE);
    assert.equal(tote.slug, 'tote-siena');
    assert.deepEqual(tote.colors.map((c) => c.name), ['Manteca', 'Suela', 'Negro']);
  });

  it('muestra un producto por su dirección y 404 si no existe', async () => {
    assert.equal((await api.get('/api/products/tote-siena')).status, 200);
    assert.equal((await api.get('/api/products/no-existe')).status, 404);
  });

  it('sirve las páginas con título propio y estado 404 cuando corresponde', async () => {
    const home = await api.get('/');
    assert.equal(home.status, 200);
    const html = home.data.toString();
    assert.match(html, /<script id="bootstrap" type="application\/json">\{/);
    assert.ok(!html.includes('{{'), 'no quedan marcadores sin reemplazar');
    const product = (await api.get('/producto/tote-siena')).data.toString();
    assert.match(product, /<title>Tote Siena · Tienda Moon<\/title>/);
    assert.equal((await api.get('/una-pagina-que-no-existe')).status, 404);
    assert.equal((await api.get('/producto/no-existe')).status, 404);
    assert.equal((await api.get('/archivo-inexistente.js')).status, 404);
    assert.equal((await api.get('/js/app.js')).status, 200);
    assert.equal((await api.get('/admin')).status, 200);
  });

  it('envía encabezados de seguridad', async () => {
    const { headers } = await api.get('/');
    assert.match(headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(headers.get('x-powered-by'), null);
  });
});

describe('validación de pedidos', () => {
  const cases = [
    ['carrito vacío', { items: [] }, 'items'],
    ['email inválido', { customer: { ...customer, email: 'ana@' } }, 'email'],
    ['teléfono corto', { customer: { ...customer, phone: '123' } }, 'phone'],
    ['sin calle', { delivery: { ...address, street: '' } }, 'street'],
    ['provincia inexistente', { delivery: { ...address, province: 'Narnia' } }, 'province'],
    ['código postal inválido', { delivery: { ...address, zip: '12' } }, 'zip'],
    ['color que no existe', { items: [{ productId: LLAVERO, quantity: 1, color: 'Fucsia' }] }, 'items'],
    ['producto inexistente', { items: [{ productId: 999, quantity: 1 }] }, 'items'],
    ['cantidad inválida', { items: [{ productId: LLAVERO, quantity: 0, color: 'Manteca' }] }, 'items'],
    ['medio de pago desconocido', { paymentMethod: 'bitcoin' }, 'payment'],
    ['transferencia sin datos bancarios', { paymentMethod: 'transferencia' }, 'payment'],
  ];
  for (const [name, overrides, field] of cases) {
    it(`rechaza: ${name}`, async () => {
      const { status, data } = await api.post('/api/orders', order(overrides));
      assert.equal(status, 400, JSON.stringify(data));
      assert.equal(data.field, field);
      assert.ok(data.error.length > 5);
    });
  }

  it('rechaza productos sin stock y cantidades mayores al stock', async () => {
    const soldOut = await api.post('/api/orders', order({ items: [{ productId: CINTURON_FINO, quantity: 1, color: 'Crudo' }] }));
    assert.equal(soldOut.status, 400);
    assert.match(soldOut.data.error, /sin stock/);
    const tooMany = await api.post('/api/orders', order({ items: [{ productId: TOTE, quantity: 9, color: 'Suela' }] }));
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.data.error, /quedan 8/);
  });

  it('suma las líneas repetidas antes de controlar el stock', async () => {
    const { status, data } = await api.post('/api/orders', order({
      items: [
        { productId: TOTE, quantity: 5, color: 'Suela' },
        { productId: TOTE, quantity: 4, color: 'Negro' },
      ],
    }));
    assert.equal(status, 400);
    assert.match(data.error, /quedan 8/);
  });
});

describe('precios, envío y pago simulado', () => {
  it('ignora precios enviados por el navegador y cobra el envío bajo el mínimo', async () => {
    const created = await api.post('/api/orders', order({ items: [{ productId: LLAVERO, quantity: 1, color: 'Manteca', price: 1, unitPrice: 1 }] }));
    assert.equal(created.status, 201);
    assert.match(created.data.redirect, /^\/pago-demo\//);
    const { data } = await api.get(`/api/orders/${created.data.token}`);
    assert.equal(data.subtotal, 9500);
    assert.equal(data.shipping, 6500);
    assert.equal(data.total, 16000);
    assert.equal(data.status, 'pendiente');
    assert.equal(data.canPay, true);
  });

  it('aplica envío gratis desde el mínimo y no cobra el retiro', async () => {
    const free = await api.post('/api/orders', order({ items: [{ productId: TOTE, quantity: 1, color: 'Suela' }] }));
    const freeOrder = (await api.get(`/api/orders/${free.data.token}`)).data;
    assert.equal(freeOrder.shipping, 0);
    assert.equal(freeOrder.total, 129000);

    const pickup = await api.post('/api/orders', order({ delivery: { method: 'retiro' } }));
    const pickupOrder = (await api.get(`/api/orders/${pickup.data.token}`)).data;
    assert.equal(pickupOrder.shipping, 0);
    assert.equal(pickupOrder.total, 9500);
    assert.ok(pickupOrder.delivery.pickupAddress);
  });

  it('aprueba el pago simulado, descuenta stock y no permite pagar dos veces', async () => {
    const before = await stockOf(TOTE);
    const created = await api.post('/api/orders', order({ items: [{ productId: TOTE, quantity: 2, color: 'Negro' }] }));
    assert.equal(await stockOf(TOTE), before, 'crear el pedido no descuenta stock');
    const paid = await api.post(`/api/demo/orders/${created.data.token}/pay`, { approved: true });
    assert.equal(paid.status, 200);
    const { data } = await api.get(`/api/orders/${created.data.token}`);
    assert.equal(data.status, 'pagado');
    assert.equal(data.canPay, false);
    assert.equal(await stockOf(TOTE), before - 2);
    const again = await api.post(`/api/demo/orders/${created.data.token}/pay`, { approved: true });
    assert.equal(again.status, 409);
  });

  it('registra un pago rechazado y deja reintentar', async () => {
    const created = await api.post('/api/orders', order());
    await api.post(`/api/demo/orders/${created.data.token}/pay`, { approved: false });
    const { data } = await api.get(`/api/orders/${created.data.token}`);
    assert.equal(data.status, 'pendiente');
    assert.equal(data.payment.status, 'rejected');
    assert.equal(data.canPay, true);
    const retry = await api.post(`/api/orders/${created.data.token}/pay`);
    assert.equal(retry.status, 200);
    assert.match(retry.data.redirect, /^\/pago-demo\//);
  });

  it('busca pedidos por número y email', async () => {
    const created = await api.post('/api/orders', order());
    const wrong = await api.post('/api/orders/lookup', { number: created.data.number, email: 'otra@example.com' });
    assert.equal(wrong.status, 404);
    const ok = await api.post('/api/orders/lookup', { number: `#${created.data.number}`, email: 'ANA@example.com' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.token, created.data.token);
    assert.equal((await api.get('/api/orders/token-que-no-existe-123')).status, 404);
  });

  it('registra el botón de arrepentimiento y lo marca en el panel', async () => {
    const created = await api.post('/api/orders', order());
    const regret = await api.post('/api/orders/arrepentimiento', { number: created.data.number, email: customer.email, reason: 'Me equivoqué de color' });
    assert.equal(regret.status, 201);
    assert.match(regret.data.code, new RegExp(`^ARR-${created.data.number}-[0-9A-F]{4}$`));
    const list = await admin.get('/api/admin/orders');
    assert.equal(list.data.orders.find((o) => o.id === created.data.number).regret, true);
    const dash = await admin.get('/api/admin/dashboard');
    assert.ok(dash.data.stats.regretRequests >= 1);
    const missing = await api.post('/api/orders/arrepentimiento', { number: 99999, email: customer.email });
    assert.equal(missing.status, 404);
  });
});

describe('panel de administración', () => {
  it('exige sesión y el encabezado de seguridad', async () => {
    assert.equal((await api.get('/api/admin/orders')).status, 401);
    assert.equal((await api.post('/api/admin/login', { password: 'mal' })).status, 401);
    const noHeader = await admin.put('/api/admin/settings', { store_name: 'X' });
    assert.equal(noHeader.status, 403);
    const me = await admin.get('/api/admin/me');
    assert.equal(me.data.authenticated, true);
  });

  it('habilita la transferencia al cargar alias y aplica el descuento', async () => {
    const saved = await admin.put('/api/admin/settings', { transfer_alias: 'mi.tienda.mp', transfer_holder: 'Moon SRL' }, { admin: true });
    assert.equal(saved.status, 200);
    assert.equal((await api.get('/api/config')).data.transfer.enabled, true);

    const created = await api.post('/api/orders', order({ paymentMethod: 'transferencia', items: [{ productId: LLAVERO, quantity: 2, color: 'Salvia' }] }));
    assert.equal(created.status, 201);
    assert.equal(created.data.redirect, `/pedido/${created.data.token}`);
    const { data } = await api.get(`/api/orders/${created.data.token}`);
    assert.equal(data.subtotal, 19000);
    assert.equal(data.discount, 1900);
    assert.equal(data.shipping, 6500);
    assert.equal(data.total, 23600);
    assert.equal(data.transfer.alias, 'mi.tienda.mp');
    assert.equal(data.canPay, false);
  });

  it('valida los ajustes', async () => {
    const both = await admin.put('/api/admin/settings', { shipping_enabled: false, pickup_enabled: false }, { admin: true });
    assert.equal(both.status, 400);
    const badNumber = await admin.put('/api/admin/settings', { transfer_discount: 80 }, { admin: true });
    assert.equal(badNumber.status, 400);
    assert.equal(badNumber.data.field, 'transfer_discount');
    assert.match(badNumber.data.error, /Descuento por transferencia/);
    const badLink = await admin.put('/api/admin/settings', { data_fiscal_url: 'javascript:alert(1)' }, { admin: true });
    assert.equal(badLink.status, 400, 'no acepta links peligrosos');
    const goodLink = await admin.put('/api/admin/settings', { data_fiscal_url: 'https://qr.afip.gob.ar/?qr=abc' }, { admin: true });
    assert.equal(goodLink.status, 200);
    assert.equal((await api.get('/api/config')).data.dataFiscalUrl, 'https://qr.afip.gob.ar/?qr=abc');
  });

  it('ajusta el stock según el estado del pedido', async () => {
    const start = await stockOf(LLAVERO);
    const created = await api.post('/api/orders', order({ paymentMethod: 'transferencia', items: [{ productId: LLAVERO, quantity: 3, color: 'Celeste' }] }));
    const id = created.data.number;
    const set = (status) => admin.patch(`/api/admin/orders/${id}`, { status }, { admin: true });
    assert.equal((await set('pagado')).data.status, 'pagado');
    assert.equal(await stockOf(LLAVERO), start - 3);
    await set('enviado');
    assert.equal(await stockOf(LLAVERO), start - 3, 'pasar a enviado no vuelve a descontar');
    await set('cancelado');
    assert.equal(await stockOf(LLAVERO), start, 'cancelar devuelve el stock');
    await set('pagado');
    assert.equal(await stockOf(LLAVERO), start - 3);
    const removed = await admin.del(`/api/admin/orders/${id}`, { admin: true });
    assert.equal(removed.status, 200);
    assert.equal(await stockOf(LLAVERO), start, 'eliminar un pedido pagado devuelve el stock');
    assert.equal((await admin.get(`/api/admin/orders/${id}`)).status, 404);
  });

  it('guarda el código de seguimiento y lo muestra al cliente', async () => {
    const created = await api.post('/api/orders', order());
    const updated = await admin.patch(`/api/admin/orders/${created.data.number}`, { trackingCode: 'CA123456789AR', adminNotes: 'Regalo' }, { admin: true });
    assert.equal(updated.data.trackingCode, 'CA123456789AR');
    assert.ok(updated.data.events.some((e) => e.message.includes('CA123456789AR')));
    const publicView = (await api.get(`/api/orders/${created.data.token}`)).data;
    assert.equal(publicView.trackingCode, 'CA123456789AR');
    assert.equal(publicView.adminNotes, undefined, 'las notas internas no llegan al cliente');
  });

  it('exporta los pedidos a CSV protegido contra fórmulas', async () => {
    await api.post('/api/orders', order({ customer: { ...customer, name: '=HYPERLINK("http://malo")' } }));
    const csv = await admin.get('/api/admin/orders.csv');
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    const text = csv.data.toString('utf8');
    assert.equal(text.charCodeAt(0), 0xfeff, 'empieza con BOM para Excel');
    assert.match(text, /^﻿Pedido;Fecha;Estado;Cliente/);
    assert.ok(text.includes(`"'=HYPERLINK(""http://malo"")"`));
  });

  it('descarga una copia de seguridad de la base', async () => {
    const backup = await admin.get('/api/admin/backup');
    assert.equal(backup.status, 200);
    assert.equal(backup.data.subarray(0, 15).toString(), 'SQLite format 3');
  });

  it('sube imágenes válidas y rechaza archivos disfrazados', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4480000000049454e44ae426082', 'hex');
    const ok = await admin.post('/api/admin/upload', undefined, { admin: true, raw: { type: 'image/png', data: png } });
    assert.equal(ok.status, 201);
    assert.match(ok.data.url, /^\/uploads\/[\w-]+\.png$/);
    const served = await api.get(ok.data.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    const fake = await admin.post('/api/admin/upload', undefined, { admin: true, raw: { type: 'image/png', data: Buffer.from('<script>alert(1)</script>') } });
    assert.equal(fake.status, 400);
  });

  it('crea, edita, oculta y borra productos', async () => {
    const payload = {
      name: 'Riñonera Pampa', category: 'Accesorios', price: 45000, stock: 3, description: 'Para llevar lo justo.',
      details: ['Medidas: 20 × 12 cm'], colors: [{ name: 'Suela', hex: '#BE8A5C' }], illustration: 'clutch',
    };
    const created = await admin.post('/api/admin/products', payload, { admin: true });
    assert.equal(created.status, 201);
    assert.equal(created.data.slug, 'rinonera-pampa');
    assert.equal((await api.get('/api/products/rinonera-pampa')).status, 200);

    const badCompare = await admin.put(`/api/admin/products/${created.data.id}`, { ...payload, compareAtPrice: 40000 }, { admin: true });
    assert.equal(badCompare.status, 400);
    assert.equal(badCompare.data.field, 'compareAtPrice');

    const duplicate = await admin.post('/api/admin/products', payload, { admin: true });
    assert.equal(duplicate.status, 400);
    assert.equal(duplicate.data.field, 'slug');

    const hidden = await admin.patch(`/api/admin/products/${created.data.id}`, { active: false }, { admin: true });
    assert.equal(hidden.data.active, false);
    assert.equal((await api.get('/api/products/rinonera-pampa')).status, 404);
    const hiddenOrder = await api.post('/api/orders', order({ items: [{ productId: created.data.id, quantity: 1, color: 'Suela' }] }));
    assert.equal(hiddenOrder.status, 400, 'no se puede comprar un producto oculto');

    assert.equal((await admin.del(`/api/admin/products/${created.data.id}`, { admin: true })).status, 200);
    assert.equal((await admin.get('/api/admin/products')).data.some((p) => p.id === created.data.id), false);
  });

  it('limita los intentos de ingreso', async () => {
    const attacker = client(store.base, { ip: '10.9.9.9' });
    let last;
    for (let i = 0; i < 12; i++) last = await attacker.post('/api/admin/login', { password: `intento-${i}` });
    assert.equal(last.status, 429);
  });
});

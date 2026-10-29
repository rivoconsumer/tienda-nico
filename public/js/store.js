// Estado compartido de la tienda: configuración, productos y cuentas del carrito.
import { api } from './api.js';
import { cart } from './cart.js';

export const state = { config: null, products: [] };

export async function loadInitialData() {
  const el = document.getElementById('bootstrap');
  const raw = el?.textContent?.trim();
  if (raw && !raw.startsWith('{{')) {
    try {
      const data = JSON.parse(raw);
      state.config = data.config;
      state.products = data.products;
      return;
    } catch {
      /* si falla, se piden los datos a la API */
    }
  }
  const [config, products] = await Promise.all([api('GET', '/api/config'), api('GET', '/api/products')]);
  state.config = config;
  state.products = products;
}

export async function refreshProducts() {
  try {
    state.products = await api('GET', '/api/products');
  } catch {
    /* se sigue con los datos que ya hay */
  }
}

export const productById = (id) => state.products.find((p) => p.id === id);
export const productBySlug = (slug) => state.products.find((p) => p.slug === slug);

export const slugify = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Categorías en el orden en que aparecen los productos. */
export function categories() {
  const map = new Map();
  for (const product of state.products) {
    const slug = slugify(product.category);
    if (!map.has(slug)) map.set(slug, { name: product.category, slug, products: [] });
    map.get(slug).products.push(product);
  }
  return [...map.values()];
}

/** Líneas del carrito con los datos actuales de cada producto. */
export function cartLines() {
  return cart.items.map((item) => {
    const product = productById(item.productId);
    if (!product) return { ...item, product: null, problem: 'Ya no está disponible' };
    const color = product.colors.find((c) => c.name === item.color) ?? (product.colors.length ? null : undefined);
    let problem = null;
    if (color === null) problem = 'El color elegido ya no está disponible';
    else if (product.stock <= 0) problem = 'Sin stock';
    else if (cart.quantityOf(product.id) > product.stock) problem = `Quedan ${product.stock}`;
    return {
      ...item,
      product,
      colorHex: color?.hex ?? null,
      lineTotal: product.price * item.quantity,
      problem,
    };
  });
}

export const cartSubtotal = () =>
  cartLines().reduce((sum, line) => sum + (line.product ? line.product.price * line.quantity : 0), 0);

/** La misma cuenta que hace el servidor (src/orders.js → computeTotals). */
export function computeTotals(subtotal, deliveryMethod, paymentMethod) {
  const c = state.config;
  const discount = paymentMethod === 'transferencia' ? Math.round((subtotal * c.transfer.discount) / 100) : 0;
  const freeShipping = c.shipping.freeFrom > 0 && subtotal >= c.shipping.freeFrom;
  const shipping = deliveryMethod === 'envio' && !freeShipping ? c.shipping.cost : 0;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping, freeShipping };
}

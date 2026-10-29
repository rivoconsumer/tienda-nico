// Carrito guardado en el navegador del cliente. Los precios se recalculan siempre en el servidor.
import { storage } from './ui.js';

const KEY = 'tienda.cart.v1';
const listeners = new Set();

const valid = (item) =>
  item && Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0;

let items = (storage.get(KEY, []) || []).filter(valid);

const keyOf = (productId, color) => `${productId}|${color ?? ''}`;

function commit(next) {
  items = next;
  storage.set(KEY, items);
  listeners.forEach((fn) => fn(items));
}

export const cart = {
  get items() {
    return items;
  },
  count() {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },
  quantityOf(productId) {
    return items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0);
  },
  add(productId, color, quantity = 1) {
    const key = keyOf(productId, color);
    const existing = items.find((i) => i.key === key);
    if (existing) {
      commit(items.map((i) => (i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, 99) } : i)));
    } else {
      commit([...items, { key, productId, color: color ?? null, quantity: Math.min(quantity, 99) }]);
    }
  },
  setQuantity(key, quantity) {
    if (quantity <= 0) return cart.remove(key);
    commit(items.map((i) => (i.key === key ? { ...i, quantity: Math.min(quantity, 99) } : i)));
  },
  remove(key) {
    commit(items.filter((i) => i.key !== key));
  },
  clear() {
    commit([]);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Si el cliente tiene la tienda abierta en otra pestaña, se mantiene sincronizado.
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  items = (storage.get(KEY, []) || []).filter(valid);
  listeners.forEach((fn) => fn(items));
});

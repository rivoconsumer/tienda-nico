import { illustration, tileColor } from './illustrations.js';
import { icon } from './icons.js';

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Convierte *palabras* en resaltado amarillo (para títulos editables desde el panel). */
export const highlight = (text) => esc(text).replace(/\*(.+?)\*/g, '<mark class="mark">$1</mark>');

export const paragraphs = (text, className = '') =>
  String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="${className}">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

export function formatDate(iso, options = { dateStyle: 'long' }) {
  try {
    return new Intl.DateTimeFormat('es-AR', options).format(new Date(iso));
  } catch {
    return '';
  }
}

export const whatsappUrl = (number, text = '') =>
  `https://wa.me/${String(number).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const instagramUrl = (handle) => `https://instagram.com/${encodeURIComponent(String(handle).replace(/^@/, ''))}`;

/** Color de cuero elegido (o el primero) para un producto. */
export function pickColor(product, colorName) {
  return product.colors.find((c) => c.name === colorName) ?? product.colors[0] ?? null;
}

export function artBackground(product, colorHex) {
  if (product.imageUrl) return '#fffbea';
  return tileColor(colorHex || product.colors[0]?.hex || '#E3B967');
}

/** Foto del producto (si tiene) o la ilustración con el color pedido. */
export function productArt(product, colorHex, { size = 'w-[80%]', eager = false } = {}) {
  if (product.imageUrl) {
    return `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" class="absolute inset-0 h-full w-full object-cover" ${eager ? '' : 'loading="lazy"'} decoding="async">`;
  }
  return `<div class="${size} transition-transform duration-500 ease-[var(--ease-soft)] group-hover:-translate-y-1.5 group-hover:scale-[1.03]">${illustration(product.illustration, colorHex || product.colors[0]?.hex, product.name)}</div>`;
}

/** Miniatura cuadrada para carrito, checkout y pedidos. */
export function thumb({ illustration: kind, imageUrl, colorHex, name }, className = 'size-16') {
  const background = imageUrl ? '#fffbea' : tileColor(colorHex || '#E3B967');
  const inner = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="" class="h-full w-full object-cover" loading="lazy">`
    : `<div class="w-[86%]">${illustration(kind, colorHex || '#E3B967')}</div>`;
  return `<div class="${className} grid shrink-0 place-items-center overflow-hidden rounded-2xl" style="background-color:${background}" aria-hidden="true" title="${esc(name ?? '')}">${inner}</div>`;
}

export function discountPercent(product) {
  return product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
}

let toastTimer = null;
/** Aviso flotante abajo de la pantalla. */
export function toast(message, { actionLabel, onAction, tone = 'default' } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  clearTimeout(toastTimer);
  const toneIcon = tone === 'error' ? icon('alert', 'size-5 text-butter-300') : icon('check', 'size-5 text-butter-300');
  root.innerHTML = `
    <div class="pointer-events-auto flex max-w-md animate-toast-in items-center gap-3 rounded-full bg-ink py-2.5 pr-2.5 pl-4 text-sm text-cream shadow-float" role="status">
      ${toneIcon}
      <span class="font-medium">${esc(message)}</span>
      ${actionLabel ? `<button type="button" class="ml-1 rounded-full bg-butter-300 px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:bg-butter-400" data-toast-action>${esc(actionLabel)}</button>` : ''}
    </div>`;
  root.querySelector('[data-toast-action]')?.addEventListener('click', () => {
    root.innerHTML = '';
    onAction?.();
  });
  toastTimer = setTimeout(() => (root.innerHTML = ''), 4200);
}

/** Copia texto al portapapeles con un respaldo para navegadores viejos. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* navegación privada o almacenamiento bloqueado */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* sin acceso al almacenamiento */
    }
  },
};

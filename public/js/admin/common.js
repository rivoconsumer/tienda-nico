// Utilidades compartidas del panel.
import { ApiError } from '../api.js';
import { icon } from '../icons.js';
import { esc } from '../ui.js';

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

/** Llama a la API del panel (agrega el encabezado de seguridad y maneja la sesión vencida). */
export async function adminApi(method, url, body, { file } = {}) {
  if (typeof window.__mockApi === 'function') return window.__mockApi(method, url, body ?? file);
  const headers = { 'X-Admin': '1' };
  let payload;
  if (file) {
    headers['Content-Type'] = file.type;
    payload = file;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('No hay conexión con la tienda. Revisá tu internet.', 0);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.status === 401 && !url.endsWith('/login')) {
    onUnauthorized(data?.error);
    throw new ApiError(data?.error || 'Tu sesión venció.', 401);
  }
  if (!response.ok) throw new ApiError(data?.error || 'Algo salió mal. Probá de nuevo.', response.status, data?.field);
  return data;
}

/** Link a una página de la tienda (en la vista previa, la tienda vive en otra página). */
export const storeLink = (path) => (window.__demo ? `${window.__demo.storePage}#${path}` : path);
export const storeTarget = () => (window.__demo ? '_self' : '_blank');

/** Actualiza el numerito de pedidos pendientes en el menú. */
export function setPendingCount(n) {
  document.querySelectorAll('[data-pending-badge]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = !n;
  });
}

export const STATUS = {
  pendiente: { label: 'Pendiente de pago', short: 'Pendiente', cls: 'bg-wait-soft text-wait', dot: 'bg-butter-500' },
  pagado: { label: 'Pagado', short: 'Pagado', cls: 'bg-ok-soft text-ok', dot: 'bg-ok' },
  preparando: { label: 'En preparación', short: 'Preparando', cls: 'bg-lilac text-[#56478a]', dot: 'bg-[#7a68b8]' },
  enviado: { label: 'Enviado / listo para retirar', short: 'Enviado', cls: 'bg-mist text-[#2c5a70]', dot: 'bg-[#4f86a3]' },
  entregado: { label: 'Entregado', short: 'Entregado', cls: 'bg-sage text-[#3c5733]', dot: 'bg-[#5f8a52]' },
  cancelado: { label: 'Cancelado', short: 'Cancelado', cls: 'bg-bad-soft text-bad', dot: 'bg-bad' },
};

export const STATUS_ORDER = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];

export function statusBadge(status, { short = true } = {}) {
  const s = STATUS[status] ?? STATUS.pendiente;
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${s.cls}"><span class="size-1.5 rounded-full ${s.dot}" aria-hidden="true"></span>${short ? s.short : s.label}</span>`;
}

export const PAYMENT_STATUS = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  in_process: 'En revisión',
  authorized: 'Autorizado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Devuelto',
  charged_back: 'Contracargo',
  in_mediation: 'En mediación',
};

export const paymentLabel = (method) => (method === 'transferencia' ? 'Transferencia' : 'Mercado Pago');

export function relativeDate(iso) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay(date, today)) return `Hoy ${time}`;
  if (sameDay(date, yesterday)) return `Ayer ${time}`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }) + ` ${time}`;
}

/** WhatsApp de un cliente argentino a partir de lo que escribió (mejor esfuerzo). */
export function customerWhatsapp(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('54')) digits = `549${digits.replace(/^0/, '')}`;
  return `https://wa.me/${digits}`;
}

// ── Panel lateral (detalle de pedido, formulario de producto) ─
let drawerState = null;

export function openDrawer({ html, label, wide = false, onClose }) {
  closeDrawer({ silent: true });
  const root = document.getElementById('drawer-root');
  root.innerHTML = `
    <div class="fixed inset-0 z-50" data-admin-drawer>
      <div class="absolute inset-0 bg-ink/30 opacity-0 transition-opacity duration-300 data-[open]:opacity-100" data-drawer-close></div>
      <section role="dialog" aria-modal="true" aria-label="${esc(label)}" class="absolute inset-y-0 right-0 flex w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} translate-x-full flex-col bg-cream shadow-float transition-transform duration-300 ease-[var(--ease-soft)] data-[open]:translate-x-0" data-drawer-panel>
        ${html}
      </section>
    </div>`;
  const wrapper = root.querySelector('[data-admin-drawer]');
  const panel = root.querySelector('[data-drawer-panel]');
  const previousFocus = document.activeElement;
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      wrapper.querySelectorAll('[data-drawer-close].absolute, [data-drawer-panel]').forEach((el) => el.setAttribute('data-open', ''));
      (panel.querySelector('[autofocus]') ?? panel.querySelector('[data-drawer-close]:not(.absolute)'))?.focus();
    }),
  );
  const onKey = (event) => {
    if (event.key === 'Escape') closeDrawer();
  };
  wrapper.addEventListener('click', (event) => {
    if (event.target.closest('[data-drawer-close]')) closeDrawer();
  });
  document.addEventListener('keydown', onKey);
  drawerState = { wrapper, onKey, onClose, previousFocus };
  return panel;
}

export function closeDrawer({ silent = false } = {}) {
  if (!drawerState) return;
  const { wrapper, onKey, onClose, previousFocus } = drawerState;
  drawerState = null;
  document.removeEventListener('keydown', onKey);
  document.documentElement.style.overflow = '';
  wrapper.querySelectorAll('[data-open]').forEach((el) => el.removeAttribute('data-open'));
  setTimeout(() => wrapper.remove(), silent ? 0 : 300);
  previousFocus?.focus?.();
  if (!silent) onClose?.();
}

export const drawerOpen = () => Boolean(drawerState);

export function drawerHeader(title, subtitle = '') {
  return `
    <header class="flex items-start justify-between gap-4 border-b border-line bg-paper px-5 py-4 sm:px-7">
      <div class="min-w-0">
        <h2 class="font-display text-[28px] leading-tight">${title}</h2>
        ${subtitle ? `<p class="mt-0.5 text-sm text-ink-soft">${subtitle}</p>` : ''}
      </div>
      <button type="button" class="icon-btn -mr-2 shrink-0" data-drawer-close aria-label="Cerrar">${icon('close', 'size-6')}</button>
    </header>`;
}

/** Botón que pide confirmación con un segundo clic (sin ventanas emergentes). */
export function confirmButton(button, { confirmLabel = '¿Seguro? Tocá de nuevo', onConfirm }) {
  let armed = false;
  let timer = null;
  const original = button.innerHTML;
  button.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      button.innerHTML = confirmLabel;
      button.classList.add('bg-bad', 'text-cream', 'border-bad');
      timer = setTimeout(() => {
        armed = false;
        button.innerHTML = original;
        button.classList.remove('bg-bad', 'text-cream', 'border-bad');
      }, 4000);
      return;
    }
    clearTimeout(timer);
    button.disabled = true;
    try {
      await onConfirm();
    } finally {
      button.disabled = false;
    }
  });
}

export function emptyState({ iconName = 'box', title, text, action = '' }) {
  return `
    <div class="rounded-[1.75rem] border border-dashed border-line bg-paper px-6 py-14 text-center">
      <div class="mx-auto grid size-14 place-items-center rounded-full bg-butter-100">${icon(iconName, 'size-6')}</div>
      <p class="mt-4 font-display text-2xl">${title}</p>
      ${text ? `<p class="mx-auto mt-2 max-w-sm text-sm text-ink-soft">${text}</p>` : ''}
      ${action}
    </div>`;
}

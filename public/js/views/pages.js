import { state } from '../store.js';
import { api, ApiError } from '../api.js';
import { icon } from '../icons.js';
import { esc, money, storage, toast, whatsappUrl } from '../ui.js';
import { faq } from '../content.js';
import { notice } from './components.js';

// ── Ayuda ────────────────────────────────────────────────────
export function helpView() {
  const c = state.config;
  const items = faq(c);
  return {
    title: 'Ayuda',
    html: `
      <div class="wrap max-w-3xl pt-10 sm:pt-14">
        <p class="eyebrow">Ayuda</p>
        <h1 class="mt-3 font-display text-5xl leading-none sm:text-6xl">Preguntas frecuentes</h1>
        <p class="mt-4 text-lg text-ink-soft">Envíos, pagos, cambios y cuidado del cuero. Si no encontrás lo que buscás, escribinos.</p>
        <div class="mt-10 divide-y divide-line border-y border-line">
          ${items.map((item, i) => `
            <details id="${item.id}" class="group py-6" ${i === 0 ? 'open' : ''}>
              <summary class="flex items-center justify-between gap-6 text-lg font-semibold">
                ${esc(item.q)}
                <span class="grid size-8 shrink-0 place-items-center rounded-full bg-butter-100 transition-transform group-open:rotate-45">${icon('plus', 'size-4')}</span>
              </summary>
              <p class="mt-4 max-w-2xl leading-relaxed text-ink-soft">${esc(item.a)}</p>
            </details>`).join('')}
        </div>
        ${c.contact.whatsapp || c.contact.email ? `
          <div class="mt-10 flex flex-col items-start gap-4 rounded-[1.75rem] bg-butter-100 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><p class="font-display text-2xl">¿Te quedó alguna duda?</p><p class="mt-1 text-ink-soft">Respondemos de lunes a viernes.</p></div>
            <div class="flex flex-wrap gap-2">
              ${c.contact.whatsapp ? `<a href="${whatsappUrl(c.contact.whatsapp, 'Hola! Tengo una consulta.')}" target="_blank" rel="noopener" class="btn btn-dark">${icon('chat', 'size-5')} WhatsApp</a>` : ''}
              ${c.contact.email ? `<a href="mailto:${esc(c.contact.email)}" class="btn btn-ghost bg-paper">${icon('mail', 'size-5')} ${esc(c.contact.email)}</a>` : ''}
            </div>
          </div>` : ''}
      </div>`,
    mount() {
      // Abre la pregunta enlazada (por ejemplo /ayuda#cuidado)
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      if (target?.tagName === 'DETAILS') target.open = true;
    },
  };
}

// ── Seguimiento ──────────────────────────────────────────────
function lookupForm({ id, title, intro, submitLabel, extra = '' }) {
  const last = storage.get('tienda.lastOrder');
  return `
    <div class="wrap max-w-xl pt-10 sm:pt-14">
      <h1 class="font-display text-5xl leading-none">${title}</h1>
      <p class="mt-4 text-lg text-ink-soft">${intro}</p>
      <form class="mt-8 space-y-4 rounded-[1.75rem] border border-line bg-paper p-6 sm:p-7" data-form="${id}" novalidate>
        <div data-error></div>
        <div>
          <label for="${id}-number" class="label">Número de pedido</label>
          <input id="${id}-number" name="number" class="input" inputmode="numeric" placeholder="Por ejemplo 1042" value="${last?.number ?? ''}" required>
        </div>
        <div>
          <label for="${id}-email" class="label">Email con el que compraste</label>
          <input id="${id}-email" name="email" type="email" class="input" autocomplete="email" required>
        </div>
        ${extra}
        <button type="submit" class="btn btn-dark btn-lg w-full">${submitLabel}</button>
      </form>
    </div>`;
}

export function trackingView({ navigate }) {
  return {
    title: 'Seguí tu pedido',
    html: lookupForm({
      id: 'track',
      title: 'Seguí tu pedido',
      intro: 'Ingresá el número de pedido y tu email para ver en qué estado está.',
      submitLabel: `${icon('search', 'size-5')} Buscar pedido`,
    }),
    mount(root) {
      const form = root.querySelector('[data-form="track"]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const errorBox = form.querySelector('[data-error]');
        errorBox.innerHTML = '';
        if (!data.number.trim() || !data.email.trim()) {
          errorBox.innerHTML = notice('Completá el número de pedido y el email.', 'error');
          return;
        }
        try {
          const { token } = await api('POST', '/api/orders/lookup', data);
          navigate(`/pedido/${token}`);
        } catch (error) {
          errorBox.innerHTML = notice(esc(error.message), 'error');
        }
      });
    },
  };
}

// ── Botón de arrepentimiento (Resolución 424/2020) ───────────
export function regretView() {
  return {
    title: 'Botón de arrepentimiento',
    html: lookupForm({
      id: 'regret',
      title: 'Botón de arrepentimiento',
      intro: 'Si compraste hace menos de 10 días corridos desde que recibiste el producto, podés arrepentirte sin dar explicaciones. Completá tus datos y te damos un código de trámite.',
      submitLabel: 'Enviar solicitud',
      extra: `
        <div>
          <label for="regret-reason" class="label">Comentarios <span class="font-normal text-ink-faint">(opcional)</span></label>
          <textarea id="regret-reason" name="reason" class="input" rows="3" maxlength="500"></textarea>
        </div>`,
    }),
    mount(root) {
      const form = root.querySelector('[data-form="regret"]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const errorBox = form.querySelector('[data-error]');
        errorBox.innerHTML = '';
        if (!data.number.trim() || !data.email.trim()) {
          errorBox.innerHTML = notice('Completá el número de pedido y el email.', 'error');
          return;
        }
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          const { code } = await api('POST', '/api/orders/arrepentimiento', data);
          form.outerHTML = `
            <div class="mt-8 rounded-[1.75rem] border border-line bg-paper p-6 text-center sm:p-8">
              <div class="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok">${icon('check', 'size-7')}</div>
              <p class="mt-5 font-display text-3xl">Recibimos tu solicitud</p>
              <p class="mt-3 text-ink-soft">Tu código de trámite es</p>
              <p class="mt-2 inline-block rounded-full bg-butter-200 px-5 py-2 text-xl font-semibold tracking-wide tabular-nums select-all">${esc(code)}</p>
              <p class="mt-4 text-sm text-ink-soft">Guardalo. Te vamos a contactar dentro de las 24 horas para coordinar la devolución.</p>
            </div>`;
        } catch (error) {
          errorBox.innerHTML = notice(esc(error.message), 'error');
          button.disabled = false;
        }
      });
    },
  };
}

// ── Pago simulado (modo demo) ────────────────────────────────
export async function demoPayView({ params, navigate }) {
  let order;
  try {
    order = await api('GET', `/api/orders/${encodeURIComponent(params[0])}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
  if (!order.canPay) {
    navigate(`/pedido/${order.token}`, { replace: true });
    return { html: '' };
  }
  return {
    title: 'Pago de prueba',
    html: `
      <div class="wrap max-w-lg pt-10 sm:pt-16">
        <div class="overflow-hidden rounded-[2rem] border border-line bg-paper shadow-float">
          <div class="bg-ink px-6 py-5 text-cream">
            <p class="text-xs font-semibold tracking-[0.2em] text-butter-300 uppercase">Pasarela de prueba</p>
            <p class="mt-1 text-sm text-cream/70">No se cobra nada: así se ve el paso de pago mientras la tienda está en modo demo.</p>
          </div>
          <div class="p-6 sm:p-8">
            <div class="flex items-baseline justify-between">
              <span class="text-ink-soft">Pedido #${order.number}</span>
              <span class="text-3xl font-semibold tabular-nums">${money(order.total)}</span>
            </div>
            <ul class="mt-4 space-y-1 border-y border-line py-4 text-sm text-ink-soft">
              ${order.items.map((i) => `<li class="flex justify-between gap-3"><span>${i.quantity} × ${esc(i.name)}${i.color ? ` (${esc(i.color)})` : ''}</span><span class="tabular-nums">${money(i.unitPrice * i.quantity)}</span></li>`).join('')}
            </ul>
            <p class="mt-5 text-sm leading-relaxed text-ink-soft">Con tus credenciales de Mercado Pago cargadas, en este paso tu cliente paga con tarjeta, dinero en cuenta o efectivo.</p>
            <div class="mt-6 grid gap-3">
              <button type="button" class="btn btn-dark btn-lg" data-demo="true">${icon('check', 'size-5')} Aprobar pago</button>
              <button type="button" class="btn btn-ghost" data-demo="false">Simular pago rechazado</button>
            </div>
          </div>
        </div>
      </div>`,
    mount(root) {
      root.querySelectorAll('[data-demo]').forEach((button) =>
        button.addEventListener('click', async () => {
          root.querySelectorAll('[data-demo]').forEach((b) => (b.disabled = true));
          try {
            const result = await api('POST', `/api/demo/orders/${encodeURIComponent(order.token)}/pay`, { approved: button.dataset.demo === 'true' });
            navigate(result.redirect, { replace: true });
          } catch (error) {
            toast(error.message, { tone: 'error' });
            root.querySelectorAll('[data-demo]').forEach((b) => (b.disabled = false));
          }
        }),
      );
    },
  };
}

// ── Página no encontrada ─────────────────────────────────────
export function notFoundView() {
  return {
    title: 'Página no encontrada',
    html: `
      <section class="wrap max-w-xl py-24 text-center">
        <p class="font-display text-8xl text-butter-400">404</p>
        <h1 class="mt-4 font-display text-4xl">No encontramos esta página</h1>
        <p class="mt-3 text-ink-soft">Puede que el producto ya no esté disponible o que el link tenga un error.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/tienda" class="btn btn-dark">Ir a la tienda</a>
          <a href="/" class="btn btn-ghost">Volver al inicio</a>
        </div>
      </section>`,
  };
}


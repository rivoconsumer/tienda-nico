import { state, cartLines, cartSubtotal, computeTotals, refreshProducts } from '../store.js';
import { cart } from '../cart.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, money, thumb, storage, plural } from '../ui.js';
import { PROVINCES, installmentsText } from '../content.js';
import { notice } from './components.js';

const DRAFT_KEY = 'tienda.checkout.v1';

const field = ({ id, label, type = 'text', autocomplete, required = true, placeholder = '', inputmode, hint, value = '', span = '' }) => `
  <div class="${span}">
    <label for="${id}" class="label">${label}${required ? '' : ' <span class="font-normal text-ink-faint">(opcional)</span>'}</label>
    <input id="${id}" name="${id}" type="${type}" class="input" value="${esc(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${required ? 'required' : ''} placeholder="${esc(placeholder)}">
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;

function stepTitle(number, title) {
  return `<h2 class="flex items-center gap-3 font-display text-[28px] leading-none"><span class="grid size-8 place-items-center rounded-full bg-butter-300 font-sans text-sm font-bold">${number}</span>${title}</h2>`;
}

export function checkoutView({ navigate }) {
  const c = state.config;
  const lines = cartLines();
  if (!lines.length) {
    return {
      title: 'Finalizar compra',
      html: `
        <section class="wrap py-20 text-center">
          <div class="mx-auto grid size-20 place-items-center rounded-full bg-butter-100">${icon('bag', 'size-9')}</div>
          <h1 class="mt-6 font-display text-4xl">Tu carrito está vacío</h1>
          <p class="mt-3 text-ink-soft">Agregá algún producto para finalizar la compra.</p>
          <a href="/tienda" class="btn btn-dark mt-8">Ir a la tienda</a>
        </section>`,
    };
  }

  const draft = storage.get(DRAFT_KEY, {}) || {};
  const deliveryOptions = [
    c.shipping.enabled && { value: 'envio', icon: 'truck', title: 'Envío a domicilio', text: c.shipping.days },
    c.pickup.enabled && { value: 'retiro', icon: 'store', title: 'Retiro en el taller', text: `${c.pickup.address} ${c.pickup.hours}.` },
  ].filter(Boolean);
  const paymentOptions = [
    { value: 'mercadopago', icon: 'card', title: 'Mercado Pago', text: `Tarjetas de crédito y débito, dinero en cuenta o efectivo. ${installmentsText(c)}` },
    c.transfer.enabled && { value: 'transferencia', icon: 'bank', title: 'Transferencia bancaria', text: `${c.transfer.discount}% de descuento. Al confirmar te mostramos el alias y el CBU.`, badge: `${c.transfer.discount}% off` },
  ].filter(Boolean);
  let delivery = deliveryOptions.some((o) => o.value === draft.delivery) ? draft.delivery : deliveryOptions[0]?.value;
  let payment = paymentOptions.some((o) => o.value === draft.payment) ? draft.payment : 'mercadopago';
  const hasProblems = lines.some((l) => l.problem);

  const option = (name, opt, checked) => `
    <label class="option">
      <input type="radio" name="${name}" value="${opt.value}" class="sr-only" ${checked ? 'checked' : ''}>
      <span class="option-dot" aria-hidden="true"></span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-2 font-semibold">${icon(opt.icon, 'size-[18px]')}${opt.title}</span>
          ${opt.badge ? `<span class="chip bg-butter-300 text-ink">${opt.badge}</span>` : name === 'delivery' ? `<span class="text-sm font-semibold tabular-nums" data-price="${opt.value}"></span>` : ''}
        </span>
        <span class="mt-1 block text-sm leading-relaxed text-ink-soft">${esc(opt.text)}</span>
      </span>
    </label>`;

  const submitBlock = `
    <button type="submit" class="btn btn-dark btn-lg mt-5 w-full" data-submit ${hasProblems ? 'disabled' : ''}></button>
    <p class="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-soft" data-submit-hint></p>
    ${hasProblems ? '<p class="mt-3 text-sm font-medium text-bad">Hay productos sin stock suficiente. Ajustalos en el carrito para continuar.</p>' : ''}`;

  const html = `
    <div class="wrap pt-8 sm:pt-10">
      <a href="/tienda" class="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">${icon('arrowLeft', 'size-4')} Seguir comprando</a>
      <h1 class="mt-4 font-display text-5xl leading-none sm:text-6xl">Finalizar compra</h1>
      ${c.payments.mode === 'demo' ? `<div class="mt-6">${notice('Tienda en <b>modo demo</b>: el pago con Mercado Pago se simula y no se cobra nada.')}</div>` : ''}

      <form class="mt-8 grid gap-10 lg:grid-cols-[1fr_25rem] lg:gap-14" data-checkout novalidate>
        <div class="space-y-12">
          <div data-error></div>

          <section class="space-y-5" aria-labelledby="step-1">
            <div id="step-1">${stepTitle(1, 'Tus datos')}</div>
            <div class="grid gap-4 sm:grid-cols-2">
              ${field({ id: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'nombre@email.com', value: draft.email, span: 'sm:col-span-2', hint: 'Lo usamos para contactarte por tu pedido.' })}
              ${field({ id: 'name', label: 'Nombre y apellido', autocomplete: 'name', value: draft.name })}
              ${field({ id: 'phone', label: 'Teléfono', type: 'tel', autocomplete: 'tel', placeholder: '11 2345-6789', value: draft.phone })}
              ${field({ id: 'dni', label: 'DNI', inputmode: 'numeric', required: false, value: draft.dni, hint: 'Lo pide el correo para entregar el paquete.' })}
            </div>
          </section>

          <section class="space-y-5" aria-labelledby="step-2">
            <div id="step-2">${stepTitle(2, 'Entrega')}</div>
            <div class="grid gap-3">${deliveryOptions.map((o) => option('delivery', o, o.value === delivery)).join('')}</div>
            <div class="grid gap-4 sm:grid-cols-6" data-address ${delivery === 'envio' ? '' : 'hidden'}>
              ${field({ id: 'street', label: 'Calle', autocomplete: 'address-line1', value: draft.street, span: 'sm:col-span-4' })}
              ${field({ id: 'number', label: 'Altura', inputmode: 'numeric', value: draft.number, span: 'sm:col-span-2' })}
              ${field({ id: 'floor', label: 'Piso / depto', autocomplete: 'address-line2', required: false, value: draft.floor, span: 'sm:col-span-2' })}
              ${field({ id: 'city', label: 'Localidad', autocomplete: 'address-level2', value: draft.city, span: 'sm:col-span-4' })}
              <div class="sm:col-span-4">
                <label for="province" class="label">Provincia</label>
                <select id="province" name="province" class="input" autocomplete="address-level1" required>
                  <option value="">Elegí una provincia</option>
                  ${PROVINCES.map((p) => `<option ${p === draft.province ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
              </div>
              ${field({ id: 'zip', label: 'Código postal', autocomplete: 'postal-code', placeholder: '1414', value: draft.zip, span: 'sm:col-span-2' })}
            </div>
          </section>

          <section class="space-y-5" aria-labelledby="step-3">
            <div id="step-3">${stepTitle(3, 'Pago')}</div>
            <div class="grid gap-3">${paymentOptions.map((o) => option('payment', o, o.value === payment)).join('')}</div>
            <div>
              <label for="notes" class="label">Notas para el pedido <span class="font-normal text-ink-faint">(opcional)</span></label>
              <textarea id="notes" name="notes" class="input" rows="3" maxlength="500" placeholder="Por ejemplo: talle del cinturón, horario para recibir o si es para regalo.">${esc(draft.notes ?? '')}</textarea>
            </div>
          </section>
          <div class="lg:hidden">${submitBlock}</div>
        </div>

        <aside class="order-first lg:order-last">
          <div class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6 lg:sticky lg:top-28">
            <button type="button" class="flex w-full items-center justify-between lg:pointer-events-none" data-summary-toggle aria-expanded="false">
              <span class="font-display text-2xl">Tu pedido</span>
              <span class="flex items-center gap-2 text-sm text-ink-soft lg:hidden"><span data-summary-count>${plural(cart.count(), 'producto', 'productos')}</span>${icon('chevronDown', 'size-4')}</span>
            </button>
            <ul class="mt-4 hidden max-h-80 divide-y divide-line overflow-y-auto lg:block" data-summary-items>
              ${lines.map((l) => l.product ? `
                <li class="flex items-center gap-3 py-3">
                  <div class="relative">${thumb({ ...l.product, colorHex: l.colorHex }, 'size-14')}<span class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-cream">${l.quantity}</span></div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold">${esc(l.product.name)}</p>
                    ${l.color ? `<p class="text-xs text-ink-soft">${esc(l.color)}</p>` : ''}
                    ${l.problem ? `<p class="text-xs font-medium text-bad">${esc(l.problem)}</p>` : ''}
                  </div>
                  <p class="text-sm font-semibold tabular-nums">${money(l.lineTotal)}</p>
                </li>` : '').join('')}
            </ul>
            <dl class="mt-4 space-y-2.5 border-t border-line pt-4 text-[15px]" data-totals></dl>
            <div class="hidden lg:block">${submitBlock}</div>
          </div>
        </aside>
      </form>
    </div>`;

  return {
    title: 'Finalizar compra',
    html,
    mount(root) {
      const form = root.querySelector('[data-checkout]');
      const totalsEl = root.querySelector('[data-totals]');
      const submits = [...root.querySelectorAll('[data-submit]')];
      const hints = [...root.querySelectorAll('[data-submit-hint]')];
      const errorBox = root.querySelector('[data-error]');
      const subtotal = cartSubtotal();

      const renderTotals = () => {
        const t = computeTotals(subtotal, delivery, payment);
        const shippingText = delivery === 'retiro' ? 'Sin cargo' : t.shipping === 0 ? 'Gratis' : money(t.shipping);
        totalsEl.innerHTML = `
          <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd class="tabular-nums">${money(t.subtotal)}</dd></div>
          ${t.discount ? `<div class="flex justify-between text-ok"><dt>Descuento transferencia</dt><dd class="tabular-nums">−${money(t.discount)}</dd></div>` : ''}
          <div class="flex justify-between"><dt class="text-ink-soft">${delivery === 'retiro' ? 'Retiro' : 'Envío'}</dt><dd class="tabular-nums">${shippingText}</dd></div>
          <div class="flex items-baseline justify-between border-t border-line pt-3"><dt class="font-semibold">Total</dt><dd class="text-2xl font-semibold tabular-nums">${money(t.total)}</dd></div>`;
        root.querySelectorAll('[data-price="envio"]').forEach((el) => (el.textContent = t.freeShipping ? 'Gratis' : money(c.shipping.cost)));
        root.querySelectorAll('[data-price="retiro"]').forEach((el) => (el.textContent = 'Sin cargo'));
        const label = payment === 'mercadopago'
          ? `${icon('shield', 'size-5')} Pagar ${money(t.total)}`
          : `Confirmar pedido · ${money(t.total)}`;
        const hintHtml = payment === 'mercadopago'
          ? `${icon('info', 'size-4 shrink-0')}<span>${c.payments.mode === 'demo' ? 'Vas a ver una pantalla de pago simulado.' : 'Te llevamos a Mercado Pago para completar el pago de forma segura.'}</span>`
          : `${icon('info', 'size-4 shrink-0')}<span>Al confirmar te mostramos los datos para transferir. Reservamos tu pedido por 48 horas.</span>`;
        submits.forEach((b) => (b.innerHTML = label));
        hints.forEach((h) => (h.innerHTML = hintHtml));
      };

      const saveDraft = () => {
        const data = Object.fromEntries(new FormData(form));
        storage.set(DRAFT_KEY, { ...data, notes: undefined });
      };

      form.addEventListener('change', (event) => {
        if (event.target.name === 'delivery') {
          delivery = event.target.value;
          root.querySelector('[data-address]').hidden = delivery !== 'envio';
        }
        if (event.target.name === 'payment') payment = event.target.value;
        renderTotals();
        saveDraft();
      });
      form.addEventListener('input', (event) => {
        if (event.target.getAttribute('aria-invalid') === 'true') {
          event.target.removeAttribute('aria-invalid');
          errorBox.innerHTML = '';
        }
        saveDraft();
      });

      root.querySelector('[data-summary-toggle]').addEventListener('click', (event) => {
        const list = root.querySelector('[data-summary-items]');
        const open = list.classList.toggle('hidden') === false;
        event.currentTarget.setAttribute('aria-expanded', String(open));
      });

      const showError = (message, fieldName) => {
        errorBox.innerHTML = notice(esc(message), 'error');
        const input = fieldName ? form.querySelector(`[name="${fieldName}"]`) : null;
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          input.focus({ preventScroll: true });
          input.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
          errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      };

      // Validación rápida en el navegador (el servidor vuelve a validar todo).
      const localCheck = (data) => {
        const required = ['email', 'name', 'phone', ...(delivery === 'envio' ? ['street', 'number', 'city', 'province', 'zip'] : [])];
        const labels = { email: 'tu email', name: 'tu nombre y apellido', phone: 'tu teléfono', street: 'la calle', number: 'la altura', city: 'la localidad', province: 'la provincia', zip: 'el código postal' };
        for (const name of required) if (!String(data[name] ?? '').trim()) return [`Completá ${labels[name]}.`, name];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) return ['Revisá tu email: parece que tiene un error.', 'email'];
        return null;
      };

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.innerHTML = '';
        const data = Object.fromEntries(new FormData(form));
        const problem = localCheck(data);
        if (problem) return showError(...problem);

        submits.forEach((b) => {
          b.disabled = true;
          b.innerHTML = '<span class="size-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream"></span> Procesando…';
        });
        try {
          const result = await api('POST', '/api/orders', {
            customer: { name: data.name, email: data.email, phone: data.phone, dni: data.dni },
            delivery: delivery === 'envio'
              ? { method: 'envio', street: data.street, number: data.number, floor: data.floor, city: data.city, province: data.province, zip: data.zip }
              : { method: 'retiro' },
            paymentMethod: payment,
            notes: data.notes,
            items: cart.items.map((i) => ({ productId: i.productId, color: i.color, quantity: i.quantity })),
          });
          cart.clear();
          storage.set('tienda.lastOrder', { token: result.token, number: result.number });
          if (/^https?:\/\//.test(result.redirect)) {
            window.location.href = result.redirect;
          } else {
            navigate(result.redirect);
          }
        } catch (error) {
          if (error.field === 'items') refreshProducts();
          showError(error.message, error.field);
          submits.forEach((b) => (b.disabled = false));
          renderTotals();
        }
      });

      renderTotals();
    },
  };
}

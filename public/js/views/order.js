import { state } from '../store.js';
import { api, ApiError } from '../api.js';
import { icon } from '../icons.js';
import { esc, money, thumb, formatDate, toast, copyText, whatsappUrl } from '../ui.js';
import { notice } from './components.js';
import { absoluteUrl } from '../router-url.js';

const WAITING = ['pending', 'in_process', 'authorized'];

function hero(order) {
  const first = esc(order.customer.name.split(' ')[0]);
  const pickup = order.delivery.method === 'retiro';
  const pay = order.payment;
  const map = {
    pagado: ['check', 'bg-ok-soft text-ok', `¡Gracias por tu compra, ${first}!`, 'Recibimos el pago y ya estamos preparando todo. Guardá este link para seguir tu pedido.'],
    preparando: ['scissors', 'bg-butter-200 text-ink', 'Estamos preparando tu pedido', 'Lo estamos revisando y empaquetando con cuidado.'],
    enviado: pickup
      ? ['store', 'bg-butter-200 text-ink', 'Tu pedido está listo para retirar', `Pasá por ${esc(order.delivery.pickupAddress ?? '')} ${esc(order.delivery.pickupHours ?? '')}.`]
      : ['truck', 'bg-butter-200 text-ink', 'Tu pedido está en camino', order.trackingCode ? 'Podés seguir el envío con el código de abajo.' : 'Pronto te pasamos el código de seguimiento.'],
    entregado: ['sparkle', 'bg-ok-soft text-ok', '¡Pedido entregado!', 'Esperamos que lo disfrutes mucho. Gracias por elegir una pieza hecha a mano.'],
    cancelado: ['close', 'bg-bad-soft text-bad', 'Este pedido fue cancelado', 'Si creés que es un error o tenés dudas, escribinos.'],
  };
  if (map[order.status]) return map[order.status];
  if (pay.method === 'transferencia') {
    return ['bank', 'bg-butter-200 text-ink', `¡Listo, ${first}! Solo falta la transferencia`, 'Reservamos tu pedido por 48 horas. Transferí el total con los datos de abajo y mandanos el comprobante.'];
  }
  if (['rejected', 'cancelled'].includes(pay.status)) {
    return ['alert', 'bg-bad-soft text-bad', 'El pago no se pudo completar', 'Tu pedido sigue reservado. Podés intentarlo de nuevo con otra tarjeta o medio de pago.'];
  }
  if (WAITING.includes(pay.status)) {
    return ['clock', 'bg-butter-200 text-ink', 'Estamos esperando la confirmación del pago', 'Si pagaste en efectivo, puede tardar hasta 2 días hábiles. Esta página se actualiza sola.'];
  }
  return ['clock', 'bg-butter-200 text-ink', 'Tu pedido está pendiente de pago', 'Completá el pago para confirmarlo. Lo tenemos reservado.'];
}

function steps(order) {
  if (order.status === 'cancelado') return '';
  const list = ['Recibido', 'Pagado', 'En preparación', order.delivery.method === 'retiro' ? 'Listo para retirar' : 'Enviado', 'Entregado'];
  const index = { pendiente: 0, pagado: 1, preparando: 2, enviado: 3, entregado: 4 }[order.status] ?? 0;
  return `
    <ol class="mt-8 grid grid-cols-5" aria-label="Estado del pedido">
      ${list.map((label, i) => `
        <li class="relative flex flex-col items-center text-center" ${i === index ? 'aria-current="step"' : ''}>
          ${i > 0 ? `<span class="absolute top-3 right-1/2 h-0.5 w-full ${i <= index ? 'bg-ink' : 'bg-line'}" aria-hidden="true"></span>` : ''}
          <span class="relative grid size-6 place-items-center rounded-full ${i < index ? 'bg-ink text-cream' : i === index ? 'bg-butter-400 text-ink ring-4 ring-butter-200' : 'bg-paper ring-1 ring-line'}">
            ${i < index ? icon('check', 'size-3.5') : `<span class="size-1.5 rounded-full ${i === index ? 'bg-ink' : 'bg-line'}"></span>`}
          </span>
          <span class="mt-2 px-0.5 text-[11px] leading-tight sm:text-xs ${i <= index ? 'font-semibold text-ink' : 'text-ink-soft'}">${label}</span>
        </li>`).join('')}
    </ol>`;
}

function copyRow(label, value) {
  if (!value) return '';
  return `
    <div class="flex items-center justify-between gap-3 py-3">
      <div class="min-w-0">
        <dt class="text-xs text-ink-soft">${label}</dt>
        <dd class="truncate font-semibold tabular-nums select-all">${esc(value)}</dd>
      </div>
      <button type="button" class="btn btn-ghost btn-sm shrink-0" data-copy="${esc(value)}" aria-label="Copiar ${label}">${icon('copy', 'size-4')} Copiar</button>
    </div>`;
}

function transferBox(order) {
  if (order.payment.method !== 'transferencia' || order.status !== 'pendiente' || !order.transfer) return '';
  const t = order.transfer;
  const contact = state.config.contact;
  const proofText = `Hola! Te envío el comprobante de la transferencia del pedido #${order.number} por ${money(order.total)}.`;
  return `
    <section class="rounded-[1.75rem] border-2 border-dashed border-butter-400 bg-butter-50 p-5 sm:p-7" aria-labelledby="transfer-title">
      <h2 id="transfer-title" class="font-display text-2xl">Datos para transferir</h2>
      <dl class="mt-3 divide-y divide-line">
        ${copyRow('Monto a transferir', money(order.total))}
        ${copyRow('Alias', t.alias)}
        ${copyRow('CBU / CVU', t.cbu)}
        ${t.holder ? `<div class="py-3"><dt class="text-xs text-ink-soft">Titular</dt><dd class="font-semibold">${esc(t.holder)}</dd></div>` : ''}
        ${t.bank ? `<div class="py-3"><dt class="text-xs text-ink-soft">Banco</dt><dd class="font-semibold">${esc(t.bank)}</dd></div>` : ''}
      </dl>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        ${contact.whatsapp ? `<a href="${whatsappUrl(contact.whatsapp, proofText)}" target="_blank" rel="noopener" class="btn btn-dark flex-1">${icon('chat', 'size-5')} Enviar comprobante por WhatsApp</a>` : ''}
        ${contact.email ? `<a href="mailto:${esc(contact.email)}?subject=${encodeURIComponent(`Comprobante pedido #${order.number}`)}" class="btn btn-ghost flex-1">${icon('mail', 'size-5')} Enviar por email</a>` : ''}
      </div>
      ${contact.email ? `<p class="mt-3 text-center text-xs text-ink-soft">O escribinos a <span class="select-all">${esc(contact.email)}</span></p>` : ''}
    </section>`;
}

function deliveryText(order) {
  const d = order.delivery;
  if (d.method === 'retiro') return `<p>Retiro en el taller</p><p class="text-ink-soft">${esc(d.pickupAddress ?? '')}</p><p class="text-ink-soft">${esc(d.pickupHours ?? '')}</p>`;
  return `<p>Envío a domicilio</p><p class="text-ink-soft">${esc(d.street)} ${esc(d.number)}${d.floor ? `, ${esc(d.floor)}` : ''}</p><p class="text-ink-soft">${esc(d.city)}, ${esc(d.province)} (${esc(d.zip)})</p>`;
}

function render(order, query) {
  const [ic, tone, title, text] = hero(order);
  const contact = state.config.contact;
  const mpFlag = query.get('mp');
  const notices = [];
  if (mpFlag === 'no-disponible') notices.push(notice('No pudimos conectar con Mercado Pago. Tu pedido quedó reservado: probá pagar de nuevo en unos minutos.', 'error'));

  return `
    <div class="wrap max-w-4xl pt-10 sm:pt-14">
      ${notices.join('')}
      <section class="text-center ${notices.length ? 'mt-8' : ''}">
        <div class="mx-auto grid size-16 place-items-center rounded-full ${tone}">${icon(ic, 'size-8')}</div>
        <p class="eyebrow mt-6">Pedido #${order.number}</p>
        <h1 class="mx-auto mt-3 max-w-2xl font-display text-4xl leading-[1.05] sm:text-5xl">${title}</h1>
        <p class="mx-auto mt-4 max-w-lg text-ink-soft">${text}</p>
        ${order.canPay ? `<button type="button" class="btn btn-dark btn-lg mt-7" data-pay>${icon('card', 'size-5')} ${['rejected', 'cancelled'].includes(order.payment.status) ? 'Intentar de nuevo' : 'Pagar'} ${money(order.total)}</button>` : ''}
        ${order.trackingCode ? `
          <div class="mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-line bg-paper py-2 pr-2 pl-5">
            <span class="text-sm text-ink-soft">Seguimiento</span>
            <span class="font-semibold tabular-nums select-all">${esc(order.trackingCode)}</span>
            <button type="button" class="btn btn-butter btn-sm" data-copy="${esc(order.trackingCode)}">${icon('copy', 'size-4')} Copiar</button>
          </div>` : ''}
      </section>

      ${steps(order)}

      <div class="mt-12 grid gap-6 ${order.payment.method === 'transferencia' && order.status === 'pendiente' ? '' : ''}">
        ${transferBox(order)}

        <section class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-7" aria-labelledby="detail-title">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="detail-title" class="font-display text-2xl">Detalle del pedido</h2>
            <p class="text-sm text-ink-soft">${formatDate(order.createdAt, { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
          <ul class="mt-4 divide-y divide-line">
            ${order.items.map((item) => `
              <li class="flex items-center gap-4 py-3.5">
                ${thumb(item, 'size-16')}
                <div class="min-w-0 flex-1">
                  <p class="font-semibold">${esc(item.name)}</p>
                  <p class="text-sm text-ink-soft">${item.color ? `${esc(item.color)} · ` : ''}${item.quantity} × ${money(item.unitPrice)}</p>
                </div>
                <p class="font-semibold tabular-nums">${money(item.unitPrice * item.quantity)}</p>
              </li>`).join('')}
          </ul>
          <dl class="mt-2 space-y-2 border-t border-line pt-4 text-[15px]">
            <div class="flex justify-between"><dt class="text-ink-soft">Subtotal</dt><dd class="tabular-nums">${money(order.subtotal)}</dd></div>
            ${order.discount ? `<div class="flex justify-between text-ok"><dt>Descuento transferencia</dt><dd class="tabular-nums">−${money(order.discount)}</dd></div>` : ''}
            <div class="flex justify-between"><dt class="text-ink-soft">${order.delivery.method === 'retiro' ? 'Retiro' : 'Envío'}</dt><dd class="tabular-nums">${order.shipping ? money(order.shipping) : order.delivery.method === 'retiro' ? 'Sin cargo' : 'Gratis'}</dd></div>
            <div class="flex items-baseline justify-between border-t border-line pt-3"><dt class="font-semibold">Total</dt><dd class="text-2xl font-semibold tabular-nums">${money(order.total)}</dd></div>
          </dl>
          <div class="mt-6 grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-3">
            <div><p class="eyebrow mb-2">Entrega</p>${deliveryText(order)}</div>
            <div><p class="eyebrow mb-2">Pago</p><p>${order.payment.method === 'transferencia' ? 'Transferencia bancaria' : 'Mercado Pago'}</p>${order.payment.detail ? `<p class="text-ink-soft">${esc(order.payment.detail)}</p>` : ''}</div>
            <div><p class="eyebrow mb-2">Contacto</p><p>${esc(order.customer.name)}</p><p class="break-all text-ink-soft">${esc(order.customer.email)}</p><p class="text-ink-soft">${esc(order.customer.phone)}</p></div>
          </div>
        </section>

        <section class="flex flex-col items-center justify-between gap-4 rounded-[1.75rem] bg-butter-100 p-5 text-center sm:flex-row sm:p-6 sm:text-left">
          <div>
            <p class="font-semibold">Guardá este link</p>
            <p class="text-sm text-ink-soft">Es el comprobante de tu pedido y te sirve para seguirlo.</p>
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            <button type="button" class="btn btn-ghost btn-sm bg-paper" data-copy-link>${icon('copy', 'size-4')} Copiar link</button>
            ${contact.whatsapp ? `<a href="${whatsappUrl(contact.whatsapp, `Hola! Tengo una consulta sobre mi pedido #${order.number}.`)}" target="_blank" rel="noopener" class="btn btn-dark btn-sm">${icon('chat', 'size-4')} ¿Dudas? Escribinos</a>` : ''}
          </div>
        </section>
      </div>
    </div>`;
}

export async function orderView({ params, query, isCurrent }) {
  const token = params[0];
  const paymentId = query.get('payment_id') || query.get('collection_id');
  let order;
  try {
    order = await api('GET', `/api/orders/${encodeURIComponent(token)}${paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : ''}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    return {
      title: 'Tu pedido',
      html: `<div class="wrap max-w-xl py-20">${notice(esc(error.message), 'error')}<a href="/pedido/${encodeURIComponent(token)}" class="btn btn-dark mt-6">Reintentar</a></div>`,
    };
  }

  return {
    title: `Pedido #${order.number}`,
    html: render(order, query),
    mount(root) {
      let timer = null;
      let attempts = 0;
      const onClick = async (event) => {
        const copy = event.target.closest('[data-copy]');
        if (copy) {
          const ok = await copyText(copy.dataset.copy);
          toast(ok ? 'Copiado' : 'No se pudo copiar: seleccioná el texto', { tone: ok ? 'default' : 'error' });
          return;
        }
        if (event.target.closest('[data-copy-link]')) {
          const ok = await copyText(absoluteUrl(`/pedido/${order.token}`));
          toast(ok ? 'Link copiado' : 'No se pudo copiar el link', { tone: ok ? 'default' : 'error' });
          return;
        }
        const pay = event.target.closest('[data-pay]');
        if (pay) {
          pay.disabled = true;
          pay.innerHTML = '<span class="size-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream"></span> Conectando…';
          try {
            const result = await api('POST', `/api/orders/${encodeURIComponent(order.token)}/pay`);
            window.location.href = result.redirect;
          } catch (error) {
            toast(error.message, { tone: 'error' });
            pay.disabled = false;
            pay.textContent = 'Intentar de nuevo';
          }
        }
      };
      root.addEventListener('click', onClick);

      // Si volvió de Mercado Pago y el pago todavía no se confirmó, se consulta cada 4 segundos.
      const shouldPoll = () =>
        order.status === 'pendiente' && order.payment.method === 'mercadopago' &&
        (['ok', 'pendiente'].includes(query.get('mp')) || WAITING.includes(order.payment.status));
      const poll = async () => {
        if (!isCurrent() || attempts++ > 15) return;
        try {
          const fresh = await api('GET', `/api/orders/${encodeURIComponent(order.token)}`);
          if (!isCurrent()) return;
          if (fresh.status !== order.status || fresh.payment.status !== order.payment.status) {
            order = fresh;
            root.innerHTML = render(order, query);
          }
        } catch {
          /* se reintenta en la próxima vuelta */
        }
        if (shouldPoll()) timer = setTimeout(poll, 4000);
      };
      if (shouldPoll()) timer = setTimeout(poll, 3000);

      return () => {
        clearTimeout(timer);
        root.removeEventListener('click', onClick);
      };
    },
  };
}

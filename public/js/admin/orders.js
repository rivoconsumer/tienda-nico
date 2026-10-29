import { icon } from '../icons.js';
import { esc, money, thumb, toast, copyText, formatDate } from '../ui.js';
import {
  adminApi, STATUS, STATUS_ORDER, PAYMENT_STATUS, statusBadge, paymentLabel, relativeDate, customerWhatsapp,
  openDrawer, closeDrawer, drawerHeader, confirmButton, emptyState, setPendingCount, storeLink, storeTarget,
} from './common.js';

const TABS = [['', 'Todos'], ...STATUS_ORDER.map((s) => [s, STATUS[s].short])];

function filtersFrom(params) {
  return { estado: params.get('estado') ?? '', q: params.get('q') ?? '', p: Number(params.get('p')) || 1 };
}

function hashFor({ estado, q, p }, id = '') {
  const qs = new URLSearchParams();
  if (estado) qs.set('estado', estado);
  if (q) qs.set('q', q);
  if (p > 1) qs.set('p', String(p));
  const query = qs.toString();
  return `#pedidos${id ? `/${id}` : ''}${query ? `?${query}` : ''}`;
}

function paymentCell(o) {
  const status = o.paymentStatus ? PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus : o.paymentMethod === 'transferencia' ? 'A confirmar' : 'Sin pago';
  return `<span class="block text-sm">${paymentLabel(o.paymentMethod)}</span><span class="block text-xs text-ink-soft">${esc(status)}</span>`;
}

function listHtml(data, filters) {
  const exportUrl = `/api/admin/orders.csv?${new URLSearchParams({ ...(filters.estado ? { status: filters.estado } : {}), ...(filters.q ? { q: filters.q } : {}) })}`;
  const tabs = TABS.map(([value, label]) => {
    const count = value ? data.counts[value] : Object.values(data.counts).reduce((a, b) => a + b, 0);
    const active = filters.estado === value;
    return `<a href="${hashFor({ ...filters, estado: value, p: 1 })}" class="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'border-ink bg-ink text-cream' : 'border-line bg-paper hover:border-ink/30'}" ${active ? 'aria-current="page"' : ''}>${label}<span class="${active ? 'text-cream/60' : 'text-ink-faint'} tabular-nums">${count}</span></a>`;
  }).join('');

  const rows = data.orders.map((o) => `
    <tr class="cursor-pointer transition-colors hover:bg-butter-50" data-row="${o.id}">
      <td class="py-3.5 pr-3 pl-5">
        <a href="${hashFor(filters, o.id)}" class="font-semibold tabular-nums hover:underline">#${o.id}</a>
        <span class="block text-xs text-ink-soft">${relativeDate(o.createdAt)}</span>
      </td>
      <td class="max-w-56 px-3 py-3.5">
        <span class="block truncate font-medium">${esc(o.customerName)}</span>
        <span class="block truncate text-xs text-ink-soft">${esc(o.customerEmail)}</span>
      </td>
      <td class="max-w-64 px-3 py-3.5"><span class="line-clamp-2 text-ink-soft">${esc(o.summary)}</span></td>
      <td class="px-3 py-3.5 text-sm">${o.deliveryMethod === 'retiro' ? 'Retiro' : `Envío<span class="block text-xs text-ink-soft">${esc(o.city ?? '')}</span>`}</td>
      <td class="px-3 py-3.5">${paymentCell(o)}</td>
      <td class="px-3 py-3.5 text-right font-semibold tabular-nums">${money(o.total)}</td>
      <td class="py-3.5 pr-5 pl-3"><div class="flex flex-col items-start gap-1">${statusBadge(o.status)}${o.regret ? `<span class="chip bg-bad-soft text-bad">${icon('undo', 'size-3')} Arrepentimiento</span>` : ''}</div></td>
    </tr>`).join('');

  const cards = data.orders.map((o) => `
    <li>
      <a href="${hashFor(filters, o.id)}" class="block rounded-2xl border border-line bg-paper p-4 active:bg-butter-50">
        <div class="flex items-center justify-between gap-3">
          <span class="font-semibold tabular-nums">#${o.id}</span>
          ${statusBadge(o.status)}
        </div>
        <p class="mt-2 font-medium">${esc(o.customerName)}</p>
        <p class="line-clamp-1 text-sm text-ink-soft">${esc(o.summary)}</p>
        <div class="mt-3 flex items-center justify-between text-sm">
          <span class="text-ink-soft">${relativeDate(o.createdAt)} · ${paymentLabel(o.paymentMethod)}</span>
          <span class="font-semibold tabular-nums">${money(o.total)}</span>
        </div>
        ${o.regret ? `<p class="mt-2"><span class="chip bg-bad-soft text-bad">${icon('undo', 'size-3')} Arrepentimiento</span></p>` : ''}
      </a>
    </li>`).join('');

  const empty = filters.q || filters.estado
    ? emptyState({ iconName: 'search', title: 'No hay pedidos con ese filtro', text: 'Probá con otro estado o buscá por nombre, email o número.' })
    : emptyState({ iconName: 'list', title: 'Todavía no hay pedidos', text: 'Cuando alguien compre en tu tienda, el pedido aparece acá con todos sus datos.' });

  return `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-4xl leading-none sm:text-5xl">Pedidos</h1>
        <p class="mt-2 text-ink-soft">${data.total} ${data.total === 1 ? 'pedido' : 'pedidos'}${filters.estado || filters.q ? ' con este filtro' : ''}</p>
      </div>
      <a href="${exportUrl}" class="btn btn-ghost btn-sm" download>${icon('download', 'size-4')} Exportar a Excel (CSV)</a>
    </div>
    <div class="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
      <nav class="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" aria-label="Filtrar por estado">${tabs}</nav>
      <form class="relative lg:ml-auto lg:w-72" data-search role="search">
        <label for="order-search" class="sr-only">Buscar pedidos</label>
        <span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint">${icon('search', 'size-4')}</span>
        <input id="order-search" name="q" type="search" class="input h-10 rounded-full pl-10 text-sm" placeholder="Nombre, email o número" value="${esc(filters.q)}">
      </form>
    </div>
    <div class="mt-5">
      ${data.orders.length ? `
        <div class="hidden overflow-x-auto rounded-[1.5rem] border border-line bg-paper md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-line text-left text-xs text-ink-soft">
                <th class="py-3 pr-3 pl-5 font-medium">Pedido</th><th class="px-3 py-3 font-medium">Cliente</th><th class="px-3 py-3 font-medium">Productos</th>
                <th class="px-3 py-3 font-medium">Entrega</th><th class="px-3 py-3 font-medium">Pago</th><th class="px-3 py-3 text-right font-medium">Total</th><th class="py-3 pr-5 pl-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">${rows}</tbody>
          </table>
        </div>
        <ul class="space-y-3 md:hidden">${cards}</ul>
        ${data.pages > 1 ? `
          <nav class="mt-5 flex items-center justify-between text-sm" aria-label="Páginas">
            <span class="text-ink-soft">Página ${data.page} de ${data.pages}</span>
            <span class="flex gap-2">
              ${data.page > 1 ? `<a class="btn btn-ghost btn-sm" href="${hashFor({ ...filters, p: data.page - 1 })}">${icon('arrowLeft', 'size-4')} Anterior</a>` : ''}
              ${data.page < data.pages ? `<a class="btn btn-ghost btn-sm" href="${hashFor({ ...filters, p: data.page + 1 })}">Siguiente ${icon('arrowRight', 'size-4')}</a>` : ''}
            </span>
          </nav>` : ''}` : empty}
    </div>`;
}

// ── Detalle del pedido ───────────────────────────────────────
function addressText(o) {
  const d = o.delivery;
  return [`${d.street} ${d.number}${d.floor ? `, ${d.floor}` : ''}`, `${d.city}, ${d.province}`, `CP ${d.zip}`].join('\n');
}

const EVENT_ICONS = { creado: 'sparkle', pago: 'card', estado: 'refresh', envio: 'truck', alerta: 'alert', arrepentimiento: 'undo' };

function detailHtml(o, session) {
  const wa = customerWhatsapp(o.customer.phone);
  const regret = o.events.some((e) => e.kind === 'arrepentimiento');
  const alerts = o.events.filter((e) => e.kind === 'alerta' || e.kind === 'arrepentimiento');
  return `
    ${drawerHeader(`Pedido #${o.number}`, formatDate(o.createdAt, { dateStyle: 'full', timeStyle: 'short' }))}
    <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
      ${alerts.length ? `<div class="mb-6 space-y-2">${alerts.slice(-3).map((e) => `<p class="flex gap-2 rounded-2xl ${e.kind === 'arrepentimiento' ? 'bg-bad-soft text-bad' : 'bg-wait-soft text-wait'} p-3 text-sm font-medium">${icon(EVENT_ICONS[e.kind], 'size-5 shrink-0')}<span>${esc(e.message)}</span></p>`).join('')}</div>` : ''}

      <form class="rounded-2xl border border-line bg-paper p-4 sm:p-5" data-order-form>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="order-status" class="label">Estado</label>
            <select id="order-status" name="status" class="input">
              ${STATUS_ORDER.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS[s].label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="order-tracking" class="label">Código de seguimiento</label>
            <input id="order-tracking" name="trackingCode" class="input" value="${esc(o.trackingCode ?? '')}" placeholder="Correo Argentino, Andreani…">
          </div>
          <div class="sm:col-span-2">
            <label for="order-notes" class="label">Notas internas <span class="font-normal text-ink-faint">(solo las ves vos)</span></label>
            <textarea id="order-notes" name="adminNotes" class="input" rows="2" placeholder="Por ejemplo: despachado el martes, pidió envoltorio de regalo">${esc(o.adminNotes ?? '')}</textarea>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-ink-soft">${o.stockDeducted ? 'El stock de este pedido ya está descontado.' : 'El stock se descuenta cuando el pedido pasa a Pagado.'}</p>
          <button type="submit" class="btn btn-dark btn-sm">${icon('check', 'size-4')} Guardar cambios</button>
        </div>
      </form>

      <section class="mt-6" aria-label="Productos">
        <ul class="divide-y divide-line rounded-2xl border border-line bg-paper px-4 sm:px-5">
          ${o.items.map((item) => `
            <li class="flex items-center gap-3 py-3">
              ${thumb(item, 'size-12')}
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">${esc(item.name)}</p>
                <p class="text-xs text-ink-soft">${item.color ? `${esc(item.color)} · ` : ''}${item.quantity} × ${money(item.unitPrice)}</p>
              </div>
              <p class="font-semibold tabular-nums">${money(item.unitPrice * item.quantity)}</p>
            </li>`).join('')}
          <li class="space-y-1.5 py-4 text-sm">
            <div class="flex justify-between"><span class="text-ink-soft">Subtotal</span><span class="tabular-nums">${money(o.subtotal)}</span></div>
            ${o.discount ? `<div class="flex justify-between text-ok"><span>Descuento transferencia</span><span class="tabular-nums">−${money(o.discount)}</span></div>` : ''}
            <div class="flex justify-between"><span class="text-ink-soft">${o.delivery.method === 'retiro' ? 'Retiro' : 'Envío'}</span><span class="tabular-nums">${o.shipping ? money(o.shipping) : 'Sin cargo'}</span></div>
            <div class="flex justify-between pt-1 text-base font-semibold"><span>Total</span><span class="tabular-nums">${money(o.total)}</span></div>
          </li>
        </ul>
      </section>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <section class="rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <h3 class="eyebrow">Cliente</h3>
          <p class="mt-3 font-semibold">${esc(o.customer.name)}</p>
          <p class="mt-1 text-sm break-all"><a class="link" href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></p>
          <p class="mt-1 text-sm">${esc(o.customer.phone)}</p>
          ${o.customer.dni ? `<p class="mt-1 text-sm text-ink-soft">DNI ${esc(o.customer.dni)}</p>` : ''}
          ${wa ? `<a href="${wa}?text=${encodeURIComponent(`Hola ${o.customer.name.split(' ')[0]}! Te escribo de ${session.storeName} por tu pedido #${o.number}.`)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm mt-3">${icon('chat', 'size-4')} WhatsApp</a>` : ''}
        </section>
        <section class="rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <h3 class="eyebrow">Entrega</h3>
          ${o.delivery.method === 'retiro'
            ? `<p class="mt-3 font-semibold">Retira en el taller</p><p class="mt-1 text-sm text-ink-soft">${esc(o.delivery.pickupAddress ?? '')}</p>`
            : `<p class="mt-3 font-semibold">Envío a domicilio</p><p class="mt-1 text-sm whitespace-pre-line">${esc(addressText(o))}</p>
               <button type="button" class="btn btn-ghost btn-sm mt-3" data-copy-address>${icon('copy', 'size-4')} Copiar dirección</button>`}
        </section>
        <section class="rounded-2xl border border-line bg-paper p-4 sm:col-span-2 sm:p-5">
          <h3 class="eyebrow">Pago</h3>
          <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-semibold">${paymentLabel(o.payment.method)}${o.payment.status ? ` · ${esc(PAYMENT_STATUS[o.payment.status] ?? o.payment.status)}` : ''}</p>
              ${o.payment.detail ? `<p class="mt-1 text-sm text-ink-soft">${esc(o.payment.detail)}</p>` : ''}
              ${o.payment.id ? `<p class="mt-1 text-xs text-ink-soft">ID de pago: <span class="select-all tabular-nums">${esc(o.payment.id)}</span></p>` : ''}
              ${o.payment.method === 'transferencia' && o.status === 'pendiente' ? '<p class="mt-2 text-sm">Cuando recibas la transferencia, cambiá el estado a <b>Pagado</b>.</p>' : ''}
            </div>
            ${o.payment.method === 'mercadopago' && session.paymentMode !== 'demo' ? `<button type="button" class="btn btn-ghost btn-sm" data-sync>${icon('sync', 'size-4')} Consultar en Mercado Pago</button>` : ''}
          </div>
        </section>
        ${o.notes ? `
          <section class="rounded-2xl border border-butter-300 bg-butter-50 p-4 sm:col-span-2 sm:p-5">
            <h3 class="eyebrow">Nota del cliente</h3>
            <p class="mt-2 text-sm whitespace-pre-line">${esc(o.notes)}</p>
          </section>` : ''}
      </div>

      <section class="mt-6" aria-labelledby="history-title">
        <h3 id="history-title" class="eyebrow">Historial</h3>
        <ol class="mt-3 space-y-0">
          ${[...o.events].reverse().map((e, i, list) => `
            <li class="relative flex gap-3 pb-4">
              ${i < list.length - 1 ? '<span class="absolute top-7 bottom-0 left-[13px] w-px bg-line" aria-hidden="true"></span>' : ''}
              <span class="grid size-7 shrink-0 place-items-center rounded-full ${e.kind === 'alerta' || e.kind === 'arrepentimiento' ? 'bg-bad-soft text-bad' : 'bg-butter-100 text-ink'}">${icon(EVENT_ICONS[e.kind] ?? 'info', 'size-3.5')}</span>
              <div class="min-w-0 pt-0.5">
                <p class="text-sm">${esc(e.message)}</p>
                <p class="text-xs text-ink-soft">${relativeDate(e.at)}</p>
              </div>
            </li>`).join('')}
        </ol>
      </section>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <a href="${storeLink(`/pedido/${encodeURIComponent(o.token)}`)}" target="${storeTarget()}" rel="noopener" class="text-sm font-semibold text-ink-soft hover:text-ink">${icon('external', 'size-4 inline -mt-0.5')} Ver como lo ve el cliente</a>
        <button type="button" class="btn btn-danger btn-sm" data-delete>${icon('trash', 'size-4')} Eliminar pedido</button>
      </div>
    </div>`;
}

async function openOrder(id, { filters, go, session, refreshList }) {
  let order;
  try {
    order = await adminApi('GET', `/api/admin/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    toast(error.message, { tone: 'error' });
    go(hashFor(filters), { replace: true });
    return;
  }
  const panel = openDrawer({
    label: `Pedido #${order.number}`,
    html: detailHtml(order, session),
    onClose: () => go(hashFor(filters)),
  });

  const rerender = (fresh) => {
    order = fresh;
    const scroller = panel.querySelector('.overflow-y-auto');
    const top = scroller?.scrollTop ?? 0;
    panel.innerHTML = detailHtml(order, session);
    bind();
    panel.querySelector('.overflow-y-auto').scrollTop = top;
  };

  const bind = () => {
    panel.querySelector('[data-order-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const fresh = await adminApi('PATCH', `/api/admin/orders/${order.id}`, {
          status: form.status.value,
          trackingCode: form.trackingCode.value,
          adminNotes: form.adminNotes.value,
        });
        toast('Cambios guardados');
        rerender(fresh);
        refreshList();
      } catch (error) {
        toast(error.message, { tone: 'error' });
        button.disabled = false;
      }
    });
    panel.querySelector('[data-copy-address]')?.addEventListener('click', async () => {
      const text = `${order.customer.name}\n${addressText(order)}\nTel: ${order.customer.phone}${order.customer.dni ? `\nDNI: ${order.customer.dni}` : ''}`;
      toast((await copyText(text)) ? 'Dirección copiada para la etiqueta' : 'No se pudo copiar', {});
    });
    panel.querySelector('[data-sync]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await adminApi('POST', `/api/admin/orders/${order.id}/sync`);
        toast(result.found ? `Se revisaron ${result.found} pagos en Mercado Pago` : 'Mercado Pago no tiene pagos para este pedido');
        rerender(result.order);
        refreshList();
      } catch (error) {
        toast(error.message, { tone: 'error' });
        button.disabled = false;
      }
    });
    confirmButton(panel.querySelector('[data-delete]'), {
      confirmLabel: '¿Eliminar? Tocá de nuevo',
      onConfirm: async () => {
        await adminApi('DELETE', `/api/admin/orders/${order.id}`);
        toast(`Pedido #${order.number} eliminado`);
        closeDrawer();
        refreshList();
      },
    });
  };
  bind();
}

export async function ordersView({ main, id, params, sameSection, go, session }) {
  const filters = filtersFrom(params);
  const load = async () => {
    const data = await adminApi('GET', `/api/admin/orders?${new URLSearchParams({ status: filters.estado, q: filters.q, page: String(filters.p) })}`);
    setPendingCount(data.counts.pendiente);
    return data;
  };

  const render = async () => {
    const data = await load();
    main.innerHTML = listHtml(data, filters);
    main.querySelector('[data-search]').addEventListener('submit', (event) => {
      event.preventDefault();
      go(hashFor({ ...filters, q: event.currentTarget.q.value.trim(), p: 1 }));
    });
    main.querySelector('#order-search').addEventListener('search', (event) => {
      if (!event.target.value) go(hashFor({ ...filters, q: '', p: 1 }));
    });
    main.querySelectorAll('[data-row]').forEach((row) =>
      row.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        go(hashFor(filters, row.dataset.row));
      }),
    );
  };

  // Al abrir o cerrar un pedido no hace falta volver a dibujar la lista.
  const listKey = hashFor(filters);
  if (!sameSection || main.dataset.listKey !== listKey) {
    await render();
    main.dataset.listKey = listKey;
  }
  if (id) await openOrder(id, { filters, go, session, refreshList: render });
  else closeDrawer({ silent: true });
}

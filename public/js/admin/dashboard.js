import { icon } from '../icons.js';
import { esc, money } from '../ui.js';
import { adminApi, statusBadge, relativeDate, setPendingCount, emptyState } from './common.js';

// Montos cortos para el eje: $500 mil, $1,5 M
const compactMoney = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil`;
  return `$${n.toLocaleString('es-AR')}`;
};
const monthName = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('es-AR', { month: 'long' });
};

function statTile({ label, value, foot = '', tone = 'text-ink-soft', href }) {
  const tag = href ? 'a' : 'div';
  return `
    <${tag} ${href ? `href="${href}"` : ''} class="rounded-2xl border border-line bg-paper p-5 ${href ? 'transition-colors hover:border-ink/30' : ''}">
      <p class="text-sm text-ink-soft">${label}</p>
      <p class="mt-2 text-[28px] leading-none font-semibold">${value}</p>
      ${foot ? `<p class="mt-3 flex items-center gap-1 text-xs font-medium ${tone}">${foot}</p>` : ''}
    </${tag}>`;
}

function salesDelta(month) {
  if (month.previousTotal > 0) {
    const pct = Math.round(((month.total - month.previousTotal) / month.previousTotal) * 100);
    if (pct === 0) return { foot: `Igual que en ${monthName(-1)}`, tone: 'text-ink-soft' };
    const up = pct > 0;
    return {
      foot: `${icon(up ? 'arrowRight' : 'arrowRight', `size-3.5 ${up ? '-rotate-45' : 'rotate-45'}`)}${up ? '+' : '−'}${Math.abs(pct)}% vs. ${monthName(-1)}`,
      tone: up ? 'text-ok' : 'text-bad',
    };
  }
  return { foot: month.total > 0 ? `Sin ventas en ${monthName(-1)} para comparar` : 'Todavía sin ventas este mes', tone: 'text-ink-soft' };
}

function checklistCard(items) {
  const pending = items.filter((i) => !i.done);
  if (!pending.length) return '';
  const done = items.length - pending.length;
  return `
    <section class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6" aria-labelledby="setup-title">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-title" class="font-display text-2xl">Dejá tu tienda lista</h2>
        <p class="text-sm text-ink-soft">${done} de ${items.length} pasos listos</p>
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-butter-100"><div class="h-full rounded-full bg-honey" style="width:${Math.round((done / items.length) * 100)}%"></div></div>
      <ul class="mt-4 divide-y divide-line">
        ${items.map((item) => `
          <li class="flex gap-3 py-3.5">
            <span class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${item.done ? 'bg-ok-soft text-ok' : 'border-2 border-dashed border-butter-500'}">${item.done ? icon('check', 'size-3.5') : ''}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold ${item.done ? 'text-ink-soft line-through decoration-ink/20' : ''}">${esc(item.title)}</p>
              ${item.done ? '' : `<p class="mt-0.5 text-sm text-ink-soft">${esc(item.text)}</p>`}
            </div>
            ${!item.done && item.action ? `<a href="#${item.action}" class="btn btn-ghost btn-sm shrink-0 self-center">Ir</a>` : ''}
          </li>`).join('')}
      </ul>
    </section>`;
}

// ── Gráfico de ventas (columnas, una sola serie) ─────────────
function niceStep(x) {
  if (x <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(x));
  const f = x / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
}

const dayLabel = (iso, withMonth) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return withMonth ? date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '') : String(d);
};
const longDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

function drawChart(holder, days) {
  const width = Math.max(holder.clientWidth, 280);
  const height = 248;
  const m = { top: 26, right: 6, bottom: 30, left: 58 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const max = Math.max(...days.map((d) => d.total), 0);
  const step = niceStep((max || 30000) / 3);
  const top = step * Math.max(Math.ceil((max || 1) / step), 1);
  const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  const band = plotW / days.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v) => m.top + plotH - (v / top) * plotH;
  const everyOther = band < 34;
  const maxIndex = max > 0 ? days.findIndex((d) => d.total === max) : -1;

  const grid = ticks.map((v) => `
    <line x1="${m.left}" x2="${width - m.right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--color-line)" stroke-width="1" shape-rendering="crispEdges"/>
    <text x="${m.left - 10}" y="${y(v)}" dy="0.32em" text-anchor="end" class="fill-ink-soft text-[11px] tabular-nums">${v === 0 ? '$0' : compactMoney(v)}</text>`).join('');

  const bars = days.map((d, i) => {
    const x = m.left + i * band + (band - barW) / 2;
    const h = (d.total / top) * plotH;
    const showLabel = everyOther ? i % 2 === (days.length - 1) % 2 : true;
    const prev = days[i - 1];
    const withMonth = i === 0 || (prev && prev.date.slice(5, 7) !== d.date.slice(5, 7));
    let bar = '';
    if (h > 0) {
      const r = Math.min(4, h, barW / 2);
      const yy = m.top + plotH - h;
      bar = `<path d="M${x},${yy + h}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + barW - r}Q${x + barW},${yy} ${x + barW},${yy + r}V${yy + h}Z" class="fill-honey transition-opacity" data-bar="${i}"/>`;
    }
    return `
      ${bar}
      ${i === maxIndex ? `<text x="${x + barW / 2}" y="${y(d.total) - 8}" text-anchor="middle" class="fill-ink text-[11px] font-semibold">${compactMoney(d.total)}</text>` : ''}
      ${showLabel || withMonth ? `<text x="${m.left + i * band + band / 2}" y="${height - 10}" text-anchor="middle" class="fill-ink-soft text-[11px] tabular-nums">${dayLabel(d.date, withMonth && i === 0)}</text>` : ''}
      <rect x="${m.left + i * band}" y="${m.top}" width="${band}" height="${plotH}" fill="transparent" tabindex="0" class="outline-none" data-hit="${i}" aria-label="${longDay(d.date)}: ${money(d.total)}, ${d.orders} ${d.orders === 1 ? 'pedido' : 'pedidos'}"/>`;
  }).join('');

  holder.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="block" role="group" aria-label="Ventas por día de los últimos 14 días">
      ${grid}
      <line x1="${m.left}" x2="${width - m.right}" y1="${y(0)}" y2="${y(0)}" stroke="var(--color-ink-faint)" stroke-width="1" shape-rendering="crispEdges"/>
      ${bars}
    </svg>
    <div class="pointer-events-none absolute z-10 hidden min-w-36 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-cream shadow-float" data-tip>
      <p class="text-[15px] font-semibold" data-tip-value></p>
      <p class="text-xs text-cream/70" data-tip-label></p>
    </div>
    ${max === 0 ? `<p class="pointer-events-none absolute inset-x-0 top-[42%] text-center text-sm text-ink-soft">Todavía no hay ventas en estos días</p>` : ''}`;

  const tip = holder.querySelector('[data-tip]');
  const show = (i) => {
    const d = days[i];
    holder.querySelectorAll('[data-bar]').forEach((b) => b.classList.toggle('opacity-45', b.dataset.bar !== String(i)));
    tip.querySelector('[data-tip-value]').textContent = money(d.total);
    tip.querySelector('[data-tip-label]').textContent = `${longDay(d.date)} · ${d.orders} ${d.orders === 1 ? 'pedido' : 'pedidos'}`;
    const cx = m.left + i * band + band / 2;
    tip.style.left = `${Math.min(Math.max(cx, 80), width - 80)}px`;
    tip.style.top = `${Math.max(y(d.total) - 10, 34)}px`;
    tip.classList.remove('hidden');
  };
  const hide = () => {
    tip.classList.add('hidden');
    holder.querySelectorAll('[data-bar]').forEach((b) => b.classList.remove('opacity-45'));
  };
  holder.querySelectorAll('[data-hit]').forEach((rect) => {
    const i = Number(rect.dataset.hit);
    rect.addEventListener('pointerenter', () => show(i));
    rect.addEventListener('focus', () => show(i));
    rect.addEventListener('pointerleave', hide);
    rect.addEventListener('blur', hide);
  });
}

function chartTable(days) {
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-line text-left text-xs text-ink-soft"><th class="py-2 font-medium">Día</th><th class="py-2 text-right font-medium">Ventas</th><th class="py-2 text-right font-medium">Pedidos</th></tr></thead>
        <tbody class="divide-y divide-line">
          ${days.map((d) => `<tr><td class="py-2 capitalize">${longDay(d.date)}</td><td class="py-2 text-right tabular-nums">${money(d.total)}</td><td class="py-2 text-right tabular-nums">${d.orders}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export async function dashboardView({ main }) {
  const data = await adminApi('GET', '/api/admin/dashboard');
  const { stats, recent, checklist } = data;
  setPendingCount(stats.pendingPayment);
  const delta = salesDelta(stats.month);
  const total14 = stats.last14.reduce((sum, d) => sum + d.total, 0);
  const orders14 = stats.last14.reduce((sum, d) => sum + d.orders, 0);
  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  main.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-4xl leading-none sm:text-5xl">Resumen</h1>
        <p class="mt-2 text-ink-soft first-letter:uppercase">${today}</p>
      </div>
      <a href="#productos/nuevo" class="btn btn-dark btn-sm">${icon('plus', 'size-4')} Nuevo producto</a>
    </div>

    <div class="mt-8 space-y-6">
      ${stats.regretRequests ? `
        <a href="#pedidos" class="flex items-start gap-3 rounded-2xl bg-bad-soft p-4 text-bad">
          ${icon('undo', 'size-5 shrink-0 mt-0.5')}
          <span><b>${stats.regretRequests} ${stats.regretRequests === 1 ? 'pedido tiene' : 'pedidos tienen'} una solicitud de arrepentimiento.</b> Respondé dentro de las 24 horas. Lo vas a ver marcado en la lista de pedidos.</span>
        </a>` : ''}

      ${checklistCard(checklist)}

      <section class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores del mes">
        ${statTile({ label: `Ventas de ${monthName()}`, value: money(stats.month.total), ...delta })}
        ${statTile({ label: 'Pedidos pagados', value: String(stats.month.orders), foot: `en ${monthName()}` })}
        ${statTile({ label: 'Ticket promedio', value: money(stats.month.average), foot: 'por pedido pagado' })}
        ${statTile({ label: 'Para despachar', value: String(stats.toShip), foot: stats.toShip ? `Ver pedidos ${icon('arrowRight', 'size-3.5')}` : 'Todo al día', tone: stats.toShip ? 'text-ink' : 'text-ok', href: '#pedidos?estado=pagado' })}
      </section>

      <section class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6" aria-labelledby="chart-title">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="chart-title" class="font-display text-2xl">Ventas de los últimos 14 días</h2>
            <p class="mt-1 text-sm text-ink-soft">${money(total14)} en ${orders14} ${orders14 === 1 ? 'pedido pagado' : 'pedidos pagados'}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-table aria-pressed="false">${icon('list', 'size-4')} Ver como tabla</button>
        </div>
        <div class="relative mt-5" data-chart></div>
        <div class="mt-5" data-chart-table hidden>${chartTable(stats.last14)}</div>
      </section>

      <div class="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6" aria-labelledby="recent-title">
          <div class="flex items-center justify-between">
            <h2 id="recent-title" class="font-display text-2xl">Últimos pedidos</h2>
            <a href="#pedidos" class="text-sm font-semibold text-ink-soft hover:text-ink">Ver todos</a>
          </div>
          ${recent.length ? `
            <ul class="mt-3 divide-y divide-line">
              ${recent.map((o) => `
                <li>
                  <a href="#pedidos/${o.id}" class="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-butter-50">
                    <span class="w-14 shrink-0 text-sm font-semibold tabular-nums">#${o.id}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">${esc(o.customerName)}</span>
                      <span class="block text-xs text-ink-soft">${relativeDate(o.createdAt)}</span>
                    </span>
                    <span class="hidden sm:block">${statusBadge(o.status)}</span>
                    <span class="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">${money(o.total)}</span>
                  </a>
                </li>`).join('')}
            </ul>` : `<div class="mt-4">${emptyState({ iconName: 'list', title: 'Todavía no hay pedidos', text: 'Cuando alguien compre en la tienda, el pedido aparece acá.' })}</div>`}
        </section>

        <section class="rounded-[1.75rem] border border-line bg-paper p-5 sm:p-6" aria-labelledby="stock-title">
          <h2 id="stock-title" class="font-display text-2xl">Stock bajo</h2>
          ${stats.lowStock.length ? `
            <ul class="mt-3 divide-y divide-line">
              ${stats.lowStock.map((p) => `
                <li>
                  <a href="#productos/${p.id}" class="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-butter-50">
                    <span class="truncate text-sm font-medium">${esc(p.name)}</span>
                    <span class="chip shrink-0 ${p.stock <= 0 ? 'bg-bad-soft text-bad' : 'bg-wait-soft text-wait'}">${p.stock <= 0 ? 'Sin stock' : `Quedan ${p.stock}`}</span>
                  </a>
                </li>`).join('')}
            </ul>` : `<p class="mt-3 flex items-center gap-2 text-sm text-ok">${icon('check', 'size-4')} Todos los productos tienen stock.</p>`}
        </section>
      </div>
    </div>`;

  const holder = main.querySelector('[data-chart]');
  const draw = () => drawChart(holder, stats.last14);
  draw();
  const observer = new ResizeObserver(() => draw());
  observer.observe(holder);

  const toggle = main.querySelector('[data-toggle-table]');
  toggle.addEventListener('click', () => {
    const table = main.querySelector('[data-chart-table]');
    const showTable = table.hidden;
    table.hidden = !showTable;
    holder.hidden = showTable;
    toggle.setAttribute('aria-pressed', String(showTable));
    toggle.innerHTML = showTable ? `${icon('grid', 'size-4')} Ver gráfico` : `${icon('list', 'size-4')} Ver como tabla`;
    if (!showTable) draw();
  });

  return () => observer.disconnect();
}

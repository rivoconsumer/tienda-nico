import { icon } from '../icons.js';
import { illustration, tileColor } from '../illustrations.js';
import { esc, money, productArt, artBackground, discountPercent } from '../ui.js';

/** Tarjeta de producto para grillas. Los puntitos de color cambian la pieza al pasar el mouse. */
export function productCard(product) {
  const first = product.colors[0];
  const off = discountPercent(product);
  const soldOut = product.stock <= 0;
  const href = `/producto/${esc(product.slug)}`;
  return `
    <article class="group relative" data-card="${product.id}">
      <a href="${href}" class="block rounded-tile focus-visible:outline-offset-4" data-card-link>
        <div class="stitch-in relative grid aspect-[4/5] place-items-center overflow-hidden rounded-tile transition-colors duration-500" style="background-color:${artBackground(product, first?.hex)}" data-card-art>
          ${productArt(product, first?.hex)}
          <div class="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            ${off ? `<span class="chip bg-ink text-cream">−${off}%</span>` : ''}
            ${soldOut ? '<span class="chip bg-paper/95 text-ink">Sin stock</span>' : product.stock <= 3 ? `<span class="chip bg-paper/95 text-ink">Últimas ${product.stock}</span>` : ''}
          </div>
        </div>
        <div class="mt-3.5 flex flex-col gap-1 px-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div class="min-w-0">
            <h3 class="text-[15px] leading-snug font-semibold sm:truncate">${esc(product.name)}</h3>
            <p class="mt-0.5 hidden text-[13px] text-ink-soft sm:block">${esc(product.category)}</p>
          </div>
          <div class="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
            <p class="text-[15px] font-semibold tabular-nums">${money(product.price)}</p>
            ${off ? `<p class="text-xs text-ink-faint tabular-nums line-through">${money(product.compareAtPrice)}</p>` : ''}
          </div>
        </div>
      </a>
      ${product.colors.length > 1 ? `
        <div class="mt-2 flex items-center gap-1 px-0.5" role="group" aria-label="Colores de ${esc(product.name)}">
          ${product.colors.slice(0, 6).map((c, i) => `
            <button type="button" class="group/sw grid size-6 place-items-center rounded-full" data-card-color="${esc(c.name)}" data-hex="${esc(c.hex)}" aria-label="Ver en ${esc(c.name)}" aria-pressed="${i === 0}">
              <span class="size-3.5 rounded-full ring-1 ring-ink/15 outline-offset-2 group-aria-pressed/sw:outline-[1.5px] group-aria-pressed/sw:outline-ink/70" style="background-color:${esc(c.hex)}"></span>
            </button>`).join('')}
          ${product.colors.length > 6 ? `<span class="text-xs text-ink-soft">+${product.colors.length - 6}</span>` : ''}
        </div>` : ''}
    </article>`;
}

/** Activa el cambio de color en las tarjetas dentro de un contenedor. */
export function bindCardColors(root, products) {
  const apply = (button) => {
    const card = button.closest('[data-card]');
    const product = products.find((p) => p.id === Number(card?.dataset.card));
    if (!product || product.imageUrl) return;
    const hex = button.dataset.hex;
    const art = card.querySelector('[data-card-art]');
    art.style.backgroundColor = tileColor(hex);
    const holder = art.firstElementChild;
    if (holder) holder.innerHTML = illustration(product.illustration, hex, product.name);
    card.querySelector('[data-card-link]').href = `/producto/${product.slug}?color=${encodeURIComponent(button.dataset.cardColor)}`;
    card.querySelectorAll('[data-card-color]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  };
  const onOver = (event) => {
    const button = event.target.closest('[data-card-color]');
    if (button) apply(button);
  };
  root.addEventListener('mouseover', onOver);
  root.addEventListener('click', onOver);
  root.addEventListener('focusin', onOver);
  return () => {
    root.removeEventListener('mouseover', onOver);
    root.removeEventListener('click', onOver);
    root.removeEventListener('focusin', onOver);
  };
}

export function breadcrumb(items) {
  return `
    <nav aria-label="Ubicación" class="text-[13px] text-ink-soft">
      <ol class="flex flex-wrap items-center gap-1.5">
        ${items.map((item, i) => `
          <li class="flex items-center gap-1.5">
            ${i > 0 ? icon('chevronRight', 'size-3.5 text-ink-faint') : ''}
            ${item.href ? `<a href="${item.href}" class="hover:text-ink hover:underline">${esc(item.label)}</a>` : `<span class="text-ink" aria-current="page">${esc(item.label)}</span>`}
          </li>`).join('')}
      </ol>
    </nav>`;
}

export function notice(text, tone = 'info') {
  const tones = {
    info: 'bg-butter-100 text-ink',
    error: 'bg-bad-soft text-bad',
    ok: 'bg-ok-soft text-ok',
  };
  const icons = { info: 'info', error: 'alert', ok: 'check' };
  return `<div class="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${tones[tone]}" role="${tone === 'error' ? 'alert' : 'status'}">${icon(icons[tone], 'mt-px size-5 shrink-0')}<div>${text}</div></div>`;
}

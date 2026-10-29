import { state, productBySlug, slugify } from '../store.js';
import { cart } from '../cart.js';
import { icon } from '../icons.js';
import { illustration, tileColor } from '../illustrations.js';
import { esc, money, toast, pickColor, artBackground, discountPercent, whatsappUrl, paragraphs } from '../ui.js';
import { CARE_TEXT, CHANGES_DAYS } from '../content.js';
import { openCart, bumpCartBadge } from '../layout.js';
import { currentUrl, replaceAddress } from '../router-url.js';
import { productCard, bindCardColors, breadcrumb } from './components.js';

function relatedProducts(product) {
  const same = state.products.filter((p) => p.id !== product.id && p.category === product.category && p.stock > 0);
  const others = state.products.filter((p) => p.id !== product.id && p.category !== product.category && p.stock > 0);
  return [...same, ...others].slice(0, 4);
}

function stockText(product, inCart) {
  const available = product.stock - inCart;
  if (product.stock <= 0) return `<span class="text-bad">Sin stock por ahora</span>`;
  if (available <= 0) return `Ya tenés en el carrito todas las unidades disponibles.`;
  if (product.stock <= 3) return `<span class="font-semibold text-ink">¡Últimas ${product.stock}!</span> Se hacen en tandas cortas.`;
  return `${icon('check', 'size-4 inline -mt-0.5 text-ok')} En stock, listo para despachar.`;
}

export function productView({ params, query }) {
  const product = productBySlug(params[0]);
  if (!product) return null;
  const c = state.config;
  let color = pickColor(product, query.get('color'));
  let quantity = 1;
  const off = discountPercent(product);
  const soldOut = product.stock <= 0;
  const transferPrice = Math.round(product.price * (1 - c.transfer.discount / 100));
  const related = relatedProducts(product);
  const showGallery = !product.imageUrl && product.colors.length > 1;

  const html = `
    <div class="wrap pt-6 sm:pt-8">
      ${breadcrumb([
        { label: 'Inicio', href: '/' },
        { label: product.category, href: `/tienda/${slugify(product.category)}` },
        { label: product.name },
      ])}
      <div class="mt-6 grid gap-10 lg:grid-cols-[1.08fr_1fr] lg:gap-16">
        <div class="lg:sticky lg:top-28 lg:self-start">
          <div class="stitch-in is-on relative grid aspect-square place-items-center overflow-hidden rounded-[2.25rem] transition-colors duration-500" style="background-color:${artBackground(product, color?.hex)}" data-art>
            ${product.imageUrl
              ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" class="absolute inset-0 h-full w-full object-cover">`
              : `<div class="w-[76%]" data-art-svg>${illustration(product.illustration, color?.hex, `${product.name}${color ? ` en ${color.name}` : ''}`)}</div>`}
            <div class="absolute top-5 left-5 flex flex-col items-start gap-2">
              ${off ? `<span class="chip bg-ink px-3 py-1.5 text-cream">−${off}%</span>` : ''}
              ${soldOut ? '<span class="chip bg-paper px-3 py-1.5 text-ink">Sin stock</span>' : ''}
            </div>
          </div>
          ${showGallery ? `
            <div class="scrollbar-none mt-4 flex gap-3 overflow-x-auto p-1" role="group" aria-label="Ver en otros colores">
              ${product.colors.map((col) => `
                <button type="button" class="grid size-20 shrink-0 place-items-center rounded-2xl outline-offset-2 transition aria-pressed:outline-2 aria-pressed:outline-ink sm:size-24" style="background-color:${tileColor(col.hex)}" data-gallery="${esc(col.name)}" aria-pressed="${col.name === color?.name}" aria-label="Ver en ${esc(col.name)}">
                  <span class="w-[78%]">${illustration(product.illustration, col.hex)}</span>
                </button>`).join('')}
            </div>` : ''}
        </div>

        <div class="lg:pt-2">
          <p class="eyebrow">${esc(product.category)}</p>
          <h1 class="mt-3 font-display text-5xl leading-[0.98] sm:text-6xl">${esc(product.name)}</h1>
          <div class="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p class="text-[32px] font-semibold tabular-nums">${money(product.price)}</p>
            ${off ? `<p class="text-lg text-ink-faint tabular-nums line-through">${money(product.compareAtPrice)}</p>` : ''}
          </div>
          <ul class="mt-3 space-y-1.5 text-[15px] text-ink-soft">
            <li class="flex items-center gap-2">${icon('card', 'size-[18px] shrink-0 text-ink')}${
              c.installments > 0
                ? `<span>${c.installments} cuotas sin interés de <b class="font-semibold text-ink tabular-nums">${money(Math.round(product.price / c.installments))}</b></span>`
                : '<span>Pagá en cuotas con Mercado Pago</span>'
            }</li>
            ${c.transfer.enabled ? `<li class="flex items-center gap-2">${icon('bank', 'size-[18px] shrink-0 text-ink')}<span><b class="font-semibold text-ink tabular-nums">${money(transferPrice)}</b> pagando con transferencia (${c.transfer.discount}% off)</span></li>` : ''}
          </ul>

          <div class="stitch my-7"></div>

          <form data-add-form novalidate>
            ${product.colors.length ? `
              <fieldset>
                <legend class="text-sm font-semibold">Color: <span class="font-normal text-ink-soft" data-color-name>${esc(color?.name ?? '')}</span></legend>
                <div class="mt-3 flex flex-wrap gap-3">
                  ${product.colors.map((col, i) => `
                    <label class="relative">
                      <input type="radio" name="color" value="${esc(col.name)}" class="swatch-input peer sr-only" id="color-${i}" ${col.name === color?.name ? 'checked' : ''}>
                      <span class="swatch" style="background-color:${esc(col.hex)}" title="${esc(col.name)}"></span>
                      <span class="sr-only">${esc(col.name)}</span>
                    </label>`).join('')}
                </div>
              </fieldset>` : ''}

            <div class="mt-7 flex gap-3">
              <div class="flex h-14 shrink-0 items-center rounded-full border border-line bg-paper ${soldOut ? 'opacity-50' : ''}">
                <button type="button" class="grid size-14 place-items-center rounded-full hover:bg-butter-100 disabled:opacity-30" data-qty="-1" aria-label="Restar uno" ${soldOut ? 'disabled' : ''}>${icon('minus', 'size-4')}</button>
                <output class="w-6 text-center font-semibold tabular-nums" data-qty-value aria-live="polite">1</output>
                <button type="button" class="grid size-14 place-items-center rounded-full hover:bg-butter-100 disabled:opacity-30" data-qty="1" aria-label="Sumar uno" ${soldOut ? 'disabled' : ''}>${icon('plus', 'size-4')}</button>
              </div>
              <button type="submit" class="btn btn-dark btn-lg min-w-0 flex-1" data-add ${soldOut ? 'disabled' : ''}>
                ${soldOut ? 'Sin stock' : `${icon('bag', 'size-5')} Agregar al carrito`}
              </button>
            </div>
          </form>
          <p class="mt-3 text-sm text-ink-soft" data-stock>${stockText(product, cart.quantityOf(product.id))}</p>
          ${soldOut && c.contact.whatsapp ? `<a href="${whatsappUrl(c.contact.whatsapp, `Hola! Quería saber cuándo vuelve a haber ${product.name}.`)}" target="_blank" rel="noopener" class="btn btn-ghost mt-4 w-full">${icon('chat', 'size-5')} Avisame cuando vuelva</a>` : ''}

          ${product.description ? `<div class="mt-8 space-y-3 text-[17px] leading-relaxed">${paragraphs(product.description)}</div>` : ''}

          <div class="mt-8 divide-y divide-line border-y border-line">
            ${product.details.length ? `
              <details class="group py-5" open>
                <summary class="flex items-center justify-between font-semibold">Detalles y medidas ${icon('chevronDown', 'size-5 transition-transform group-open:rotate-180')}</summary>
                <ul class="mt-4 space-y-2.5 text-[15px] text-ink-soft">
                  ${product.details.map((d) => `<li class="flex gap-3"><span class="mt-2.5 h-px w-3 shrink-0 bg-ink-faint"></span><span>${esc(d)}</span></li>`).join('')}
                </ul>
              </details>` : ''}
            <details class="group py-5">
              <summary class="flex items-center justify-between font-semibold">Envíos, retiro y cambios ${icon('chevronDown', 'size-5 transition-transform group-open:rotate-180')}</summary>
              <ul class="mt-4 space-y-3 text-[15px] text-ink-soft">
                ${c.shipping.enabled ? `<li class="flex gap-3">${icon('truck', 'size-5 shrink-0 text-ink')}<span>Envío a domicilio ${money(c.shipping.cost)}${c.shipping.freeFrom > 0 ? `, gratis desde ${money(c.shipping.freeFrom)}` : ''}. ${esc(c.shipping.days)}</span></li>` : ''}
                ${c.pickup.enabled ? `<li class="flex gap-3">${icon('store', 'size-5 shrink-0 text-ink')}<span>Retiro sin cargo: ${esc(c.pickup.address)}</span></li>` : ''}
                <li class="flex gap-3">${icon('refresh', 'size-5 shrink-0 text-ink')}<span>Tenés ${CHANGES_DAYS} días para cambiarlo si no te convence.</span></li>
              </ul>
            </details>
            <details class="group py-5">
              <summary class="flex items-center justify-between font-semibold">Cuidado del cuero ${icon('chevronDown', 'size-5 transition-transform group-open:rotate-180')}</summary>
              <p class="mt-4 text-[15px] leading-relaxed text-ink-soft">${CARE_TEXT}</p>
            </details>
          </div>
        </div>
      </div>
    </div>

    ${related.length ? `
    <section class="wrap pt-20" aria-labelledby="related-title">
      <h2 id="related-title" class="font-display text-[34px] leading-tight">También te puede gustar</h2>
      <div class="mt-7 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">${related.map(productCard).join('')}</div>
    </section>` : ''}`;

  return {
    title: product.name,
    html,
    mount(root) {
      const qtyValue = root.querySelector('[data-qty-value]');
      const stockEl = root.querySelector('[data-stock]');
      const maxQty = () => Math.max(product.stock - cart.quantityOf(product.id), 0);

      const refreshQty = () => {
        quantity = Math.min(Math.max(quantity, 1), Math.max(maxQty(), 1));
        qtyValue.textContent = String(quantity);
        root.querySelector('[data-qty="-1"]').disabled = soldOut || quantity <= 1;
        root.querySelector('[data-qty="1"]').disabled = soldOut || quantity >= maxQty();
        const addButton = root.querySelector('[data-add]');
        if (!soldOut) addButton.disabled = maxQty() <= 0;
        stockEl.innerHTML = stockText(product, cart.quantityOf(product.id));
      };

      const selectColor = (name) => {
        const next = product.colors.find((col) => col.name === name);
        if (!next) return;
        color = next;
        root.querySelector('[data-color-name]').textContent = next.name;
        const radio = root.querySelector(`input[name="color"][value="${CSS.escape(next.name)}"]`);
        if (radio) radio.checked = true;
        if (!product.imageUrl) {
          root.querySelector('[data-art]').style.backgroundColor = tileColor(next.hex);
          root.querySelector('[data-art-svg]').innerHTML = illustration(product.illustration, next.hex, `${product.name} en ${next.name}`);
        }
        root.querySelectorAll('[data-gallery]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gallery === next.name)));
        const url = currentUrl();
        url.searchParams.set('color', next.name);
        replaceAddress(url.pathname + url.search);
      };

      root.querySelectorAll('input[name="color"]').forEach((input) => input.addEventListener('change', () => selectColor(input.value)));
      root.querySelectorAll('[data-gallery]').forEach((b) => b.addEventListener('click', () => selectColor(b.dataset.gallery)));
      root.querySelectorAll('[data-qty]').forEach((b) =>
        b.addEventListener('click', () => {
          quantity += Number(b.dataset.qty);
          refreshQty();
        }),
      );

      root.querySelector('[data-add-form]').addEventListener('submit', (event) => {
        event.preventDefault();
        if (soldOut || maxQty() <= 0) return;
        cart.add(product.id, color?.name ?? null, Math.min(quantity, maxQty()));
        bumpCartBadge();
        toast(`${product.name}${color ? ` (${color.name})` : ''} se agregó al carrito`, { actionLabel: 'Ver carrito', onAction: openCart });
        quantity = 1;
        refreshQty();
      });

      refreshQty();
      const unsubscribe = cart.subscribe(refreshQty);
      const unbindCards = bindCardColors(root, state.products);
      return () => {
        unsubscribe();
        unbindCards();
      };
    },
  };
}

import { state, categories } from '../store.js';
import { icon } from '../icons.js';
import { illustration, tileColor } from '../illustrations.js';
import { esc, money, highlight, paragraphs, plural } from '../ui.js';
import { installmentsText, CHANGES_DAYS } from '../content.js';
import { productCard, bindCardColors } from './components.js';

function heroArt(products) {
  const [main, second, third] = products;
  if (!main) return '';
  const mainHex = main.colors[1]?.hex ?? main.colors[0]?.hex;
  const art = main.imageUrl
    ? `<img src="${esc(main.imageUrl)}" alt="${esc(main.name)}" class="absolute inset-0 h-full w-full object-cover">`
    : `
      <div class="absolute bottom-[5%] left-[5%] w-[60%] drop-shadow-[0_18px_22px_rgba(46,42,34,0.12)]">${illustration(main.illustration, mainHex, main.name)}</div>
      ${second && !second.imageUrl ? `<div class="absolute right-[4%] bottom-[9%] w-[38%] drop-shadow-[0_14px_18px_rgba(46,42,34,0.1)]">${illustration(second.illustration, second.colors[0]?.hex)}</div>` : ''}
      ${third && !third.imageUrl ? `<div class="absolute top-0 right-[20%] w-[19%] origin-top motion-safe:animate-sway">${illustration(third.illustration, third.colors[2]?.hex ?? third.colors[0]?.hex)}</div>` : ''}`;
  return `
    <div class="relative">
      <div class="relative aspect-[5/4] overflow-hidden rounded-[2.5rem] bg-butter-200">
        <div class="absolute -top-16 -right-12 size-[62%] rounded-full bg-butter-300/80" aria-hidden="true"></div>
        <div class="absolute -bottom-24 -left-16 size-[48%] rounded-full bg-butter-100/80" aria-hidden="true"></div>
        ${art}
        <div class="stitch-in is-on pointer-events-none absolute inset-0 rounded-[2.5rem]" aria-hidden="true"></div>
      </div>
      <a href="/producto/${esc(main.slug)}" class="absolute -bottom-6 left-5 flex items-center gap-3 rounded-2xl bg-paper py-2.5 pr-5 pl-2.5 shadow-float transition-transform hover:-translate-y-0.5 sm:left-8">
        <span class="grid size-12 place-items-center rounded-xl" style="background-color:${tileColor(mainHex)}">
          <span class="w-[85%]">${illustration(main.illustration, mainHex)}</span>
        </span>
        <span>
          <span class="block text-xs text-ink-soft">Favorito del taller</span>
          <span class="block text-[15px] font-semibold">${esc(main.name)} · <span class="tabular-nums">${money(main.price)}</span></span>
        </span>
      </a>
    </div>`;
}

// Elige para cada categoría un color claro que no se repita, así las tarjetas tienen distintos pasteles.
function tileHexFor(category, used) {
  const sample = category.products.find((p) => !p.imageUrl) ?? category.products[0];
  const options = category.products.flatMap((p) => (p === sample ? p.colors : [])).filter((c) => !used.has(c.hex));
  const light = options.filter((c) => lightness(c.hex) > 0.62);
  const pick = light[0] ?? options[0] ?? sample.colors[0] ?? { hex: '#E3B967' };
  used.add(pick.hex);
  return pick.hex;
}

function lightness(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

function categoryTiles() {
  const cats = categories();
  if (cats.length < 2) return '';
  const used = new Set();
  const cols = Math.min(cats.length, 6);
  return `
    <section class="wrap pt-20 pb-4" aria-labelledby="cat-title">
      <h2 id="cat-title" class="font-display text-[34px] leading-tight sm:text-[40px]">Elegí por categoría</h2>
      <div class="scrollbar-none -mx-4 mt-6 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-[repeat(var(--cols),minmax(0,1fr))] lg:overflow-visible lg:px-0" style="--cols:${cols}">
        ${cats.map((cat) => {
          const sample = cat.products.find((p) => !p.imageUrl) ?? cat.products[0];
          const hex = tileHexFor(cat, used);
          return `
          <a href="/tienda/${cat.slug}" class="group relative flex h-48 w-40 shrink-0 snap-start flex-col overflow-hidden rounded-tile p-4 sm:w-48 lg:w-auto" style="background-color:${tileColor(hex)}">
            <span class="text-[17px] font-semibold">${esc(cat.name)}</span>
            <span class="mt-0.5 text-[13px] text-ink-soft">${plural(cat.products.length, 'modelo', 'modelos')}</span>
            <span class="absolute -right-3 -bottom-4 w-[78%] transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:-rotate-3">
              ${sample.imageUrl ? `<img src="${esc(sample.imageUrl)}" alt="" class="aspect-square w-full rounded-2xl object-cover" loading="lazy">` : illustration(sample.illustration, hex)}
            </span>
          </a>`;
        }).join('')}
      </div>
    </section>`;
}

function featuredSection() {
  const featured = state.products.filter((p) => p.featured && p.stock > 0);
  const list = (featured.length >= 4 ? featured : [...featured, ...state.products.filter((p) => !featured.includes(p) && p.stock > 0)]).slice(0, 4);
  if (!list.length) return '';
  return `
    <section class="wrap pt-16 pb-6" aria-labelledby="featured-title">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="eyebrow">Lo más elegido</p>
          <h2 id="featured-title" class="mt-2 font-display text-[34px] leading-tight sm:text-[40px]">Favoritos del taller</h2>
        </div>
        <a href="/tienda" class="btn btn-ghost btn-sm hidden sm:inline-flex">Ver todo ${icon('arrowRight', 'size-4')}</a>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4" data-grid>
        ${list.map(productCard).join('')}
      </div>
      <a href="/tienda" class="btn btn-ghost mt-10 w-full sm:hidden">Ver todos los productos</a>
    </section>`;
}

function workshopSection() {
  const c = state.config;
  const seen = new Map();
  for (const product of state.products) for (const color of product.colors) if (!seen.has(color.name)) seen.set(color.name, color.hex);
  const swatches = [...seen].slice(0, 12);
  const facts = [
    ['layers', 'Cuero vacuno flor entera', 'Curtido en el país, de 1,2 a 3,5 mm de espesor según la pieza.'],
    ['scissors', 'Cortado y cosido a mano', 'Con hilo encerado, punto por punto, en tandas cortas.'],
    ['sparkle', 'Herrajes de bronce', 'No se oxidan y con los años toman una pátina linda.'],
  ];
  return `
    <section id="taller" class="mt-20 bg-butter-100/70 py-20" aria-labelledby="taller-title">
      <div class="wrap grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p class="eyebrow">El taller</p>
          <h2 id="taller-title" class="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl">${highlight(c.about.title)}</h2>
          <div class="mt-6 max-w-lg space-y-4 text-[17px] leading-relaxed text-ink-soft">${paragraphs(c.about.text)}</div>
          <ul class="mt-10 space-y-5">
            ${facts.map(([ic, title, text]) => `
              <li class="flex gap-4">
                <span class="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-ink">${icon(ic, 'size-5')}</span>
                <div><p class="font-semibold">${title}</p><p class="mt-0.5 text-sm text-ink-soft">${text}</p></div>
              </li>`).join('')}
          </ul>
        </div>
        ${swatches.length ? `
        <div class="rounded-[2rem] bg-paper p-6 shadow-float sm:p-8">
          <div class="flex items-baseline justify-between gap-4">
            <p class="eyebrow">Muestrario de cueros</p>
            <p class="text-xs text-ink-soft">${plural(swatches.length, 'tono', 'tonos')} disponibles</p>
          </div>
          <ul class="mt-6 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
            ${swatches.map(([name, hex]) => `
              <li>
                <div class="stitch-in is-on aspect-[5/4] rounded-2xl shadow-[inset_0_-10px_18px_-12px_rgba(46,42,34,0.35)]" style="background-color:${esc(hex)}"></div>
                <p class="mt-2 text-[13px] font-medium">${esc(name)}</p>
              </li>`).join('')}
          </ul>
          <p class="mt-6 border-t border-line pt-4 text-[13px] text-ink-soft">Cada cuero es único: puede tener marcas naturales y pequeñas variaciones de tono.</p>
        </div>` : ''}
      </div>
    </section>`;
}

function benefits() {
  const c = state.config;
  const items = [];
  if (c.shipping.enabled) {
    items.push(['truck', 'Envíos a todo el país', c.shipping.freeFrom > 0 ? `Gratis en compras desde ${money(c.shipping.freeFrom)}.` : 'Despachamos en 24 a 48 h hábiles.']);
  }
  if (c.pickup.enabled) items.push(['store', 'Retiro sin cargo', c.pickup.hours]);
  items.push(['card', 'Pagá como quieras', installmentsText(c)]);
  if (c.transfer.enabled) items.push(['percent', `${c.transfer.discount}% off con transferencia`, 'Te mostramos el alias y el CBU al confirmar.']);
  else items.push(['refresh', 'Cambios sin vueltas', `Tenés ${CHANGES_DAYS} días para cambiar tu compra.`]);
  const cols = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }[items.length] ?? 'lg:grid-cols-4';
  return `
    <section class="wrap pt-16" aria-label="Beneficios">
      <ul class="grid gap-8 sm:grid-cols-2 ${cols}">
        ${items.map(([ic, title, text]) => `
          <li class="flex gap-4">
            <span class="grid size-12 shrink-0 place-items-center rounded-full bg-butter-200">${icon(ic, 'size-[22px]')}</span>
            <div><p class="font-semibold">${esc(title)}</p><p class="mt-1 text-sm leading-relaxed text-ink-soft">${esc(text)}</p></div>
          </li>`).join('')}
      </ul>
    </section>`;
}

export function homeView() {
  const c = state.config;
  const heroProducts = [
    ...state.products.filter((p) => p.featured),
    ...state.products.filter((p) => !p.featured),
  ];
  // Composición del encabezado: una pieza grande, otra distinta y un accesorio colgando.
  const main = heroProducts[0];
  const second = heroProducts.find((p) => p !== main && p.illustration !== main?.illustration && !['keychain', 'cardholder', 'passport'].includes(p.illustration));
  const small = ['keychain', 'cardholder', 'passport']
    .map((kind) => state.products.find((p) => p.illustration === kind && p !== main && p !== second))
    .find(Boolean);
  const picked = [main, second, small].filter(Boolean);

  const html = `
    <section class="wrap pt-8 pb-10 sm:pt-12 lg:pt-16">
      <div class="grid items-center gap-12 lg:grid-cols-[1.02fr_1fr] lg:gap-16">
        <div class="max-w-xl">
          ${c.hero.eyebrow ? `<p class="eyebrow flex items-center gap-2"><span class="size-1.5 rounded-full bg-butter-500" aria-hidden="true"></span>${esc(c.hero.eyebrow)}</p>` : ''}
          <h1 class="mt-5 font-display text-[44px] leading-[1.02] tracking-[-0.01em] sm:text-6xl lg:text-[70px]">${highlight(c.hero.title)}</h1>
          ${c.hero.subtitle ? `<p class="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">${esc(c.hero.subtitle)}</p>` : ''}
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <a href="/tienda" class="btn btn-dark btn-lg w-full sm:w-auto">Ver la colección ${icon('arrowRight', 'size-5')}</a>
            <a href="/#taller" class="btn btn-ghost btn-lg w-full sm:w-auto">Conocé el taller</a>
          </div>
        </div>
        ${heroArt(picked)}
      </div>
    </section>
    ${categoryTiles()}
    ${featuredSection()}
    ${workshopSection()}
    ${benefits()}`;

  return {
    html,
    mount(root) {
      return bindCardColors(root, state.products);
    },
  };
}

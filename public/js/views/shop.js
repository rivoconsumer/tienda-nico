import { state, categories } from '../store.js';
import { icon } from '../icons.js';
import { esc, plural } from '../ui.js';
import { productCard, bindCardColors, breadcrumb } from './components.js';

const SORTS = {
  destacados: 'Destacados',
  'precio-asc': 'Menor precio',
  'precio-desc': 'Mayor precio',
  nombre: 'Nombre (A-Z)',
};

function sortProducts(list, sort) {
  const sorted = [...list];
  if (sort === 'precio-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'precio-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'nombre') sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  else sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
  // Los productos sin stock siempre al final
  return sorted.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));
}

export function shopView({ params, query, navigate }) {
  const cats = categories();
  const slug = params[0];
  const current = slug ? cats.find((c) => c.slug === slug) : null;
  if (slug && !current) return null;

  const sort = SORTS[query.get('orden')] ? query.get('orden') : 'destacados';
  const products = sortProducts(current ? current.products : state.products, sort);
  const title = current ? current.name : 'Tienda';
  const pill = (href, label, count, active) => `
    <a href="${href}${sort !== 'destacados' ? `?orden=${sort}` : ''}" class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-ink hover:border-ink/30'}" ${active ? 'aria-current="page"' : ''}>
      ${esc(label)} <span class="${active ? 'text-cream/60' : 'text-ink-faint'} tabular-nums">${count}</span>
    </a>`;

  const html = `
    <section class="wrap pt-8 sm:pt-10">
      ${breadcrumb([{ label: 'Inicio', href: '/' }, ...(current ? [{ label: 'Tienda', href: '/tienda' }] : []), { label: title }])}
      <div class="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="font-display text-5xl leading-none sm:text-6xl">${esc(title)}</h1>
          <p class="mt-3 text-ink-soft">${plural(products.length, 'producto', 'productos')}${current ? '' : ' hechos a mano'}</p>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-ink-soft">Ordenar por</span>
          <select id="shop-sort" class="input h-10 w-auto rounded-full py-0 pr-9 pl-4 text-sm font-medium" data-sort>
            ${Object.entries(SORTS).map(([value, label]) => `<option value="${value}" ${value === sort ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
      </div>
      <nav class="scrollbar-none -mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Categorías">
        ${pill('/tienda', 'Todo', state.products.length, !current)}
        ${cats.map((c) => pill(`/tienda/${c.slug}`, c.name, c.products.length, current?.slug === c.slug)).join('')}
      </nav>
      <div class="stitch mt-6"></div>
    </section>
    <section class="wrap pt-8">
      ${products.length
        ? `<div class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">${products.map(productCard).join('')}</div>`
        : `<div class="rounded-tile bg-butter-100 px-6 py-16 text-center">
            <div class="mx-auto grid size-16 place-items-center rounded-full bg-paper">${icon('search', 'size-7')}</div>
            <p class="mt-4 font-display text-2xl">Todavía no hay productos acá</p>
            <p class="mt-2 text-ink-soft">Estamos preparando piezas nuevas. Mientras, mirá el resto de la colección.</p>
            <a href="/tienda" class="btn btn-dark mt-6">Ver todo</a>
          </div>`}
    </section>`;

  return {
    title,
    html,
    mount(root) {
      root.querySelector('[data-sort]')?.addEventListener('change', (event) => {
        const value = event.target.value;
        const base = current ? `/tienda/${current.slug}` : '/tienda';
        navigate(value === 'destacados' ? base : `${base}?orden=${value}`, { replace: true, keepScroll: true });
      });
      return bindCardColors(root, state.products);
    },
  };
}

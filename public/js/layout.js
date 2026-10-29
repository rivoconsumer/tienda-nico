// Partes fijas de la tienda: barra de anuncio, encabezado, pie, carrito lateral y botón de WhatsApp.
import { state, categories, cartLines, cartSubtotal } from './store.js';
import { cart } from './cart.js';
import { icon } from './icons.js';
import { esc, money, plural, thumb, whatsappUrl, instagramUrl, $, $$ } from './ui.js';

let navigateFn = (url) => (location.href = url);
export const setNavigator = (fn) => (navigateFn = fn);

const NAV_LINK =
  'rounded-full px-3 py-2 text-[15px] font-medium whitespace-nowrap text-ink-soft transition-colors hover:bg-butter-100 hover:text-ink aria-[current=page]:bg-butter-100 aria-[current=page]:text-ink xl:px-3.5';

function navItems() {
  return [
    { href: '/tienda', label: 'Tienda' },
    ...categories().slice(0, 5).map((c) => ({ href: `/tienda/${c.slug}`, label: c.name })),
    { href: '/ayuda', label: 'Ayuda' },
  ];
}

export function renderAnnouncement() {
  const text = state.config.announcement?.trim();
  const el = document.getElementById('announcement');
  if (!text) return (el.innerHTML = '');
  el.innerHTML = `
    <div class="bg-butter-200 text-ink">
      <p class="wrap py-2 text-center text-[13px] leading-snug font-medium text-balance">${esc(text)}</p>
      <div class="stitch opacity-70"></div>
    </div>`;
}

export function renderHeader() {
  const c = state.config;
  const header = document.getElementById('header');
  header.innerHTML = `
    <div class="wrap flex h-full items-center gap-2">
      <button type="button" class="icon-btn -ml-2 lg:hidden" data-action="menu" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-menu">${icon('menu', 'size-6')}</button>
      <a href="/" class="flex shrink-0 items-baseline gap-1 font-display text-[26px] leading-none tracking-tight whitespace-nowrap sm:text-[28px]">
        ${esc(c.storeName)}<span class="inline-block size-1.5 rounded-full bg-butter-500" aria-hidden="true"></span>
      </a>
      <nav class="ml-4 hidden items-center gap-0.5 lg:flex xl:ml-6" aria-label="Principal">
        ${navItems().map((item) => `<a href="${item.href}" class="${NAV_LINK}" data-nav="${item.href}">${esc(item.label)}</a>`).join('')}
      </nav>
      <div class="ml-auto flex items-center gap-1">
        <a href="/seguimiento" class="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-soft transition-colors hover:bg-butter-100 hover:text-ink sm:inline-flex lg:max-xl:size-10 lg:max-xl:justify-center lg:max-xl:px-0" data-nav="/seguimiento" aria-label="Seguí tu pedido" title="Seguí tu pedido">${icon('package', 'size-[18px] shrink-0')}<span class="lg:max-xl:sr-only">Seguí tu pedido</span></a>
        <button type="button" class="icon-btn relative -mr-1" data-action="cart" aria-label="Abrir carrito">
          ${icon('bag', 'size-6')}
          <span data-cart-count class="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-butter-300 px-1 text-[11px] font-bold text-ink tabular-nums" hidden></span>
        </button>
      </div>
    </div>
    <div id="mobile-menu" class="border-b border-line bg-cream lg:hidden" hidden>
      <nav class="wrap flex flex-col py-3" aria-label="Menú">
        ${[...navItems(), { href: '/seguimiento', label: 'Seguí tu pedido' }]
          .map((item) => `<a href="${item.href}" class="flex items-center justify-between border-b border-line/70 py-3.5 text-lg last:border-0" data-nav="${item.href}">${esc(item.label)}${icon('chevronRight', 'size-5 text-ink-faint')}</a>`)
          .join('')}
      </nav>
    </div>`;

  header.querySelector('[data-action="menu"]').addEventListener('click', (event) => {
    const menu = $('#mobile-menu');
    menu.hidden = !menu.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!menu.hidden));
    event.currentTarget.setAttribute('aria-label', menu.hidden ? 'Abrir menú' : 'Cerrar menú');
    event.currentTarget.innerHTML = icon(menu.hidden ? 'menu' : 'close', 'size-6');
  });
  header.querySelector('[data-action="cart"]').addEventListener('click', () => openCart());
  updateCartBadge();
}

export function closeMobileMenu() {
  const menu = $('#mobile-menu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  const button = $('[data-action="menu"]');
  button?.setAttribute('aria-expanded', 'false');
  if (button) button.innerHTML = icon('menu', 'size-6');
}

export function setActiveNav(pathname) {
  $$('[data-nav]').forEach((link) => {
    const href = link.getAttribute('data-nav');
    const active = href === '/tienda' ? pathname === '/tienda' : pathname === href || pathname.startsWith(`${href}/`);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function updateCartBadge() {
  const badge = $('[data-cart-count]');
  if (!badge) return;
  const count = cart.count();
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count === 0;
  $('[data-action="cart"]')?.setAttribute('aria-label', count ? `Abrir carrito (${plural(count, 'producto', 'productos')})` : 'Abrir carrito');
}

export function bumpCartBadge() {
  const badge = $('[data-cart-count]');
  if (!badge) return;
  badge.classList.remove('animate-pop');
  void badge.offsetWidth;
  badge.classList.add('animate-pop');
}

export function renderFooter() {
  const c = state.config;
  const contact = c.contact;
  const socials = [
    contact.instagram && `<a href="${instagramUrl(contact.instagram)}" target="_blank" rel="noopener" class="icon-btn bg-paper" aria-label="Instagram">${icon('instagram')}</a>`,
    contact.whatsapp && `<a href="${whatsappUrl(contact.whatsapp)}" target="_blank" rel="noopener" class="icon-btn bg-paper" aria-label="WhatsApp">${icon('chat')}</a>`,
    contact.email && `<a href="mailto:${esc(contact.email)}" class="icon-btn bg-paper" aria-label="Email">${icon('mail')}</a>`,
  ].filter(Boolean);
  const linkCls = 'text-ink-soft transition-colors hover:text-ink';

  document.getElementById('footer').innerHTML = `
    <div class="mt-20 border-t border-line bg-butter-100/60">
      <div class="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
        <div>
          <a href="/" class="font-display text-3xl">${esc(c.storeName)}</a>
          <p class="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">${esc(c.tagline)}. Piezas de cuero hechas a mano, en tandas cortas.</p>
          ${socials.length ? `<div class="mt-5 flex gap-2">${socials.join('')}</div>` : ''}
          ${contact.email ? `<p class="mt-4 text-sm text-ink-soft select-all">${esc(contact.email)}</p>` : ''}
        </div>
        <div>
          <h2 class="eyebrow">Tienda</h2>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a href="/tienda" class="${linkCls}">Todos los productos</a></li>
            ${categories().map((cat) => `<li><a href="/tienda/${cat.slug}" class="${linkCls}">${esc(cat.name)}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          <h2 class="eyebrow">Ayuda</h2>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a href="/ayuda#envios" class="${linkCls}">Envíos y retiro</a></li>
            <li><a href="/ayuda#cambios" class="${linkCls}">Cambios</a></li>
            <li><a href="/ayuda#cuidado" class="${linkCls}">Cuidado del cuero</a></li>
            <li><a href="/seguimiento" class="${linkCls}">Seguí tu pedido</a></li>
            <li><a href="/arrepentimiento" class="font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Botón de arrepentimiento</a></li>
            ${window.__demo ? `<li><a href="${window.__demo.adminPage}" target="_self" class="${linkCls}">Panel de administración (demo)</a></li>` : ''}
          </ul>
        </div>
        <div>
          <h2 class="eyebrow">Medios de pago</h2>
          <ul class="mt-4 space-y-2.5 text-sm text-ink-soft">
            <li class="flex gap-2">${icon('card', 'size-[18px] shrink-0 text-ink')}<span>Mercado Pago: tarjetas, dinero en cuenta y efectivo</span></li>
            ${c.transfer.enabled ? `<li class="flex gap-2">${icon('bank', 'size-[18px] shrink-0 text-ink')}<span>Transferencia bancaria con ${c.transfer.discount}% off</span></li>` : ''}
          </ul>
          ${c.pickup.enabled ? `
            <h2 class="eyebrow mt-7">Retiro sin cargo</h2>
            <p class="mt-4 flex gap-2 text-sm text-ink-soft">${icon('pin', 'size-[18px] shrink-0 text-ink')}<span>${esc(c.pickup.address)}<br>${esc(c.pickup.hours)}</span></p>` : ''}
        </div>
      </div>
      <div class="wrap"><div class="stitch"></div></div>
      <div class="wrap flex flex-col gap-2 py-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>© ${new Date().getFullYear()} ${esc(c.storeName)}. Precios finales en pesos argentinos.${c.dataFiscalUrl ? ` · <a href="${esc(c.dataFiscalUrl)}" target="_blank" rel="noopener" class="${linkCls} underline underline-offset-4">Data fiscal</a>` : ''}</p>
        <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener" class="${linkCls}">Defensa de las y los consumidores. Para reclamos ingresá acá.</a>
      </div>
    </div>`;
}

export function renderWhatsappButton() {
  const number = state.config.contact.whatsapp;
  const existing = $('#whatsapp-float');
  if (!number) return existing?.remove();
  if (existing) return;
  const link = document.createElement('a');
  link.id = 'whatsapp-float';
  link.href = whatsappUrl(number, `Hola ${state.config.storeName}! Tengo una consulta.`);
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', 'Escribinos por WhatsApp');
  link.className =
    'fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-butter-300 text-ink shadow-float transition-transform hover:scale-105';
  link.innerHTML = icon('chat', 'size-7');
  document.body.append(link);
}

// ── Carrito lateral ──────────────────────────────────────────
let lastFocus = null;

function ensureDrawer() {
  let drawer = $('#cart-drawer');
  if (drawer) return drawer;
  const root = document.getElementById('drawer-root');
  root.innerHTML = `
    <div id="cart-drawer" class="fixed inset-0 z-50" hidden>
      <div data-close class="absolute inset-0 bg-ink/30 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 data-[open]:opacity-100"></div>
      <aside role="dialog" aria-modal="true" aria-labelledby="cart-title" class="absolute inset-y-0 right-0 flex w-full max-w-[27rem] translate-x-full flex-col bg-cream shadow-float transition-transform duration-300 ease-[var(--ease-soft)] data-[open]:translate-x-0">
        <div class="flex items-center justify-between border-b border-line py-4 pr-[max(1rem,env(safe-area-inset-right))] pl-5">
          <h2 id="cart-title" class="font-display text-[28px] leading-none">Tu carrito</h2>
          <button type="button" data-close class="icon-btn" aria-label="Cerrar carrito">${icon('close', 'size-6')}</button>
        </div>
        <div data-cart-body class="flex-1 overflow-y-auto overscroll-contain py-4 pr-[max(1.25rem,env(safe-area-inset-right))] pl-5"></div>
        <div data-cart-footer class="border-t border-line bg-paper pt-5 pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-5"></div>
      </aside>
    </div>`;
  drawer = $('#cart-drawer');

  drawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) return closeCart();
    const step = event.target.closest('[data-step]');
    if (step) {
      const item = cart.items.find((i) => i.key === step.dataset.key);
      if (item) cart.setQuantity(item.key, item.quantity + Number(step.dataset.step));
      return;
    }
    const remove = event.target.closest('[data-remove]');
    if (remove) return cart.remove(remove.dataset.remove);
    const link = event.target.closest('a[href^="/"]');
    if (link) closeCart({ restoreFocus: false });
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return closeCart();
    if (event.key !== 'Tab') return;
    const focusable = $$('a[href], button:not([disabled]), input, select', drawer.querySelector('aside')).filter((el) => el.offsetParent);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  return drawer;
}

function freeShippingBar(subtotal) {
  const { enabled, freeFrom } = state.config.shipping;
  if (!enabled || freeFrom <= 0 || subtotal <= 0) return '';
  const missing = freeFrom - subtotal;
  const percent = Math.min(100, Math.round((subtotal / freeFrom) * 100));
  return `
    <div class="mb-5 rounded-2xl bg-butter-100 p-4">
      <p class="flex items-center gap-2 text-sm font-medium">${icon('truck', 'size-[18px]')}${
        missing > 0 ? `Te faltan <b class="tabular-nums">${money(missing)}</b> para el envío gratis` : '¡Tenés envío gratis!'
      }</p>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Progreso hacia el envío gratis">
        <div class="h-full rounded-full bg-butter-500 transition-[width] duration-500" style="width:${percent}%"></div>
      </div>
    </div>`;
}

export function renderCart() {
  const drawer = ensureDrawer();
  const body = drawer.querySelector('[data-cart-body]');
  const footer = drawer.querySelector('[data-cart-footer]');
  const lines = cartLines();

  if (!lines.length) {
    body.innerHTML = `
      <div class="grid h-full place-items-center text-center">
        <div class="max-w-[16rem]">
          <div class="mx-auto grid size-20 place-items-center rounded-full bg-butter-100 text-ink">${icon('bag', 'size-9')}</div>
          <p class="mt-5 font-display text-2xl">Tu carrito está vacío</p>
          <p class="mt-2 text-sm text-ink-soft">Mirá la colección y elegí tu próxima pieza de cuero.</p>
          <a href="/tienda" class="btn btn-dark mt-6">Ir a la tienda</a>
        </div>
      </div>`;
    footer.hidden = true;
    return;
  }

  const subtotal = cartSubtotal();
  const hasProblems = lines.some((l) => l.problem);
  body.innerHTML = `
    ${freeShippingBar(subtotal)}
    <ul class="divide-y divide-line">
      ${lines.map((line) => {
        const p = line.product;
        if (!p) {
          return `<li class="flex items-center justify-between gap-3 py-4 text-sm">
            <span class="text-ink-soft">Un producto que ya no está disponible</span>
            <button type="button" class="link text-bad" data-remove="${esc(line.key)}">Quitar</button></li>`;
        }
        return `
        <li class="flex gap-4 py-4">
          <a href="/producto/${esc(p.slug)}${line.color ? `?color=${encodeURIComponent(line.color)}` : ''}">${thumb({ ...p, colorHex: line.colorHex }, 'size-20')}</a>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <a href="/producto/${esc(p.slug)}" class="block truncate font-semibold hover:underline">${esc(p.name)}</a>
                ${line.color ? `<p class="mt-0.5 text-[13px] text-ink-soft">Color: ${esc(line.color)}</p>` : ''}
              </div>
              <p class="shrink-0 font-semibold tabular-nums">${money(line.lineTotal)}</p>
            </div>
            ${line.problem ? `<p class="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-bad">${icon('alert', 'size-4')}${esc(line.problem)}</p>` : ''}
            <div class="mt-3 flex items-center justify-between">
              <div class="flex h-9 items-center rounded-full border border-line bg-paper">
                <button type="button" class="grid size-9 place-items-center rounded-full hover:bg-butter-100" data-step="-1" data-key="${esc(line.key)}" aria-label="Restar uno">${icon('minus', 'size-4')}</button>
                <span class="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">${line.quantity}</span>
                <button type="button" class="grid size-9 place-items-center rounded-full hover:bg-butter-100 disabled:opacity-30" data-step="1" data-key="${esc(line.key)}" aria-label="Sumar uno" ${line.quantity >= p.stock ? 'disabled' : ''}>${icon('plus', 'size-4')}</button>
              </div>
              <button type="button" class="text-[13px] text-ink-soft underline-offset-4 hover:text-bad hover:underline" data-remove="${esc(line.key)}">Quitar</button>
            </div>
          </div>
        </li>`;
      }).join('')}
    </ul>`;

  footer.hidden = false;
  footer.innerHTML = `
    <div class="flex items-baseline justify-between">
      <span class="text-ink-soft">Subtotal</span>
      <span class="text-xl font-semibold tabular-nums">${money(subtotal)}</span>
    </div>
    <p class="mt-1 text-[13px] text-ink-soft">El envío y los descuentos se calculan en el siguiente paso.</p>
    ${hasProblems ? `<p class="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">Revisá los productos marcados para continuar.</p>` : ''}
    <a href="/checkout" class="btn btn-dark btn-lg mt-4 w-full ${hasProblems ? 'pointer-events-none opacity-50' : ''}" ${hasProblems ? 'aria-disabled="true" tabindex="-1"' : ''}>Iniciar compra ${icon('arrowRight', 'size-5')}</a>
    <button type="button" data-close class="mt-2 w-full py-2 text-sm font-medium text-ink-soft hover:text-ink">Seguir comprando</button>`;
}

export function openCart() {
  const drawer = ensureDrawer();
  renderCart();
  closeMobileMenu();
  lastFocus = document.activeElement;
  drawer.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      drawer.querySelectorAll('[data-close].absolute, aside').forEach((el) => el.setAttribute('data-open', ''));
      drawer.querySelector('aside [data-close]')?.focus();
    }),
  );
}

export function closeCart({ restoreFocus = true } = {}) {
  const drawer = $('#cart-drawer');
  if (!drawer || drawer.hidden) return;
  drawer.querySelectorAll('[data-open]').forEach((el) => el.removeAttribute('data-open'));
  document.documentElement.style.overflow = '';
  setTimeout(() => {
    drawer.hidden = true;
  }, 300);
  if (restoreFocus) lastFocus?.focus?.();
}

export const isCartOpen = () => $('#cart-drawer')?.hidden === false;

cart.subscribe(() => {
  updateCartBadge();
  if (isCartOpen()) renderCart();
});

export const goTo = (url) => navigateFn(url);

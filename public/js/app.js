// Arranque de la tienda y navegación entre páginas sin recargar.
import { state, loadInitialData } from './store.js';
import { hashMode, currentUrl, toAddress } from './router-url.js';
import { esc } from './ui.js';
import {
  renderAnnouncement, renderHeader, renderFooter, renderWhatsappButton, setActiveNav,
  closeMobileMenu, closeCart, setNavigator,
} from './layout.js';
import { homeView } from './views/home.js';
import { shopView } from './views/shop.js';
import { productView } from './views/product.js';
import { checkoutView } from './views/checkout.js';
import { orderView } from './views/order.js';
import { helpView, trackingView, regretView, demoPayView, notFoundView } from './views/pages.js';

const ROUTES = [
  [/^\/$/, homeView],
  [/^\/tienda\/?$/, shopView],
  [/^\/tienda\/([\w-]+)\/?$/, shopView],
  [/^\/producto\/([\w-]+)\/?$/, productView],
  [/^\/checkout\/?$/, checkoutView],
  [/^\/pedido\/([\w-]+)\/?$/, orderView],
  [/^\/seguimiento\/?$/, trackingView],
  [/^\/ayuda\/?$/, helpView],
  [/^\/arrepentimiento\/?$/, regretView],
  [/^\/pago-demo\/([\w-]+)\/?$/, demoPayView],
];


let cleanup = null;
let renderId = 0;
let firstRender = true;

const skeleton = `
  <div class="wrap grid gap-6 pt-12 lg:grid-cols-2">
    <div class="skeleton aspect-square rounded-tile"></div>
    <div class="space-y-4"><div class="skeleton h-6 w-1/3"></div><div class="skeleton h-12 w-3/4"></div><div class="skeleton h-6 w-1/2"></div></div>
  </div>`;

async function render({ scroll = 'top' } = {}) {
  const id = ++renderId;
  const url = currentUrl();
  const main = document.getElementById('main');
  closeMobileMenu();
  closeCart({ restoreFocus: false });

  let view = notFoundView;
  let params = [];
  for (const [pattern, fn] of ROUTES) {
    const match = url.pathname.match(pattern);
    if (match) {
      view = fn;
      params = match.slice(1);
      break;
    }
  }

  const ctx = { params, query: url.searchParams, navigate, isCurrent: () => id === renderId };
  const loading = setTimeout(() => {
    if (id === renderId) main.innerHTML = skeleton;
  }, 150);

  let result;
  try {
    result = (await view(ctx)) ?? notFoundView();
  } catch (error) {
    console.error(error);
    result = {
      title: 'Error',
      html: `<div class="wrap max-w-xl py-24 text-center"><h1 class="font-display text-4xl">Algo salió mal</h1><p class="mt-3 text-ink-soft">${esc(error.message || 'Probá recargar la página.')}</p><a href="/" class="btn btn-dark mt-8">Volver al inicio</a></div>`,
    };
  }
  clearTimeout(loading);
  if (id !== renderId) return;

  cleanup?.();
  cleanup = null;
  main.innerHTML = result.html;
  document.title = result.title ? `${result.title} · ${state.config.storeName}` : `${state.config.storeName} · ${state.config.tagline}`;
  setActiveNav(url.pathname);
  const teardown = result.mount?.(main, ctx);
  cleanup = typeof teardown === 'function' ? teardown : null;

  if (url.hash) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) target.scrollIntoView();
  } else if (typeof scroll === 'number') {
    window.scrollTo(0, scroll);
  } else if (scroll === 'top' && !firstRender) {
    window.scrollTo(0, 0);
  }
  if (!firstRender && scroll === 'top') main.focus({ preventScroll: true });
  firstRender = false;
}

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  const url = new URL(to, currentUrl());
  const path = url.pathname + url.search + url.hash;
  history.replaceState({ ...(history.state ?? {}), scroll: window.scrollY }, '');
  if (replace) history.replaceState({ scroll: 0 }, '', toAddress(path));
  else history.pushState({ scroll: 0 }, '', toAddress(path));
  render({ scroll: keepScroll ? 'keep' : 'top' });
}

function onLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || /^https?:\/\//.test(href)) return;
  const url = new URL(href, hashMode ? currentUrl() : location.href);
  if (!hashMode && url.origin !== location.origin) return;
  if (/^\/(admin|api|uploads)(\/|$)/.test(url.pathname)) return;
  event.preventDefault();

  const current = currentUrl();
  // Enlace a una sección de la misma página
  if (url.pathname === current.pathname && url.search === current.search && url.hash) {
    document.getElementById(url.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(history.state, '', toAddress(url.pathname + url.search + url.hash));
    return;
  }
  navigate(url.pathname + url.search + url.hash);
}

async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  await loadInitialData();
  setNavigator(navigate);
  renderAnnouncement();
  renderHeader();
  renderFooter();
  renderWhatsappButton();
  document.addEventListener('click', onLinkClick);
  window.addEventListener('popstate', (event) => render({ scroll: event.state?.scroll ?? 0 }));
  await render({ scroll: 'keep' });
}

boot().catch((error) => {
  console.error(error);
  document.getElementById('main').innerHTML = `
    <div class="wrap max-w-xl py-24 text-center">
      <h1 class="font-display text-4xl">No pudimos cargar la tienda</h1>
      <p class="mt-3 text-ink-soft">Revisá tu conexión y recargá la página.</p>
    </div>`;
});

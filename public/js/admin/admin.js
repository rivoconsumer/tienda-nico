// Panel de administración: inicio de sesión, navegación y estructura general.
import { icon } from '../icons.js';
import { esc, toast } from '../ui.js';
import { adminApi, setUnauthorizedHandler, closeDrawer, setPendingCount, storeLink, storeTarget } from './common.js';
import { dashboardView } from './dashboard.js';
import { ordersView } from './orders.js';
import { productsView } from './products.js';
import { settingsView } from './settings.js';

const root = document.getElementById('admin-root');
const NAV = [
  { id: 'resumen', label: 'Resumen', icon: 'grid' },
  { id: 'pedidos', label: 'Pedidos', icon: 'list' },
  { id: 'productos', label: 'Productos', icon: 'box' },
  { id: 'ajustes', label: 'Ajustes', icon: 'sliders' },
];
const VIEWS = { resumen: dashboardView, pedidos: ordersView, productos: productsView, ajustes: settingsView };
const MODE_CHIP = {
  demo: ['Pagos en modo demo', 'bg-wait-soft text-wait'],
  test: ['Mercado Pago (prueba)', 'bg-mist text-[#2c5a70]'],
  live: ['Mercado Pago activo', 'bg-ok-soft text-ok'],
};

const session = { storeName: 'Tienda', temporaryPassword: false, paymentMode: 'demo' };
let cleanup = null;
let currentSection = null;

/** Lee el hash: #pedidos/1001?estado=pagado → { section, id, params } */
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [section = 'resumen', id = null] = path.split('/');
  return { section: VIEWS[section] ? section : 'resumen', id, params: new URLSearchParams(query) };
}

export function go(hash, { replace = false } = {}) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (replace) {
    history.replaceState(null, '', target);
    route();
  } else if (location.hash === target) {
    route();
  } else {
    location.hash = target;
  }
}

function loginScreen(message = '') {
  closeDrawer({ silent: true });
  cleanup?.();
  cleanup = null;
  currentSection = null;
  root.innerHTML = `
    <div class="grid min-h-dvh place-items-center px-4 py-10">
      <div class="w-full max-w-sm">
        <p class="text-center font-display text-4xl">${esc(session.storeName)}<span class="ml-0.5 inline-block size-2 rounded-full bg-butter-500 align-baseline"></span></p>
        <form class="mt-8 rounded-[1.75rem] border border-line bg-paper p-6 shadow-float sm:p-7" data-login novalidate>
          <h1 class="font-display text-2xl">Panel de la tienda</h1>
          <p class="mt-1 text-sm text-ink-soft">Ingresá para ver pedidos, productos y ajustes.</p>
          <div class="mt-6">
            <label for="password" class="label">Contraseña</label>
            <input id="password" name="password" type="password" class="input" autocomplete="current-password" required autofocus>
          </div>
          <p class="mt-3 text-sm font-medium text-bad" data-login-error role="alert">${esc(message)}</p>
          <button type="submit" class="btn btn-dark mt-2 w-full">Ingresar</button>
          ${window.__demo ? `<p class="mt-5 rounded-xl bg-butter-100 p-3 text-sm text-ink">${icon('info', 'size-4 inline -mt-0.5 mr-1')}Vista previa: la contraseña es <b>demo</b>.</p>` : ''}
          ${session.temporaryPassword ? `<p class="mt-5 rounded-xl bg-butter-100 p-3 text-xs leading-relaxed text-ink-soft">${icon('info', 'size-4 inline -mt-0.5 mr-1')}La contraseña temporal aparece en la consola donde iniciaste la tienda. Para fijar una propia, definí <b>ADMIN_PASSWORD</b> en el archivo <b>.env</b>.</p>` : ''}
        </form>
        <p class="mt-6 text-center text-sm"><a href="${storeLink('/')}" class="link text-ink-soft">Volver a la tienda</a></p>
      </div>
    </div>`;
  const form = root.querySelector('[data-login]');
  form.querySelector('input').focus();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await adminApi('POST', '/api/admin/login', { password: form.password.value });
      await start();
    } catch (error) {
      form.querySelector('[data-login-error]').textContent = error.message;
      form.password.select();
    } finally {
      button.disabled = false;
    }
  });
}

function shell() {
  const [modeText, modeCls] = MODE_CHIP[session.paymentMode] ?? MODE_CHIP.demo;
  const link = (item, mobile = false) => `
    <a href="#${item.id}" data-nav="${item.id}" class="${mobile
      ? 'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft aria-[current=page]:bg-ink aria-[current=page]:text-cream'
      : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink-soft transition-colors hover:bg-butter-100 hover:text-ink aria-[current=page]:bg-butter-200 aria-[current=page]:text-ink'}">
      ${icon(item.icon, 'size-[18px]')}<span>${item.label}</span>
      ${item.id === 'pedidos' ? `<span data-pending-badge class="ml-auto rounded-full bg-butter-400 px-1.5 text-[11px] font-bold text-ink tabular-nums" title="Pendientes de pago" hidden></span>` : ''}
    </a>`;
  root.innerHTML = `
    <div class="min-h-dvh lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside class="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
        <a href="#resumen" class="px-3 font-display text-[28px] leading-none">${esc(session.storeName)}<span class="ml-0.5 inline-block size-1.5 rounded-full bg-butter-500"></span></a>
        <p class="mt-1.5 px-3 text-xs text-ink-soft">Panel de la tienda</p>
        <nav class="mt-8 space-y-1" aria-label="Secciones">${NAV.map((n) => link(n)).join('')}</nav>
        <div class="mt-auto space-y-1 border-t border-line pt-4">
          <p class="mb-3 px-3"><span class="chip ${modeCls}">${modeText}</span></p>
          <a href="${storeLink('/')}" target="${storeTarget()}" rel="noopener" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink-soft hover:bg-butter-100 hover:text-ink">${icon('external', 'size-[18px]')}Ver tienda</a>
          <button type="button" data-logout class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink-soft hover:bg-butter-100 hover:text-ink">${icon('logout', 'size-[18px]')}Salir</button>
        </div>
      </aside>
      <div class="min-w-0">
        <header class="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur lg:hidden">
          <div class="flex items-center justify-between px-4 pt-3">
            <a href="#resumen" class="font-display text-2xl">${esc(session.storeName)}</a>
            <div class="flex items-center gap-1">
              <a href="${storeLink('/')}" target="${storeTarget()}" rel="noopener" class="icon-btn" aria-label="Ver tienda">${icon('external', 'size-5')}</a>
              <button type="button" data-logout class="icon-btn" aria-label="Salir">${icon('logout', 'size-5')}</button>
            </div>
          </div>
          <nav class="scrollbar-none flex gap-1 overflow-x-auto px-3 py-2.5" aria-label="Secciones">${NAV.map((n) => link(n, true)).join('')}</nav>
        </header>
        <main id="admin-main" class="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10" tabindex="-1"></main>
      </div>
    </div>`;
  root.querySelectorAll('[data-logout]').forEach((b) =>
    b.addEventListener('click', async () => {
      await adminApi('POST', '/api/admin/logout').catch(() => {});
      loginScreen();
    }),
  );
  adminApi('GET', '/api/admin/orders?pageSize=1')
    .then((data) => setPendingCount(data.counts.pendiente))
    .catch(() => {});
}

async function route() {
  if (!document.getElementById('admin-main')) return;
  const { section, id, params } = parseHash();
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const main = document.getElementById('admin-main');
  const sameSection = currentSection === section;
  const view = VIEWS[section];
  if (!sameSection) {
    cleanup?.();
    cleanup = null;
    closeDrawer({ silent: true });
    delete main.dataset.listKey;
    currentSection = section;
    main.innerHTML = `<div class="space-y-4"><div class="skeleton h-10 w-48"></div><div class="skeleton h-40"></div></div>`;
    window.scrollTo(0, 0);
  }
  try {
    const result = await view({ main, id, params, sameSection, go, session });
    if (typeof result === 'function') {
      cleanup?.();
      cleanup = result;
    }
  } catch (error) {
    if (error.status === 401) return;
    console.error(error);
    main.innerHTML = `<div class="rounded-2xl bg-bad-soft p-5 text-bad">${esc(error.message)}</div>`;
  }
  document.title = `${NAV.find((n) => n.id === section)?.label ?? 'Panel'} · ${session.storeName}`;
}

async function start() {
  shell();
  await route();
}

async function boot() {
  setUnauthorizedHandler((message) => {
    loginScreen(message || 'Tu sesión venció. Volvé a ingresar.');
    toast('Tu sesión venció', { tone: 'error' });
  });
  window.addEventListener('hashchange', route);
  if (window.__demo) {
    // En la vista previa no se pueden descargar archivos
    document.addEventListener('click', (event) => {
      if (!event.target.closest('a[download]')) return;
      event.preventDefault();
      toast('En la vista previa no se descargan archivos. En tu tienda instalada, sí.');
    });
  }
  let me;
  try {
    me = await adminApi('GET', '/api/admin/me');
  } catch {
    me = { authenticated: false };
  }
  session.storeName = me.storeName ?? session.storeName;
  session.temporaryPassword = Boolean(me.temporaryPassword);
  session.paymentMode = me.paymentMode ?? 'demo';
  if (!me.authenticated) return loginScreen();
  await start();
}

export { session };
boot();

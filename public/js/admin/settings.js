import { icon } from '../icons.js';
import { esc, toast, copyText } from '../ui.js';
import { adminApi } from './common.js';

const text = (name, label, value, { hint = '', placeholder = '', max = 160, span = '' } = {}) => `
  <div class="${span}">
    <label for="s-${name}" class="label">${label}</label>
    <input id="s-${name}" name="${name}" class="input" value="${esc(value)}" maxlength="${max}" placeholder="${esc(placeholder)}">
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;

const area = (name, label, value, { hint = '', rows = 3, max = 1500, span = 'sm:col-span-2' } = {}) => `
  <div class="${span}">
    <label for="s-${name}" class="label">${label}</label>
    <textarea id="s-${name}" name="${name}" class="input" rows="${rows}" maxlength="${max}">${esc(value)}</textarea>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;

const number = (name, label, value, { prefix = '', suffix = '', hint = '', min = 0, max = 1_000_000_000 } = {}) => `
  <div>
    <label for="s-${name}" class="label">${label}</label>
    <div class="relative">
      ${prefix ? `<span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">${prefix}</span>` : ''}
      <input id="s-${name}" name="${name}" type="number" min="${min}" max="${max}" step="1" inputmode="numeric" class="input ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}" value="${esc(value)}">
      ${suffix ? `<span class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-soft">${suffix}</span>` : ''}
    </div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;

const toggle = (name, label, checked, hint = '') => `
  <label class="flex items-start justify-between gap-4 rounded-2xl border border-line bg-cream/60 p-4 sm:col-span-2">
    <span><span class="block font-semibold">${label}</span>${hint ? `<span class="mt-0.5 block text-sm text-ink-soft">${hint}</span>` : ''}</span>
    <span class="switch mt-0.5"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span></span></span>
  </label>`;

const section = (id, title, intro, body) => `
  <section id="${id}" class="scroll-mt-28 rounded-[1.75rem] border border-line bg-paper p-5 sm:p-7" aria-labelledby="${id}-title">
    <h2 id="${id}-title" class="font-display text-2xl">${title}</h2>
    ${intro ? `<p class="mt-1 text-sm text-ink-soft">${intro}</p>` : ''}
    <div class="mt-5 grid gap-4 sm:grid-cols-2">${body}</div>
  </section>`;

function mercadoPagoCard(env) {
  const modes = {
    demo: ['Modo demo', 'bg-wait-soft text-wait', 'Los pagos se simulan. Ideal para probar la tienda antes de publicarla.'],
    test: ['Credenciales de prueba', 'bg-mist text-[#2c5a70]', 'Mercado Pago está conectado en modo prueba: podés pagar con tarjetas de prueba sin cobrar de verdad.'],
    live: ['Cobrando con Mercado Pago', 'bg-ok-soft text-ok', 'Los pagos son reales y llegan a tu cuenta de Mercado Pago.'],
  };
  const [label, cls, desc] = modes[env.paymentMode] ?? modes.demo;
  return `
    <section id="mercadopago" class="scroll-mt-28 rounded-[1.75rem] border border-line bg-paper p-5 sm:p-7" aria-labelledby="mp-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mp-title" class="font-display text-2xl">Mercado Pago</h2>
        <span class="chip ${cls}">${label}</span>
      </div>
      <p class="mt-2 text-sm text-ink-soft">${desc}</p>
      <ol class="mt-5 space-y-3 text-sm">
        <li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-butter-200 text-xs font-bold">1</span><span>Entrá a <b>Mercado Pago Developers → Tus integraciones</b>, creá una aplicación y copiá el <b>Access Token</b> (el de prueba empieza con TEST-).</span></li>
        <li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-butter-200 text-xs font-bold">2</span><span>Pegalo en el archivo <b>.env</b> como <code class="rounded bg-cream px-1.5 py-0.5">MP_ACCESS_TOKEN</code> y completá <code class="rounded bg-cream px-1.5 py-0.5">PUBLIC_URL</code> con la dirección de tu tienda.</span></li>
        <li class="flex gap-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-butter-200 text-xs font-bold">3</span><span>En <b>Webhooks</b> de tu aplicación, cargá esta dirección para el evento <b>Pagos</b> y copiá la clave secreta en <code class="rounded bg-cream px-1.5 py-0.5">MP_WEBHOOK_SECRET</code>.</span></li>
      </ol>
      <div class="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-cream p-3">
        <code class="min-w-0 flex-1 truncate text-sm select-all">${esc(env.webhookUrl ?? 'https://tu-tienda.com/api/webhooks/mercadopago')}</code>
        ${env.webhookUrl ? `<button type="button" class="btn btn-ghost btn-sm bg-paper" data-copy="${esc(env.webhookUrl)}">${icon('copy', 'size-4')} Copiar</button>` : ''}
      </div>
      <ul class="mt-4 space-y-1.5 text-sm">
        <li class="flex items-center gap-2">${icon(env.publicUrl ? 'check' : 'alert', `size-4 ${env.publicUrl ? 'text-ok' : 'text-wait'}`)} Dirección pública ${env.publicUrl ? `configurada: ${esc(env.publicUrl)}` : 'sin configurar (PUBLIC_URL)'}</li>
        <li class="flex items-center gap-2">${icon(env.webhookSecret ? 'check' : 'alert', `size-4 ${env.webhookSecret ? 'text-ok' : 'text-wait'}`)} Clave secreta de webhooks ${env.webhookSecret ? 'cargada' : 'sin cargar (opcional, recomendada)'}</li>
        <li class="flex items-center gap-2">${icon(env.temporaryPassword ? 'alert' : 'check', `size-4 ${env.temporaryPassword ? 'text-wait' : 'text-ok'}`)} Contraseña del panel ${env.temporaryPassword ? 'temporal: definí ADMIN_PASSWORD' : 'fija'}</li>
      </ul>
      <p class="mt-4 text-xs text-ink-soft">Por seguridad, las claves se cargan solo en el archivo .env del servidor y nunca se muestran acá. Después de cambiarlas, reiniciá la tienda.</p>
    </section>`;
}

export async function settingsView({ main }) {
  const { settings: s, environment: env } = await adminApi('GET', '/api/admin/settings');

  main.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-4xl leading-none sm:text-5xl">Ajustes</h1>
        <p class="mt-2 text-ink-soft">Textos de la tienda, envíos, pagos y contacto.</p>
      </div>
    </div>
    <nav class="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 text-sm lg:mx-0 lg:px-0" aria-label="Secciones de ajustes">
      ${[['tienda', 'Tienda'], ['portada', 'Portada'], ['contacto', 'Contacto'], ['envios', 'Envíos y retiro'], ['pagos', 'Pagos'], ['mercadopago', 'Mercado Pago'], ['respaldo', 'Copia de seguridad']]
        .map(([id, label]) => `<a href="#ajustes" data-jump="${id}" class="shrink-0 rounded-full border border-line bg-paper px-3.5 py-1.5 font-medium hover:border-ink/30">${label}</a>`).join('')}
    </nav>

    <form class="mt-6 space-y-6" data-settings novalidate>
      <div data-settings-error></div>
      ${section('tienda', 'Tienda', 'Cómo se presenta tu marca.', `
        ${text('store_name', 'Nombre de la tienda', s.store_name, { max: 60 })}
        ${text('store_tagline', 'Bajada', s.store_tagline, { max: 80, placeholder: 'Marroquinería artesanal' })}
        ${text('announcement', 'Barra de anuncio', s.announcement, { max: 160, span: 'sm:col-span-2', hint: 'Aparece arriba de todo. Dejala vacía para ocultarla.' })}
      `)}
      ${section('portada', 'Portada', 'El primer texto que ve tu cliente.', `
        ${text('hero_eyebrow', 'Texto chico de arriba', s.hero_eyebrow, { max: 80 })}
        ${text('hero_title', 'Título principal', s.hero_title, { max: 140, hint: 'Poné *entre asteriscos* las palabras que querés resaltar en amarillo.' })}
        ${area('hero_subtitle', 'Subtítulo', s.hero_subtitle, { rows: 2, max: 320 })}
        ${text('about_title', 'Título de "El taller"', s.about_title, { max: 140, span: 'sm:col-span-2' })}
        ${area('about_text', 'Texto de "El taller"', s.about_text, { rows: 5, hint: 'Dejá una línea en blanco para separar párrafos.' })}
      `)}
      ${section('contacto', 'Contacto', 'Se muestran en el pie de la tienda y en el botón flotante de WhatsApp.', `
        ${text('contact_whatsapp', 'WhatsApp', s.contact_whatsapp, { max: 20, placeholder: '5491123456789', hint: 'Con código de país y sin el 15: 549 + característica + número.' })}
        ${text('contact_email', 'Email', s.contact_email, { max: 120, placeholder: 'hola@tutienda.com.ar' })}
        ${text('contact_instagram', 'Instagram', s.contact_instagram, { max: 60, placeholder: '@tutienda' })}
        ${text('data_fiscal_url', 'Link de Data Fiscal (ARCA)', s.data_fiscal_url, { max: 300, placeholder: 'https://qr.afip.gob.ar/?qr=…', span: 'sm:col-span-2', hint: 'El link del QR de Data Fiscal que te da ARCA (ex AFIP). Es obligatorio para vender online en Argentina; aparece en el pie de la tienda.' })}
      `)}
      ${section('envios', 'Envíos y retiro', 'Cómo reciben tus clientes sus compras.', `
        ${toggle('shipping_enabled', 'Envío a domicilio', s.shipping_enabled, 'Ofrecer envío a todo el país.')}
        ${number('shipping_cost', 'Costo del envío', s.shipping_cost, { prefix: '$' })}
        ${number('free_shipping_from', 'Envío gratis desde', s.free_shipping_from, { prefix: '$', hint: 'Poné 0 si no ofrecés envío gratis.' })}
        ${text('shipping_days', 'Tiempos de entrega', s.shipping_days, { max: 160, span: 'sm:col-span-2' })}
        ${toggle('pickup_enabled', 'Retiro en el taller', s.pickup_enabled, 'Sin cargo para el cliente.')}
        ${text('pickup_address', 'Dirección de retiro', s.pickup_address, { max: 200, span: 'sm:col-span-2', hint: 'Si no querés publicar la dirección exacta, poné solo el barrio.' })}
        ${text('pickup_hours', 'Horarios de retiro', s.pickup_hours, { max: 120, span: 'sm:col-span-2' })}
      `)}
      ${section('pagos', 'Pagos', 'Cuotas y transferencia bancaria.', `
        ${number('installments', 'Cuotas sin interés a mostrar', s.installments, { max: 24, hint: 'Mostralas solo si las ofrecés en tu cuenta de Mercado Pago. Con 0 se muestra "Pagá en cuotas".' })}
        <div class="hidden sm:block"></div>
        ${toggle('transfer_enabled', 'Pago con transferencia', s.transfer_enabled, 'Aparece en el checkout cuando cargás alias o CBU.')}
        ${number('transfer_discount', 'Descuento por transferencia', s.transfer_discount, { suffix: '%', max: 50 })}
        ${text('transfer_alias', 'Alias', s.transfer_alias, { max: 40, placeholder: 'mi.tienda.mp' })}
        ${text('transfer_cbu', 'CBU o CVU', s.transfer_cbu, { max: 30 })}
        ${text('transfer_holder', 'Titular de la cuenta', s.transfer_holder, { max: 80 })}
        ${text('transfer_bank', 'Banco o billetera', s.transfer_bank, { max: 60 })}
      `)}

      <div class="sticky bottom-0 z-10 -mx-4 border-t border-line bg-cream/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-ink-soft" data-dirty>Los cambios se ven en la tienda apenas guardás.</p>
          <button type="submit" class="btn btn-dark btn-sm">${icon('check', 'size-4')} Guardar ajustes</button>
        </div>
      </div>
    </form>

    <div class="mt-6 space-y-6">
      ${mercadoPagoCard(env)}
      <section id="respaldo" class="scroll-mt-28 rounded-[1.75rem] border border-line bg-paper p-5 sm:p-7" aria-labelledby="backup-title">
        <h2 id="backup-title" class="font-display text-2xl">Copia de seguridad</h2>
        <p class="mt-1 text-sm text-ink-soft">Descargá un archivo con todos tus productos, pedidos y ajustes. Guardalo en un lugar seguro, por ejemplo una vez por semana.</p>
        <a href="/api/admin/backup" class="btn btn-ghost btn-sm mt-4" download>${icon('download', 'size-4')} Descargar copia (.db)</a>
      </section>
    </div>`;

  const form = main.querySelector('[data-settings]');
  const dirty = main.querySelector('[data-dirty]');
  form.addEventListener('input', () => {
    dirty.textContent = 'Tenés cambios sin guardar.';
    dirty.classList.add('font-semibold', 'text-ink');
  });
  main.querySelectorAll('[data-jump]').forEach((a) =>
    a.addEventListener('click', (event) => {
      event.preventDefault();
      main.querySelector(`#${a.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }),
  );
  main.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => toast((await copyText(b.dataset.copy)) ? 'Dirección copiada' : 'No se pudo copiar')),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = form.querySelector('[data-settings-error]');
    errorBox.innerHTML = '';
    const payload = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      payload[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value || 0) : el.value;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await adminApi('PUT', '/api/admin/settings', payload);
      toast('Ajustes guardados');
      dirty.textContent = 'Guardado. Los cambios ya se ven en la tienda.';
      dirty.classList.remove('font-semibold', 'text-ink');
    } catch (error) {
      errorBox.innerHTML = `<p class="flex items-start gap-2 rounded-2xl bg-bad-soft p-4 text-sm font-medium text-bad" role="alert">${icon('alert', 'size-5 shrink-0')}${esc(error.message)}</p>`;
      const field = error.field && form.querySelector(`[name="${error.field}"]`);
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        field.focus({ preventScroll: true });
      } else {
        errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } finally {
      button.disabled = false;
    }
  });
}

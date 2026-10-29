import { icon } from '../icons.js';
import { illustration, ILLUSTRATIONS } from '../illustrations.js';
import { esc, money, thumb, toast } from '../ui.js';
import { productCard } from '../views/components.js';
import { adminApi, openDrawer, closeDrawer, drawerHeader, confirmButton, emptyState } from './common.js';

// Colores de cuero sugeridos para agregar con un toque
const LEATHER = [
  ['Manteca', '#F2DE9B'], ['Miel', '#E3B967'], ['Suela', '#BE8A5C'], ['Chocolate', '#6E4B39'],
  ['Negro', '#34302B'], ['Rosa empolvado', '#EBC3B9'], ['Salvia', '#BFCFB2'], ['Celeste', '#BED5E2'],
  ['Lavanda', '#D2C7E5'], ['Crudo', '#E8DBC0'], ['Durazno', '#F1C7A6'], ['Verde oliva', '#8E8F5C'],
];

let products = [];

function listHtml() {
  if (!products.length) {
    return emptyState({
      iconName: 'box',
      title: 'Todavía no cargaste productos',
      text: 'Agregá tu primer producto con fotos, precio, stock y colores.',
      action: `<a href="#productos/nuevo" class="btn btn-dark mt-6">${icon('plus', 'size-4')} Nuevo producto</a>`,
    });
  }
  return `
    <ul class="divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-paper">
      ${products.map((p) => `
        <li class="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap sm:px-5 ${p.active ? '' : 'bg-cream/60'}" data-product="${p.id}">
          <a href="#productos/${p.id}" class="flex min-w-0 flex-1 basis-56 items-center gap-4">
            <span class="${p.active ? '' : 'opacity-50'}">${thumb({ ...p, colorHex: p.colors[0]?.hex }, 'size-14')}</span>
            <span class="min-w-0">
              <span class="flex items-center gap-2"><span class="truncate font-semibold">${esc(p.name)}</span>${p.active ? '' : '<span class="chip bg-ink/10 text-ink-soft">Oculto</span>'}</span>
              <span class="block truncate text-xs text-ink-soft">${esc(p.category)} · ${p.colors.length ? `${p.colors.length} ${p.colors.length === 1 ? 'color' : 'colores'}` : 'sin colores'} · ${p.sold} ${p.sold === 1 ? 'vendido' : 'vendidos'}</span>
            </span>
          </a>
          <span class="w-24 text-right font-semibold tabular-nums">${money(p.price)}</span>
          <label class="flex items-center gap-2 text-xs text-ink-soft">
            Stock
            <input type="number" min="0" step="1" inputmode="numeric" value="${p.stock}" class="input h-9 w-20 px-2 text-center text-sm font-semibold tabular-nums ${p.stock <= 0 ? 'border-bad/50 text-bad' : p.stock <= 3 ? 'border-butter-500' : ''}" data-stock aria-label="Stock de ${esc(p.name)}">
          </label>
          <button type="button" class="icon-btn ${p.featured ? 'text-butter-500' : 'text-ink-faint'}" data-featured aria-pressed="${p.featured}" aria-label="${p.featured ? 'Quitar de destacados' : 'Destacar en la portada'}" title="Destacado en la portada">
            ${icon('star', `size-5 ${p.featured ? 'fill-current' : ''}`)}
          </button>
          <label class="switch" title="${p.active ? 'Visible en la tienda' : 'Oculto en la tienda'}">
            <input type="checkbox" data-active ${p.active ? 'checked' : ''} aria-label="Visible en la tienda">
            <span></span>
          </label>
          <a href="#productos/${p.id}" class="btn btn-ghost btn-sm">${icon('edit', 'size-4')}<span class="hidden sm:inline">Editar</span></a>
        </li>`).join('')}
    </ul>`;
}

function pageHtml() {
  const hidden = products.filter((p) => !p.active).length;
  return `
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-4xl leading-none sm:text-5xl">Productos</h1>
        <p class="mt-2 text-ink-soft">${products.length} ${products.length === 1 ? 'producto' : 'productos'}${hidden ? ` · ${hidden} ${hidden === 1 ? 'oculto' : 'ocultos'}` : ''}</p>
      </div>
      <a href="#productos/nuevo" class="btn btn-dark btn-sm">${icon('plus', 'size-4')} Nuevo producto</a>
    </div>
    <p class="mt-4 text-sm text-ink-soft">Cambiá el stock directo en la lista. La estrella destaca el producto en la portada y la llave lo muestra u oculta en la tienda.</p>
    <div class="mt-5" data-list>${listHtml()}</div>`;
}

async function quickUpdate(id, patch) {
  const updated = await adminApi('PATCH', `/api/admin/products/${id}`, patch);
  products = products.map((p) => (p.id === id ? { ...p, ...updated } : p));
  return updated;
}

// ── Formulario ───────────────────────────────────────────────
const emptyProduct = () => ({
  id: null, name: '', category: '', price: '', compareAtPrice: '', stock: 1, description: '', details: [],
  colors: [], illustration: 'tote', imageUrl: null, featured: false, active: true, slug: '',
});

function colorRow(c = { name: '', hex: '#E3B967' }) {
  return `
    <li class="flex items-center gap-2" data-color-row>
      <input type="color" value="${esc(c.hex)}" class="size-11 shrink-0 cursor-pointer rounded-xl border border-line bg-paper p-1" aria-label="Color" data-color-hex>
      <input type="text" value="${esc(c.name)}" class="input h-11" placeholder="Nombre del color" maxlength="30" aria-label="Nombre del color" data-color-name>
      <button type="button" class="icon-btn shrink-0 text-ink-soft hover:text-bad" data-color-remove aria-label="Quitar color">${icon('trash', 'size-4')}</button>
    </li>`;
}

function formHtml(p, categories) {
  const isNew = !p.id;
  return `
    ${drawerHeader(isNew ? 'Nuevo producto' : esc(p.name), isNew ? 'Completá los datos y guardá para publicarlo.' : `Editando · ${p.sold ?? 0} vendidos`)}
    <form class="flex min-h-0 flex-1 flex-col" data-product-form novalidate>
      <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div class="space-y-6">
            <div data-form-error></div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label for="p-name" class="label">Nombre</label>
                <input id="p-name" name="name" class="input" value="${esc(p.name)}" maxlength="80" required ${isNew ? 'autofocus' : ''} placeholder="Por ejemplo: Bandolera Lola">
              </div>
              <div>
                <label for="p-category" class="label">Categoría</label>
                <input id="p-category" name="category" class="input" value="${esc(p.category)}" list="p-categories" maxlength="40" required placeholder="Carteras">
                <datalist id="p-categories">${categories.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
              </div>
              <div>
                <label for="p-stock" class="label">Stock</label>
                <input id="p-stock" name="stock" type="number" min="0" step="1" inputmode="numeric" class="input" value="${esc(p.stock)}" required>
              </div>
              <div>
                <label for="p-price" class="label">Precio</label>
                <div class="relative"><span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">$</span>
                <input id="p-price" name="price" type="number" min="1" step="1" inputmode="numeric" class="input pl-8" value="${esc(p.price)}" required placeholder="89000"></div>
              </div>
              <div>
                <label for="p-compare" class="label">Precio anterior <span class="font-normal text-ink-faint">(opcional)</span></label>
                <div class="relative"><span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">$</span>
                <input id="p-compare" name="compareAtPrice" type="number" min="1" step="1" inputmode="numeric" class="input pl-8" value="${esc(p.compareAtPrice ?? '')}" placeholder="Para mostrar descuento"></div>
              </div>
            </div>

            <div>
              <label for="p-description" class="label">Descripción</label>
              <textarea id="p-description" name="description" class="input" rows="3" maxlength="2000" placeholder="Contá cómo es, para qué sirve y qué la hace especial.">${esc(p.description)}</textarea>
            </div>
            <div>
              <label for="p-details" class="label">Detalles y medidas <span class="font-normal text-ink-faint">(uno por línea)</span></label>
              <textarea id="p-details" name="details" class="input" rows="4" maxlength="2000" placeholder="Medidas: 22 × 16 × 7 cm&#10;Cuero vacuno de 1,8 mm">${esc((p.details ?? []).join('\n'))}</textarea>
            </div>

            <fieldset>
              <legend class="label">Colores disponibles</legend>
              <p class="hint mb-3 mt-0">El cliente elige uno al comprar. Si no cargás colores, se vende sin elegir color.</p>
              <ul class="space-y-2" data-colors>${p.colors.map(colorRow).join('')}</ul>
              <button type="button" class="btn btn-ghost btn-sm mt-3" data-color-add>${icon('plus', 'size-4')} Agregar color</button>
              <div class="mt-3 flex flex-wrap gap-1.5" aria-label="Colores sugeridos">
                ${LEATHER.map(([name, hex]) => `<button type="button" class="flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pr-2.5 pl-1 text-xs hover:border-ink/30" data-color-preset="${esc(name)}|${hex}"><span class="size-4 rounded-full ring-1 ring-ink/10" style="background:${hex}"></span>${esc(name)}</button>`).join('')}
              </div>
            </fieldset>

            <fieldset>
              <legend class="label">Imagen</legend>
              <p class="hint mb-3 mt-0">Subí una foto (se achica sola para que cargue rápido) o usá una ilustración, que toma el color elegido.</p>
              <div class="flex flex-wrap items-center gap-3">
                <label class="btn btn-ghost btn-sm cursor-pointer">${icon('upload', 'size-4')} ${p.imageUrl ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="sr-only" data-upload>
                </label>
                <button type="button" class="btn btn-ghost btn-sm" data-remove-image ${p.imageUrl ? '' : 'hidden'}>${icon('trash', 'size-4')} Quitar foto</button>
                <span class="text-sm text-ink-soft" data-upload-status></span>
              </div>
              <input type="hidden" name="imageUrl" value="${esc(p.imageUrl ?? '')}">
              <div class="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 ${p.imageUrl ? 'opacity-40' : ''}" data-illustrations role="radiogroup" aria-label="Ilustración">
                ${Object.entries(ILLUSTRATIONS).map(([key, label]) => `
                  <label class="cursor-pointer" title="${esc(label)}">
                    <input type="radio" name="illustration" value="${key}" class="peer sr-only" ${key === p.illustration ? 'checked' : ''}>
                    <span class="grid aspect-square place-items-center rounded-xl border border-line bg-paper transition peer-checked:border-ink peer-checked:bg-butter-100 peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
                      <span class="w-[82%]" data-ill-preview="${key}">${illustration(key, p.colors[0]?.hex ?? '#E3B967')}</span>
                    </span>
                    <span class="sr-only">${esc(label)}</span>
                  </label>`).join('')}
              </div>
            </fieldset>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="option">
                <input type="checkbox" name="active" class="peer sr-only" ${p.active ? 'checked' : ''}>
                <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-ink/25 bg-paper text-transparent peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream">${icon('check', 'size-3.5')}</span>
                <span><span class="block font-semibold">Visible en la tienda</span><span class="block text-sm text-ink-soft">Si lo apagás, queda guardado pero oculto.</span></span>
              </label>
              <label class="option">
                <input type="checkbox" name="featured" class="peer sr-only" ${p.featured ? 'checked' : ''}>
                <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-ink/25 bg-paper text-transparent peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream">${icon('check', 'size-3.5')}</span>
                <span><span class="block font-semibold">Destacado</span><span class="block text-sm text-ink-soft">Aparece en "Favoritos del taller".</span></span>
              </label>
            </div>

            <details class="rounded-2xl border border-line bg-paper p-4">
              <summary class="text-sm font-semibold">Opciones avanzadas</summary>
              <div class="mt-4">
                <label for="p-slug" class="label">Dirección web (slug)</label>
                <div class="flex items-center gap-2"><span class="shrink-0 text-sm text-ink-soft">/producto/</span><input id="p-slug" name="slug" class="input h-10" value="${esc(p.slug)}" placeholder="se completa solo"></div>
                <p class="hint">Dejalo vacío para generarla con el nombre.</p>
              </div>
            </details>
          </div>

          <aside class="hidden lg:block">
            <div class="sticky top-0">
              <p class="eyebrow mb-3">Así se ve en la tienda</p>
              <div data-preview></div>
            </div>
          </aside>
        </div>
      </div>
      <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        ${isNew ? '<span></span>' : `<button type="button" class="btn btn-danger btn-sm" data-delete>${icon('trash', 'size-4')} Eliminar</button>`}
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost btn-sm" data-drawer-close>Cancelar</button>
          <button type="submit" class="btn btn-dark btn-sm">${icon('check', 'size-4')} ${isNew ? 'Crear producto' : 'Guardar'}</button>
        </div>
      </footer>
    </form>`;
}

/** Achica la foto en el navegador antes de subirla (máx. 1600 px, JPG). */
async function resizeImage(file, max = 1600) {
  if (file.size < 700_000 && file.type !== 'image/png') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function readForm(form, product) {
  const colors = [...form.querySelectorAll('[data-color-row]')].map((row) => ({
    name: row.querySelector('[data-color-name]').value.trim(),
    hex: row.querySelector('[data-color-hex]').value,
  })).filter((c) => c.name);
  return {
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    price: form.price.value === '' ? '' : Number(form.price.value),
    compareAtPrice: form.compareAtPrice.value === '' ? null : Number(form.compareAtPrice.value),
    stock: form.stock.value === '' ? '' : Number(form.stock.value),
    description: form.description.value,
    details: form.details.value.split('\n').map((d) => d.trim()).filter(Boolean),
    colors,
    illustration: form.illustration.value || 'tote',
    imageUrl: form.imageUrl.value || null,
    featured: form.featured.checked,
    active: form.active.checked,
    slug: form.slug.value.trim(),
    sort: product.sort,
  };
}

function openForm(product, { go, reload }) {
  const categories = [...new Set(products.map((p) => p.category))];
  const panel = openDrawer({ label: product.id ? `Editar ${product.name}` : 'Nuevo producto', html: formHtml(product, categories), wide: true, onClose: () => go('#productos') });
  const form = panel.querySelector('[data-product-form]');
  const colorsList = form.querySelector('[data-colors]');
  const errorBox = form.querySelector('[data-form-error]');

  const updatePreview = () => {
    const data = readForm(form, product);
    const preview = {
      id: product.id ?? 0, slug: data.slug || 'vista-previa', name: data.name || 'Nombre del producto', category: data.category || 'Categoría',
      price: Number(data.price) || 0, compareAtPrice: data.compareAtPrice, stock: Number(data.stock) || 0, colors: data.colors,
      illustration: data.illustration, imageUrl: data.imageUrl, featured: data.featured,
    };
    const holder = panel.querySelector('[data-preview]');
    if (holder) holder.innerHTML = `<div class="pointer-events-none">${productCard(preview)}</div>`;
    const firstHex = data.colors[0]?.hex ?? '#E3B967';
    panel.querySelectorAll('[data-ill-preview]').forEach((el) => (el.innerHTML = illustration(el.dataset.illPreview, firstHex)));
    panel.querySelector('[data-illustrations]').classList.toggle('opacity-40', Boolean(data.imageUrl));
  };
  let previewTimer = null;
  const schedulePreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 120);
  };

  form.addEventListener('input', schedulePreview);
  form.addEventListener('change', schedulePreview);
  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-color-add]')) {
      colorsList.insertAdjacentHTML('beforeend', colorRow({ name: '', hex: '#E3B967' }));
      colorsList.lastElementChild.querySelector('[data-color-name]').focus();
      schedulePreview();
    }
    const preset = event.target.closest('[data-color-preset]');
    if (preset) {
      const [name, hex] = preset.dataset.colorPreset.split('|');
      const exists = [...form.querySelectorAll('[data-color-name]')].some((i) => i.value.trim().toLowerCase() === name.toLowerCase());
      if (exists) return toast(`"${name}" ya está en la lista`);
      // Reemplaza una fila vacía si hay, si no agrega una nueva
      const emptyRow = [...form.querySelectorAll('[data-color-row]')].find((r) => !r.querySelector('[data-color-name]').value.trim());
      if (emptyRow) {
        emptyRow.querySelector('[data-color-name]').value = name;
        emptyRow.querySelector('[data-color-hex]').value = hex.toLowerCase();
      } else {
        colorsList.insertAdjacentHTML('beforeend', colorRow({ name, hex: hex.toLowerCase() }));
      }
      schedulePreview();
    }
    const remove = event.target.closest('[data-color-remove]');
    if (remove) {
      remove.closest('[data-color-row]').remove();
      schedulePreview();
    }
    if (event.target.closest('[data-remove-image]')) {
      form.imageUrl.value = '';
      form.querySelector('[data-remove-image]').hidden = true;
      form.querySelector('[data-upload-status]').textContent = 'Se va a usar la ilustración.';
      schedulePreview();
    }
  });

  form.querySelector('[data-upload]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = form.querySelector('[data-upload-status]');
    status.textContent = 'Subiendo foto…';
    try {
      const ready = await resizeImage(file);
      const typed = ready.type ? ready : new File([ready], 'foto.jpg', { type: 'image/jpeg' });
      const { url } = await adminApi('POST', '/api/admin/upload', undefined, { file: typed });
      form.imageUrl.value = url;
      form.querySelector('[data-remove-image]').hidden = false;
      status.textContent = 'Foto lista. Guardá para publicarla.';
      updatePreview();
    } catch (error) {
      status.textContent = '';
      toast(error.message, { tone: 'error' });
    } finally {
      event.target.value = '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.innerHTML = '';
    const data = readForm(form, product);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const saved = product.id
        ? await adminApi('PUT', `/api/admin/products/${product.id}`, data)
        : await adminApi('POST', '/api/admin/products', data);
      toast(product.id ? 'Producto guardado' : `${saved.name} ya está en la tienda`);
      closeDrawer({ silent: true });
      go('#productos', { replace: true });
      await reload();
    } catch (error) {
      errorBox.innerHTML = `<p class="flex items-start gap-2 rounded-2xl bg-bad-soft p-3 text-sm font-medium text-bad" role="alert">${icon('alert', 'size-5 shrink-0')}${esc(error.message)}</p>`;
      const field = error.field && form.querySelector(`[name="${error.field}"]`);
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      } else {
        errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      button.disabled = false;
    }
  });
  form.addEventListener('input', (event) => event.target.removeAttribute?.('aria-invalid'));

  const deleteButton = form.querySelector('[data-delete]');
  if (deleteButton) {
    confirmButton(deleteButton, {
      confirmLabel: '¿Eliminar? Tocá de nuevo',
      onConfirm: async () => {
        await adminApi('DELETE', `/api/admin/products/${product.id}`);
        toast(`${product.name} se eliminó`);
        closeDrawer({ silent: true });
        go('#productos', { replace: true });
        await reload();
      },
    });
  }
  updatePreview();
}

export async function productsView({ main, id, sameSection, go }) {
  const reload = async () => {
    products = await adminApi('GET', '/api/admin/products');
    main.innerHTML = pageHtml();
    bindList();
  };

  const bindList = () => {
    const list = main.querySelector('[data-list]');
    list.addEventListener('change', async (event) => {
      const row = event.target.closest('[data-product]');
      if (!row) return;
      const productId = Number(row.dataset.product);
      try {
        if (event.target.matches('[data-stock]')) {
          const stock = Math.max(0, Math.round(Number(event.target.value) || 0));
          await quickUpdate(productId, { stock });
          toast(`Stock actualizado: ${stock}`);
          list.innerHTML = listHtml();
        }
        if (event.target.matches('[data-active]')) {
          const updated = await quickUpdate(productId, { active: event.target.checked });
          toast(updated.active ? `${updated.name} ahora se ve en la tienda` : `${updated.name} quedó oculto`);
          main.innerHTML = pageHtml();
          bindList();
        }
      } catch (error) {
        toast(error.message, { tone: 'error' });
        list.innerHTML = listHtml();
      }
    });
    list.addEventListener('click', async (event) => {
      const star = event.target.closest('[data-featured]');
      if (!star) return;
      const productId = Number(star.closest('[data-product]').dataset.product);
      try {
        const updated = await quickUpdate(productId, { featured: star.getAttribute('aria-pressed') !== 'true' });
        toast(updated.featured ? `${updated.name} se destaca en la portada` : `${updated.name} ya no está destacado`);
        list.innerHTML = listHtml();
      } catch (error) {
        toast(error.message, { tone: 'error' });
      }
    });
    list.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('[data-stock]')) event.target.blur();
    });
  };

  if (!sameSection || !products.length || !main.querySelector('[data-list]')) await reload();

  if (id === 'nuevo') openForm(emptyProduct(), { go, reload });
  else if (id) {
    const product = products.find((p) => p.id === Number(id));
    if (product) openForm(structuredClone(product), { go, reload });
    else {
      toast('No encontramos ese producto', { tone: 'error' });
      go('#productos', { replace: true });
    }
  } else {
    closeDrawer({ silent: true });
  }
}


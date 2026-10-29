import { db, nowIso } from './db.js';
import { ValidationError } from './http.js';

// Deben coincidir con las ilustraciones de public/js/illustrations.js
export const ILLUSTRATION_KEYS = [
  'tote', 'crossbody', 'baguette', 'bucket', 'backpack', 'wallet',
  'cardholder', 'clutch', 'belt', 'belt-slim', 'keychain', 'passport',
];

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function parseColors(raw) {
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Convierte una fila de la base en el objeto que usa la tienda. */
export function toProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    stock: row.stock,
    description: row.description,
    details: row.details ? row.details.split('\n').map((d) => d.trim()).filter(Boolean) : [],
    colors: parseColors(row.colors),
    illustration: row.illustration,
    imageUrl: row.image_url,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sort: row.sort,
  };
}

const publicFields = ({ active, sort, ...p }) => p;

export function listPublicProducts() {
  return db
    .prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort, id')
    .all()
    .map((row) => publicFields(toProduct(row)));
}

export function getPublicProduct(slug) {
  const row = db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug);
  return row ? publicFields(toProduct(row)) : null;
}

export function listAllProducts() {
  const sold = db.prepare(`
    SELECT oi.product_id, SUM(oi.quantity) AS units
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('pagado', 'preparando', 'enviado', 'entregado')
    GROUP BY oi.product_id
  `).all();
  const soldMap = new Map(sold.map((r) => [r.product_id, r.units]));
  return db
    .prepare('SELECT * FROM products ORDER BY sort, id')
    .all()
    .map((row) => ({ ...toProduct(row), sold: soldMap.get(row.id) || 0 }));
}

export function getProductById(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? toProduct(row) : null;
}

function int(value, { field, min = 0, max = 1_000_000_000, label }) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${label}: ingresá un número entero${min > 0 ? ` mayor a ${min - 1}` : ''}.`, field);
  }
  return n;
}

/** Valida los datos del formulario de producto del panel. */
export function validateProduct(input, currentId = null) {
  const name = String(input.name ?? '').trim();
  if (name.length < 2 || name.length > 80) throw new ValidationError('El nombre tiene que tener entre 2 y 80 caracteres.', 'name');

  const slug = slugify(input.slug || name);
  if (!slug) throw new ValidationError('No pudimos generar la dirección del producto. Revisá el nombre.', 'slug');
  const taken = db.prepare('SELECT id FROM products WHERE slug = ? AND id IS NOT ?').get(slug, currentId);
  if (taken) throw new ValidationError('Ya hay otro producto con esa dirección (slug). Cambiá el nombre o el slug.', 'slug');

  const category = String(input.category ?? '').trim().replace(/\s+/g, ' ');
  if (!category || category.length > 40) throw new ValidationError('Indicá una categoría (hasta 40 caracteres).', 'category');

  const price = int(input.price, { field: 'price', min: 1, label: 'Precio' });
  let compareAtPrice = null;
  if (input.compareAtPrice !== null && input.compareAtPrice !== undefined && input.compareAtPrice !== '') {
    compareAtPrice = int(input.compareAtPrice, { field: 'compareAtPrice', min: 1, label: 'Precio anterior' });
    if (compareAtPrice <= price) {
      throw new ValidationError('El precio anterior tiene que ser mayor al precio actual (o dejalo vacío).', 'compareAtPrice');
    }
  }
  const stock = int(input.stock, { field: 'stock', min: 0, max: 100000, label: 'Stock' });

  const description = String(input.description ?? '').trim();
  if (description.length > 2000) throw new ValidationError('La descripción admite hasta 2000 caracteres.', 'description');

  const detailsList = Array.isArray(input.details) ? input.details : String(input.details ?? '').split('\n');
  const details = detailsList.map((d) => String(d).trim()).filter(Boolean).slice(0, 20).join('\n');
  if (details.length > 2000) throw new ValidationError('Los detalles admiten hasta 2000 caracteres.', 'details');

  const colors = [];
  for (const c of Array.isArray(input.colors) ? input.colors.slice(0, 12) : []) {
    const colorName = String(c?.name ?? '').trim();
    const hex = String(c?.hex ?? '').trim();
    if (!colorName && !hex) continue;
    if (!colorName || colorName.length > 30) throw new ValidationError('Cada color necesita un nombre (hasta 30 caracteres).', 'colors');
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new ValidationError(`El color "${colorName}" no tiene un código válido.`, 'colors');
    if (colors.some((x) => x.name.toLowerCase() === colorName.toLowerCase())) {
      throw new ValidationError(`El color "${colorName}" está repetido.`, 'colors');
    }
    colors.push({ name: colorName, hex: hex.toUpperCase() });
  }

  const illustration = ILLUSTRATION_KEYS.includes(input.illustration) ? input.illustration : 'tote';

  let imageUrl = input.imageUrl ? String(input.imageUrl).trim() : null;
  if (imageUrl && !/^\/uploads\/[\w.-]+$/.test(imageUrl) && !/^https:\/\/\S{4,500}$/.test(imageUrl)) {
    throw new ValidationError('La imagen tiene que ser un archivo subido o un link que empiece con https://', 'imageUrl');
  }

  const sort = input.sort === undefined || input.sort === '' ? null : int(input.sort, { field: 'sort', min: 0, max: 1_000_000, label: 'Orden' });

  return {
    slug,
    name,
    category,
    price,
    compare_at_price: compareAtPrice,
    stock,
    description,
    details,
    colors: JSON.stringify(colors),
    illustration,
    image_url: imageUrl,
    featured: input.featured ? 1 : 0,
    active: input.active === false || input.active === 0 ? 0 : 1,
    sort,
  };
}

export function createProduct(input) {
  const data = validateProduct(input);
  if (data.sort === null) {
    data.sort = (db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM products').get().m || 0) + 10;
  }
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO products (slug, name, category, price, compare_at_price, stock, description, details, colors, illustration, image_url, featured, active, sort)
    VALUES (@slug, @name, @category, @price, @compare_at_price, @stock, @description, @details, @colors, @illustration, @image_url, @featured, @active, @sort)
  `).run(data);
  return getProductById(Number(lastInsertRowid));
}

export function updateProduct(id, input) {
  const current = getProductById(id);
  if (!current) return null;
  const data = validateProduct(input, id);
  if (data.sort === null) data.sort = current.sort;
  db.prepare(`
    UPDATE products SET slug = @slug, name = @name, category = @category, price = @price,
      compare_at_price = @compare_at_price, stock = @stock, description = @description, details = @details,
      colors = @colors, illustration = @illustration, image_url = @image_url, featured = @featured,
      active = @active, sort = @sort, updated_at = @updated_at
    WHERE id = @id
  `).run({ ...data, id, updated_at: nowIso() });
  return getProductById(id);
}

export function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
}

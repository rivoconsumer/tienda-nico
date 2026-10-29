import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { paths } from './config.js';
import { SAMPLE_PRODUCTS } from './seed.js';

fs.mkdirSync(paths.uploads, { recursive: true });

// SQLite incorporado en Node (sin dependencias que compilar).
export const db = new DatabaseSync(paths.database);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');

let depth = 0;
/**
 * Envuelve una función en una transacción: si algo falla, no se guarda nada.
 * Admite transacciones anidadas (usa SAVEPOINT).
 */
export function transaction(fn) {
  return (...args) => {
    const savepoint = `sp_${depth}`;
    db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    depth += 1;
    try {
      const result = fn(...args);
      depth -= 1;
      db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      depth -= 1;
      db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw error;
    }
  };
}

/** Copia consistente de la base completa en otro archivo. */
export function backupTo(file) {
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
}

// Fecha en formato ISO (UTC), por ejemplo 2026-10-29T14:03:12.512Z
const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

// Cada cambio de estructura se agrega al final de esta lista.
// Al arrancar se aplican los que falten (se guarda la versión en PRAGMA user_version).
const MIGRATIONS = [
  `
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Accesorios',
    price INTEGER NOT NULL CHECK (price >= 0),
    compare_at_price INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    colors TEXT NOT NULL DEFAULT '[]',
    illustration TEXT NOT NULL DEFAULT 'tote',
    image_url TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX products_active_sort ON products (active, sort);

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pendiente',
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_dni TEXT,
    delivery_method TEXT NOT NULL,
    address_street TEXT,
    address_number TEXT,
    address_floor TEXT,
    address_city TEXT,
    address_province TEXT,
    address_zip TEXT,
    notes TEXT,
    payment_method TEXT NOT NULL,
    payment_status TEXT,
    payment_id TEXT,
    payment_detail TEXT,
    mp_preference_id TEXT,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    shipping INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    stock_deducted INTEGER NOT NULL DEFAULT 0,
    tracking_code TEXT,
    admin_notes TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX orders_status_created ON orders (status, created_at);
  CREATE INDEX orders_email ON orders (customer_email);

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products (id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    color TEXT,
    color_hex TEXT,
    illustration TEXT,
    image_url TEXT,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );
  CREATE INDEX order_items_order ON order_items (order_id);
  CREATE INDEX order_items_product ON order_items (product_id);

  CREATE TABLE order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX order_events_order ON order_events (order_id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Los números de pedido arrancan en 1001
  INSERT INTO sqlite_sequence (name, seq) VALUES ('orders', 1000);
  `,
];

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let version = current; version < MIGRATIONS.length; version++) {
    transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}

function seed() {
  const done = db.prepare("SELECT 1 FROM settings WHERE key = '_seeded'").get();
  if (done) return;
  const insert = db.prepare(`
    INSERT INTO products (slug, name, category, price, compare_at_price, stock, description, details, colors, illustration, featured, sort)
    VALUES (@slug, @name, @category, @price, @compare_at_price, @stock, @description, @details, @colors, @illustration, @featured, @sort)
  `);
  transaction(() => {
    SAMPLE_PRODUCTS.forEach((p, i) =>
      insert.run({
        ...p,
        compare_at_price: p.compare_at_price ?? null,
        details: p.details.join('\n'),
        colors: JSON.stringify(p.colors),
        featured: p.featured ? 1 : 0,
        sort: (i + 1) * 10,
      }),
    );
    db.prepare("INSERT INTO settings (key, value) VALUES ('_seeded', ?)").run(new Date().toISOString());
  })();
}

migrate();
seed();

export const nowIso = () => new Date().toISOString();

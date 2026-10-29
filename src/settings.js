import { db, transaction } from './db.js';
import { config } from './config.js';
import { mpMode } from './mercadopago.js';

// Ajustes editables desde el panel (Ajustes). Los valores se guardan en la tabla "settings".
export const SETTING_FIELDS = {
  store_name: { label: 'Nombre de la tienda', type: 'text', max: 60, required: true, default: 'Tienda Moon' },
  store_tagline: { label: 'Bajada', type: 'text', max: 80, default: 'Marroquinería artesanal' },
  announcement: { label: 'Barra de anuncio', type: 'text', max: 160, default: 'Envíos a todo el país · Gratis desde $120.000' },
  hero_eyebrow: { label: 'Texto chico de la portada', type: 'text', max: 80, default: 'Hecho a mano en Argentina' },
  hero_title: { label: 'Título principal', type: 'text', max: 140, required: true, default: 'Cuero que te acompaña *todos los días*' },
  hero_subtitle: {
    label: 'Subtítulo',
    type: 'text',
    max: 320,
    default:
      'Carteras, billeteras y accesorios de cuero vacuno, cortados y cosidos a mano en tonos suaves que combinan con todo.',
  },
  about_title: { label: 'Título de "El taller"', type: 'text', max: 140, default: 'Un taller chico, hecho con tiempo' },
  about_text: {
    label: 'Texto de "El taller"',
    type: 'text',
    max: 1500,
    default:
      'Somos un taller chico de Buenos Aires. Cortamos, cosemos y terminamos cada pieza a mano, en tandas cortas, con cueros curtidos en el país.\n\nElegimos colores suaves porque creemos que un buen bolso tiene que acompañar tu ropa, no competir con ella. Si tenés dudas sobre medidas o colores, escribinos y te mandamos fotos de la pieza.',
  },
  contact_whatsapp: { label: 'WhatsApp', type: 'phone', max: 20, default: '' },
  contact_email: { label: 'Email', type: 'email', max: 120, default: '' },
  contact_instagram: { label: 'Instagram', type: 'handle', max: 60, default: '' },
  data_fiscal_url: { label: 'Link de Data Fiscal', type: 'url', max: 300, default: '' },

  shipping_enabled: { label: 'Envío a domicilio', type: 'bool', default: true },
  shipping_cost: { label: 'Costo del envío', type: 'int', min: 0, max: 10_000_000, default: 6500 },
  free_shipping_from: { label: 'Envío gratis desde', type: 'int', min: 0, max: 1_000_000_000, default: 120000 },
  shipping_days: { label: 'Tiempos de entrega',
    type: 'text',
    max: 160,
    default: 'Despachamos en 24 a 48 h hábiles. Llega en 3 a 7 días según la zona.',
  },
  pickup_enabled: { label: 'Retiro en el taller', type: 'bool', default: true },
  pickup_address: { label: 'Dirección de retiro', type: 'text', max: 200, default: 'Villa Crespo, CABA. Te pasamos la dirección exacta al confirmar.' },
  pickup_hours: { label: 'Horarios de retiro', type: 'text', max: 120, default: 'Lunes a viernes de 10 a 18 h' },

  installments: { label: 'Cuotas sin interés', type: 'int', min: 0, max: 24, default: 0 },
  transfer_enabled: { label: 'Pago con transferencia', type: 'bool', default: true },
  transfer_discount: { label: 'Descuento por transferencia', type: 'int', min: 0, max: 50, default: 10 },
  transfer_alias: { label: 'Alias', type: 'text', max: 40, default: '' },
  transfer_cbu: { label: 'CBU o CVU', type: 'text', max: 30, default: '' },
  transfer_holder: { label: 'Titular de la cuenta', type: 'text', max: 80, default: '' },
  transfer_bank: { label: 'Banco o billetera', type: 'text', max: 60, default: '' },
};

let cache = null;

function parseStored(field, raw) {
  if (raw === undefined || raw === null) return field.default;
  if (field.type === 'bool') return raw === '1';
  if (field.type === 'int') return Number.parseInt(raw, 10) || 0;
  return raw;
}

export function getSettings() {
  if (cache) return cache;
  const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '\\_%' ESCAPE '\\'").all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache = Object.fromEntries(
    Object.entries(SETTING_FIELDS).map(([key, field]) => [key, parseStored(field, stored[key])]),
  );
  return cache;
}

/** Valida y guarda los ajustes. Devuelve { ok, settings } o { ok: false, error, field }. */
export function updateSettings(input) {
  const clean = {};
  for (const [key, field] of Object.entries(SETTING_FIELDS)) {
    if (!(key in input)) continue;
    const value = input[key];
    if (field.type === 'bool') {
      clean[key] = value === true || value === '1' || value === 1 || value === 'true';
      continue;
    }
    if (field.type === 'int') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < field.min || n > field.max) {
        return { ok: false, field: key, error: `${field.label}: ingresá un número entre ${field.min} y ${field.max}.` };
      }
      clean[key] = n;
      continue;
    }
    let text = typeof value === 'string' ? value.trim() : '';
    if (field.type === 'phone') text = text.replace(/\D/g, '');
    if (field.type === 'handle') text = text.replace(/^@+/, '').replace(/\s/g, '');
    if (text.length > field.max) {
      return { ok: false, field: key, error: `${field.label}: admite hasta ${field.max} caracteres.` };
    }
    if (field.required && !text) return { ok: false, field: key, error: `${field.label}: no puede quedar vacío.` };
    if (field.type === 'url' && text && !/^https?:\/\/\S+$/.test(text)) {
      return { ok: false, field: key, error: `${field.label}: tiene que empezar con http:// o https://` };
    }
    if (field.type === 'email' && text && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
      return { ok: false, field: key, error: 'El email de contacto no parece válido.' };
    }
    clean[key] = text;
  }

  const next = { ...getSettings(), ...clean };
  if (!next.shipping_enabled && !next.pickup_enabled) {
    return { ok: false, field: 'shipping_enabled', error: 'Dejá activo al menos un método de entrega (envío o retiro).' };
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  );
  transaction(() => {
    for (const [key, value] of Object.entries(clean)) {
      upsert.run(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  })();
  cache = null;
  return { ok: true, settings: getSettings() };
}

export function transferAvailable(s = getSettings()) {
  return Boolean(s.transfer_enabled && (s.transfer_alias || s.transfer_cbu));
}

/** Lo que necesita ver la tienda pública (sin datos internos). */
export function publicConfig() {
  const s = getSettings();
  return {
    storeName: s.store_name,
    tagline: s.store_tagline,
    announcement: s.announcement,
    hero: { eyebrow: s.hero_eyebrow, title: s.hero_title, subtitle: s.hero_subtitle },
    about: { title: s.about_title, text: s.about_text },
    contact: { whatsapp: s.contact_whatsapp, email: s.contact_email, instagram: s.contact_instagram },
    dataFiscalUrl: s.data_fiscal_url,
    shipping: {
      enabled: s.shipping_enabled,
      cost: s.shipping_cost,
      freeFrom: s.free_shipping_from,
      days: s.shipping_days,
    },
    pickup: { enabled: s.pickup_enabled, address: s.pickup_address, hours: s.pickup_hours },
    installments: s.installments,
    transfer: { enabled: transferAvailable(s), discount: s.transfer_discount },
    payments: { mode: mpMode() },
    currency: config.currency,
  };
}

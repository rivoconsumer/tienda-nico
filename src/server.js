import path from 'node:path';
import express from 'express';
import { config, paths } from './config.js';
import { db } from './db.js';
import { securityHeaders, ValidationError } from './http.js';
import { getSettings } from './settings.js';
import { mpMode } from './mercadopago.js';
import { renderStorefront, robotsTxt, sitemapXml } from './render.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { webhookRouter } from './routes/webhooks.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(securityHeaders);

// API
app.use('/api/webhooks', webhookRouter);
app.use('/api', express.json({ limit: '200kb' }));
app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'No encontrado.' }));

// Para buscadores
app.get('/robots.txt', robotsTxt);
app.get('/sitemap.xml', sitemapXml);

// Panel de administración
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Cache-Control', 'no-cache').sendFile(path.join(paths.public, 'admin', 'index.html'));
});

// Archivos
app.use('/uploads', express.static(paths.uploads, { maxAge: '30d', immutable: true, index: false, redirect: false }));
app.use(express.static(paths.public, { index: false, redirect: false }));

// Todas las demás páginas las dibuja la tienda (home, producto, checkout, etc.)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (path.extname(req.path)) return res.status(404).type('text').send('No encontrado');
  renderStorefront(req, res);
});

// Errores
app.use((error, req, res, next) => {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message, field: error.field });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Los datos enviados no son válidos.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'El archivo es demasiado grande (máximo 6 MB).' });
  if (error.status >= 400 && error.status < 500 && error.expose) return res.status(error.status).json({ error: error.message });
  console.error('[error]', error);
  res.status(500).json({ error: 'Ocurrió un error inesperado. Probá de nuevo en unos minutos.' });
});

const server = app.listen(config.port, () => {
  const url = config.publicUrl || `http://localhost:${config.port}`;
  const mode = mpMode();
  const lines = [
    '',
    `  ${getSettings().store_name} · tienda online lista`,
    '  ─────────────────────────────────────────────',
    `  Tienda:  ${url}`,
    `  Panel:   ${url}/admin`,
  ];
  if (config.admin.temporary) {
    lines.push(`  Contraseña temporal del panel: ${config.admin.password}`);
    lines.push('    (definí ADMIN_PASSWORD en el archivo .env para fijarla)');
  }
  if (mode === 'demo') {
    lines.push('  Pagos:   MODO DEMO, los pagos se simulan.');
    lines.push('    (cargá MP_ACCESS_TOKEN en .env para cobrar con Mercado Pago)');
  } else {
    lines.push(`  Pagos:   Mercado Pago ${mode === 'test' ? '(credenciales de PRUEBA)' : '(producción)'}`);
    if (!config.publicUrl.startsWith('https://')) {
      lines.push('    Ojo: sin PUBLIC_URL con https, Mercado Pago no puede avisar los pagos por webhook.');
    }
  }
  lines.push('');
  console.log(lines.join('\n'));
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

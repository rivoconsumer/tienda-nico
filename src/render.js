import fs from 'node:fs';
import path from 'node:path';
import { config, paths } from './config.js';
import { escapeHtml, safeJson, baseUrl } from './http.js';
import { publicConfig } from './settings.js';
import { listPublicProducts, slugify } from './products.js';

const templatePath = path.join(paths.public, 'index.html');
let template = fs.readFileSync(templatePath, 'utf8');

const KNOWN_ROUTES =
  /^\/(?:tienda(?:\/[\w-]+)?|producto\/[\w-]+|checkout|pedido\/[\w-]+|seguimiento|ayuda|arrepentimiento|pago-demo\/[\w-]+)?\/?$/;

/**
 * Devuelve la página de la tienda con los datos iniciales incluidos
 * (configuración y productos), así carga sin esperas y con buen título para Google.
 */
export function renderStorefront(req, res) {
  if (!config.isProduction) template = fs.readFileSync(templatePath, 'utf8');

  const cfg = publicConfig();
  const products = listPublicProducts();
  let title = cfg.tagline ? `${cfg.storeName} · ${cfg.tagline}` : cfg.storeName;
  let description = cfg.hero.subtitle || cfg.tagline;
  let status = KNOWN_ROUTES.test(req.path) ? 200 : 404;
  let image = '';

  const productMatch = req.path.match(/^\/producto\/([\w-]+)\/?$/);
  if (productMatch) {
    const product = products.find((p) => p.slug === productMatch[1]);
    if (product) {
      title = `${product.name} · ${cfg.storeName}`;
      description = product.description;
      if (product.imageUrl) image = product.imageUrl.startsWith('/') ? baseUrl(req) + product.imageUrl : product.imageUrl;
    } else {
      status = 404;
    }
  }

  const html = template
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{DESCRIPTION}}', escapeHtml(String(description).slice(0, 200)))
    .replaceAll('{{STORE_NAME}}', escapeHtml(cfg.storeName))
    .replace('{{OG_IMAGE}}', image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : '')
    .replace('{{BOOTSTRAP}}', safeJson({ config: cfg, products }));

  res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
}

export function robotsTxt(req, res) {
  res.type('text/plain').send(
    ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /checkout', 'Disallow: /pedido/', 'Disallow: /pago-demo/',
      `Sitemap: ${baseUrl(req)}/sitemap.xml`, ''].join('\n'),
  );
}

export function sitemapXml(req, res) {
  const base = baseUrl(req);
  const products = listPublicProducts();
  const categories = [...new Set(products.map((p) => slugify(p.category)))];
  const urls = ['/', '/tienda', ...categories.map((c) => `/tienda/${c}`), ...products.map((p) => `/producto/${p.slug}`), '/ayuda'];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escapeHtml(base + u)}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
  );
}

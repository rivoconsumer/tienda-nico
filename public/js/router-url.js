// Direcciones de la tienda. Normalmente se usan rutas reales (/producto/tote-siena).
// La vista previa sin servidor activa window.__hashRouter y usa #/producto/tote-siena.
export const hashMode = Boolean(window.__hashRouter);

export function currentUrl() {
  if (hashMode) return new URL(location.hash.replace(/^#/, '') || '/', 'https://tienda.local');
  return new URL(location.href);
}

/** Lo que se escribe en la barra de direcciones para una ruta de la tienda. */
export const toAddress = (path) => (hashMode ? `#${path}` : path);

/** Link completo para copiar y compartir. */
export const absoluteUrl = (path) => (hashMode ? `${location.href.split('#')[0]}#${path}` : `${location.origin}${path}`);

export function replaceAddress(path) {
  history.replaceState(history.state, '', toAddress(path));
}

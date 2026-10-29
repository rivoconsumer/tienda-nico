export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

/** Llama a la API de la tienda. Devuelve el JSON o lanza ApiError con un mensaje para mostrar. */
export async function api(method, url, body) {
  // La vista previa sin servidor (demo) reemplaza la API por una versión en el navegador.
  if (typeof window.__mockApi === 'function') return window.__mockApi(method, url, body);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('No pudimos conectarnos. Revisá tu conexión a internet y probá de nuevo.', 0);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(data?.error || 'Algo salió mal. Probá de nuevo en unos minutos.', response.status, data?.field);
  }
  return data;
}

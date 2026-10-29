# Tienda Moon

Tienda online de marroquinería, completa y lista para usar: catálogo, carrito, cobro con **Mercado Pago** (y transferencia), **pedidos guardados en una base de datos** y **panel de administración**. Diseño minimalista en amarillo pastel, hecho con **Tailwind CSS**.

La tienda se llama **Tienda Moon** y trae 12 productos de muestra con ilustraciones. El nombre, los textos y los productos se cambian desde el panel, sin tocar código.

---

## Qué incluye

**Tienda**
- Portada, catálogo por categorías con orden por precio, ficha de producto con selector de color (la ilustración cambia de color), productos relacionados.
- Carrito lateral con barra de "te faltan $X para el envío gratis".
- Checkout en 3 pasos: datos, entrega (envío a domicilio o retiro) y pago.
- Página del pedido con su estado y seguimiento, búsqueda de pedidos por número y email.
- Preguntas frecuentes, botón de WhatsApp, **Botón de arrepentimiento** (Res. 424/2020), link de Defensa del Consumidor y de **Data Fiscal** (ARCA).
- Funciona bien en celulares. Títulos y descripciones por producto para Google, `sitemap.xml` y `robots.txt`.

**Pagos**
- **Mercado Pago Checkout Pro**: tarjetas de crédito y débito, cuotas, dinero en cuenta y efectivo.
- Confirmación automática por **webhook con firma verificada**, y también al volver de Mercado Pago (por si el aviso se demora).
- **Transferencia bancaria** con descuento configurable (te muestra alias y CBU, con botón para mandar el comprobante por WhatsApp).
- **Modo demo**: sin credenciales, el pago se simula para que pruebes todo el recorrido.

**Pedidos y base de datos (SQLite incorporado en Node)**
- Cada pedido guarda cliente, dirección, productos, precios y un historial de todo lo que pasó.
- Control de stock: se descuenta cuando el pedido se paga y se devuelve si se cancela o se reintegra el pago.
- Exportación a Excel (CSV) y copia de seguridad descargable.

**Panel de administración** (`/admin`)
- Resumen con ventas del mes, gráfico de los últimos 14 días, pedidos por despachar, stock bajo y una lista de pasos para dejar la tienda lista.
- Pedidos: filtros por estado, búsqueda, detalle, cambio de estado, código de seguimiento, notas internas, dirección lista para copiar en la etiqueta.
- Productos: alta, edición, fotos (se achican solas al subirlas), colores, stock, destacados, ocultar/mostrar.
- Ajustes: nombre, textos de la portada, contacto, envíos, retiro, cuotas, datos de transferencia.

---

## Probarla en tu computadora

Necesitás [Node.js](https://nodejs.org) **22.13 o superior** (la versión LTS actual sirve). La base de datos usa el SQLite que ya viene incorporado en Node, así que no hay nada que compilar.

```bash
npm install
```

```bash
npm start
```

Abrí **http://localhost:3000**. El panel está en **http://localhost:3000/admin**: la primera vez, la contraseña temporal aparece en la consola.

Sin configurar nada, la tienda arranca en **modo demo**: podés comprar, "pagar" con la pasarela simulada y ver el pedido en el panel.

---

## Configuración

Copiá `.env.example` como `.env` y completá lo que necesites:

| Variable | Para qué sirve |
|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel. Si no la ponés, se genera una temporal en cada arranque. |
| `SESSION_SECRET` | Texto largo y aleatorio para firmar la sesión del panel. |
| `MP_ACCESS_TOKEN` | Access Token de Mercado Pago. Vacío = modo demo. |
| `MP_WEBHOOK_SECRET` | Clave secreta de webhooks de Mercado Pago (recomendada). |
| `PUBLIC_URL` | Dirección pública con https, por ejemplo `https://www.tutienda.com.ar`. |
| `TRUST_PROXY` | Poné `1` si la tienda corre detrás de Railway, Render, Nginx, etc. |
| `DATA_DIR` | Carpeta de la base de datos y las fotos (por defecto `data`). |
| `NODE_ENV` | `production` cuando la publiques. |

El resto (textos, envíos, cuotas, alias, WhatsApp) se configura desde **Panel → Ajustes**.

---

## Conectar Mercado Pago

1. Entrá a [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) y creá una aplicación de tipo **Checkout Pro**.
2. **Para probar**: copiá el Access Token de las credenciales de prueba (empieza con `TEST-`) en `MP_ACCESS_TOKEN` y reiniciá la tienda. Pagá con las tarjetas de prueba que publica Mercado Pago en su documentación (buscá "tarjetas de prueba" en el sitio de Developers).
3. **Avisos de pago (webhooks)**: en tu aplicación, sección **Webhooks**, cargá `https://TU-DOMINIO/api/webhooks/mercadopago`, marcá el evento **Pagos** y copiá la clave secreta en `MP_WEBHOOK_SECRET`.
4. **Para cobrar de verdad**: reemplazá el token por el **Access Token de producción** (empieza con `APP_USR-`) y completá `PUBLIC_URL`.

> Mercado Pago solo puede avisar a direcciones públicas con https. Probando en tu computadora igual funciona: al volver de Mercado Pago, la tienda consulta el pago y actualiza el pedido.

**Cuotas sin interés**: si las ofrecés en tu cuenta de Mercado Pago, poné la cantidad en Ajustes → Pagos para mostrarlas en la tienda.

---

## Publicarla en internet

La base de datos es un archivo (SQLite), así que el servicio tiene que tener **disco persistente**. No uses servicios sin disco (como Vercel) sin antes migrar la base.

### Opción recomendada: Railway

1. Subí este proyecto a un repositorio de GitHub.
2. En [Railway](https://railway.app): **New Project → Deploy from GitHub repo**.
3. En el servicio, agregá un **Volume** montado en `/data`.
4. En **Variables** cargá: `DATA_DIR=/data`, `NODE_ENV=production`, `TRUST_PROXY=1`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `PUBLIC_URL` (el dominio que te da Railway o el tuyo).
5. Railway ejecuta `npm start` solo. Configurá el webhook de Mercado Pago con tu dominio.

### Con Docker (en un VPS)

```bash
docker build -t tienda .
```

```bash
docker run -d --name tienda -p 3000:3000 --env-file .env -v tienda-datos:/app/data --restart unless-stopped tienda
```

Poné adelante un Nginx o Caddy con https y `TRUST_PROXY=1`.

### Copias de seguridad

Desde **Panel → Ajustes → Copia de seguridad** descargás la base completa. También podés copiar la carpeta `data/` (incluye las fotos subidas).

---

## Personalizar

- **Textos, contacto, envíos y pagos**: Panel → Ajustes.
- **Productos y fotos**: Panel → Productos. Si un producto no tiene foto, se muestra una ilustración que toma el color elegido.
- **Colores y tipografías**: `src/styles/tailwind.css` (bloque `@theme`). Después corré `npm run css`.
- **Preguntas frecuentes, política de cambios y cuidado del cuero**: `public/js/content.js`.
- **Ícono de la pestaña**: `public/favicon.svg`.

---

## Desarrollo

```bash
npm run dev
```

Reinicia el servidor y recompila Tailwind cada vez que guardás.

```bash
npm test
```

Corre las pruebas automáticas (47 casos), incluido todo el flujo de Mercado Pago contra un simulador de su API.

```
server.js              Punto de entrada (revisa la versión de Node)
src/
  server.js            Servidor Express
  config.js            Variables de entorno
  db.js / seed.js      Base de datos SQLite y productos de ejemplo
  orders.js            Pedidos, totales, stock y estados
  mercadopago.js       Preferencias, consulta de pagos y firma de webhooks
  products.js          Productos y validaciones
  settings.js          Ajustes editables desde el panel
  auth.js              Sesión del panel
  routes/              API pública, panel y webhooks
  styles/tailwind.css  Diseño (Tailwind CSS v4)
public/
  index.html           Página base de la tienda
  admin/index.html     Página base del panel
  js/                  Tienda (vistas, carrito, ilustraciones) y panel (js/admin)
  css/app.css          CSS compilado (no editar a mano)
test/                  Pruebas automáticas
```

### Cómo funciona un cobro

1. El cliente confirma el pedido: el servidor recalcula precios y stock con los datos de la base (nunca confía en lo que manda el navegador) y lo guarda como **pendiente**.
2. Se crea la preferencia en Mercado Pago y el cliente paga ahí.
3. Mercado Pago avisa por webhook (se valida la firma) y el cliente vuelve a la tienda. En los dos casos se **consulta el pago a la API** antes de tocar el pedido.
4. Si el pago está aprobado y el monto coincide, el pedido pasa a **pagado** y se descuenta el stock. Un reintegro o contracargo lo cancela y devuelve el stock.

### Seguridad

- Sesión del panel con cookie firmada y HttpOnly, límite de intentos de ingreso y encabezado propio en cada cambio.
- Política de seguridad de contenido (CSP) y encabezados de protección.
- Todo lo que escribe el cliente se muestra escapado; las imágenes subidas se validan por su contenido.
- Exportación CSV protegida contra fórmulas de Excel.

---

## Ideas para seguir

- Emails automáticos de confirmación de pedido.
- Cálculo del envío por código postal (Correo Argentino o Andreani).
- Cupones de descuento.
- Facturación electrónica con ARCA.

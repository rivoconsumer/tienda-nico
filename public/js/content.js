// Textos fijos de la tienda. Editalos acá si cambian tus políticas.
import { money } from './ui.js';

export const PROVINCES = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export const CARE_TEXT =
  'Evitá mojarlo; si se moja, dejalo secar a la sombra y lejos del calor. Limpialo con un paño seco y, una o dos veces al año, hidratalo con crema para cuero incolora. Guardalo relleno con papel, dentro de su bolsa de tela.';

export const CHANGES_DAYS = 30;

export function installmentsText(config) {
  return config.installments > 0
    ? `Hasta ${config.installments} cuotas sin interés con Mercado Pago.`
    : 'Podés pagar en cuotas con tarjeta de crédito a través de Mercado Pago.';
}

/** Preguntas frecuentes. Cada una tiene un id para enlazarla (por ejemplo /ayuda#envios). */
export function faq(config) {
  const items = [];
  if (config.shipping.enabled) {
    items.push({
      id: 'envios',
      q: '¿Hacen envíos a todo el país?',
      a: `Sí. El envío a domicilio cuesta ${money(config.shipping.cost)}${
        config.shipping.freeFrom > 0 ? ` y es gratis en compras desde ${money(config.shipping.freeFrom)}` : ''
      }. ${config.shipping.days} Cuando despachamos te mandamos el código de seguimiento.`,
    });
  }
  if (config.pickup.enabled) {
    items.push({
      id: 'retiro',
      q: '¿Puedo retirar mi compra?',
      a: `Sí, sin cargo. ${config.pickup.address} Horario: ${config.pickup.hours}. Te avisamos cuando tu pedido esté listo para retirar.`,
    });
  }
  items.push({
    id: 'pagos',
    q: '¿Cómo puedo pagar?',
    a: `Con Mercado Pago podés pagar con tarjeta de crédito o débito, con dinero en cuenta o en efectivo en Rapipago y Pago Fácil. ${installmentsText(config)}${
      config.transfer.enabled
        ? ` También podés pagar con transferencia bancaria y tenés un ${config.transfer.discount}% de descuento: al confirmar el pedido te mostramos el alias y el CBU.`
        : ''
    }`,
  });
  items.push({
    id: 'cambios',
    q: '¿Puedo cambiar un producto?',
    a: `Sí. Tenés ${CHANGES_DAYS} días desde que recibís tu compra para cambiarla, siempre que esté sin uso. Escribinos con tu número de pedido y coordinamos el cambio. Si el producto tiene una falla, el envío corre por nuestra cuenta.`,
  });
  items.push({
    id: 'arrepentimiento',
    q: '¿Qué es el botón de arrepentimiento?',
    a: 'Por ley (Resolución 424/2020) podés arrepentirte de tu compra dentro de los 10 días corridos desde que la recibiste, sin dar explicaciones. Hacelo desde el Botón de arrepentimiento que está al pie de la página: te damos un código de trámite y te respondemos dentro de las 24 horas.',
  });
  items.push({ id: 'cuidado', q: '¿Cómo cuido el cuero?', a: `El cuero es un material vivo: con el uso toma pátina y se pone más lindo. ${CARE_TEXT}` });
  items.push({
    id: 'colores',
    q: '¿Los colores son exactamente como en la web?',
    a: 'Cada cuero es único y puede tener pequeñas marcas o variaciones de tono. No son fallas: son la prueba de que es cuero natural. Si querés ver una pieza antes de comprar, escribinos y te mandamos fotos.',
  });
  return items;
}

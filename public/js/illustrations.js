// Ilustraciones SVG de los productos.
// Cada pieza se dibuja con el color de cuero elegido, así el producto
// cambia de color cuando el cliente toca otra muestra.
// Si un producto tiene foto cargada desde el panel, se usa la foto.

const METAL = '#d3ad5c';
const METAL_DARK = '#a98632';
const METAL_LIGHT = '#ecd391';
const CARD_A = '#d9e7ee';
const CARD_B = '#f6dccb';
const CARD_EDGE = 'stroke="#2e2a22" stroke-opacity=".14" stroke-width="1.5"';

function toRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = 'e3b967';
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hex, target, amount) {
  const a = toRgb(hex);
  const b = toRgb(target);
  return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function palette(hex) {
  const dark = luminance(hex) < 0.12;
  return {
    base: hex,
    shade: dark ? mix(hex, '#ffffff', 0.1) : mix(hex, '#3a2715', 0.13),
    deep: dark ? mix(hex, '#000000', 0.25) : mix(hex, '#3a2715', 0.3),
    stitch: dark ? mix(hex, '#fff4d6', 0.55) : mix(hex, '#3a2715', 0.42),
  };
}

const ground = (rx, cy = 206) => `<ellipse cx="120" cy="${cy}" rx="${rx}" ry="7" fill="#2e2a22" opacity=".07"/>`;
const stitch = (c, d) => `<path d="${d}" fill="none" stroke="${c.stitch}" stroke-width="1.6" stroke-dasharray="4.5 4" stroke-linecap="round"/>`;

const DRAW = {
  tote: (c) => `
    ${ground(76, 210)}
    <path d="M92 94C92 46 148 46 148 94" fill="none" stroke="${c.deep}" stroke-width="9" stroke-linecap="round"/>
    <path d="M52 90H188L177 199Q176 207 168 207H72Q64 207 63 199Z" fill="${c.base}"/>
    <path d="M188 90L177 199Q176 207 168 207H160L173 90Z" fill="${c.shade}" opacity=".6"/>
    <path d="M52 90H188L186.8 104H53.2Z" fill="${c.shade}"/>
    ${stitch(c, 'M60 112H180')}
    <path d="M82 100C82 36 158 36 158 100" fill="none" stroke="${c.shade}" stroke-width="9" stroke-linecap="round"/>
    <rect x="74" y="98" width="16" height="24" rx="3" fill="${c.shade}"/>
    <rect x="150" y="98" width="16" height="24" rx="3" fill="${c.shade}"/>
    <circle cx="82" cy="114" r="2.8" fill="${METAL}"/>
    <circle cx="158" cy="114" r="2.8" fill="${METAL}"/>`,

  crossbody: (c) => `
    ${ground(66)}
    <path d="M64 118C56 26 184 26 176 118" fill="none" stroke="${c.deep}" stroke-width="5" stroke-linecap="round"/>
    <rect x="54" y="110" width="132" height="90" rx="18" fill="${c.base}"/>
    <path d="M54 128Q54 110 72 110H168Q186 110 186 128V148Q186 172 120 178Q54 172 54 148Z" fill="${c.shade}"/>
    ${stitch(c, 'M63 130Q63 119 74 119H166Q177 119 177 130V147Q177 164 120 169Q63 164 63 147Z')}
    <rect x="110" y="165" width="20" height="17" rx="4.5" fill="${METAL}"/>
    <rect x="115" y="169.5" width="10" height="8" rx="2" fill="${METAL_DARK}"/>
    <circle cx="63" cy="116" r="6" fill="none" stroke="${METAL}" stroke-width="3"/>
    <circle cx="177" cy="116" r="6" fill="none" stroke="${METAL}" stroke-width="3"/>`,

  baguette: (c) => `
    ${ground(84, 200)}
    <path d="M82 124C82 60 158 60 158 124" fill="none" stroke="${c.deep}" stroke-width="8" stroke-linecap="round"/>
    <rect x="38" y="114" width="164" height="78" rx="34" fill="${c.base}"/>
    <path d="M38 148Q38 114 72 114H168Q202 114 202 148V150Q164 166 120 166Q76 166 38 150Z" fill="${c.shade}"/>
    ${stitch(c, 'M50 146Q50 124 74 124H166Q190 124 190 146Q160 157 120 157Q80 157 50 146Z')}
    <rect x="107" y="152" width="26" height="20" rx="5" fill="none" stroke="${METAL}" stroke-width="3.5"/>
    <path d="M120 152V172" stroke="${METAL_DARK}" stroke-width="2.5" stroke-linecap="round"/>
    ${stitch(c, 'M62 181H178')}
    <circle cx="82" cy="119" r="5" fill="${METAL}"/>
    <circle cx="158" cy="119" r="5" fill="${METAL}"/>`,

  bucket: (c) => `
    ${ground(66, 210)}
    <path d="M74 102C74 26 166 26 166 102" fill="none" stroke="${c.deep}" stroke-width="7" stroke-linecap="round"/>
    <path d="M72 98H168L181 186Q183 205 164 205H76Q57 205 59 186Z" fill="${c.base}"/>
    <path d="M181 186Q183 205 164 205H156Q170 200 168 186L158 98H168Z" fill="${c.shade}" opacity=".6"/>
    <ellipse cx="120" cy="98" rx="48" ry="9" fill="${c.deep}"/>
    <path d="M72 98Q120 114 168 98L170.4 115Q120 132 69.6 115Z" fill="${c.shade}"/>
    <path d="M71 116Q120 134 169 116" fill="none" stroke="${c.deep}" stroke-width="2.4"/>
    <path d="M120 125L111 156M120 125L131 153" stroke="${c.deep}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="110.5" cy="159" r="4.2" fill="${METAL}"/>
    <circle cx="131.5" cy="156" r="4.2" fill="${METAL}"/>
    ${stitch(c, 'M65 185Q120 193 175 185')}`,

  backpack: (c) => `
    ${ground(70, 212)}
    <path d="M104 60C104 34 136 34 136 60" fill="none" stroke="${c.deep}" stroke-width="7" stroke-linecap="round"/>
    <path d="M62 98Q62 56 120 56Q178 56 178 98V196Q178 208 166 208H74Q62 208 62 196Z" fill="${c.base}"/>
    <rect x="80" y="152" width="80" height="44" rx="11" fill="${c.shade}" opacity=".75"/>
    ${stitch(c, 'M88 162H152')}
    <path d="M62 98Q62 56 120 56Q178 56 178 98V122Q178 138 162 138H78Q62 138 62 122Z" fill="${c.shade}"/>
    ${stitch(c, 'M71 100Q71 65 120 65Q169 65 169 100V120Q169 129 160 129H80Q71 129 71 120Z')}
    <rect x="90" y="124" width="12" height="46" rx="3" fill="${c.deep}"/>
    <rect x="138" y="124" width="12" height="46" rx="3" fill="${c.deep}"/>
    <rect x="86.5" y="150" width="19" height="15" rx="3.5" fill="none" stroke="${METAL}" stroke-width="3"/>
    <rect x="134.5" y="150" width="19" height="15" rx="3.5" fill="none" stroke="${METAL}" stroke-width="3"/>`,

  wallet: (c) => `
    ${ground(80, 192)}
    <rect x="66" y="62" width="98" height="64" rx="8" fill="${CARD_A}" ${CARD_EDGE}/>
    <rect x="77" y="73" width="17" height="13" rx="3" fill="${METAL_LIGHT}"/>
    <rect x="84" y="70" width="98" height="64" rx="8" fill="${CARD_B}" ${CARD_EDGE}/>
    <rect x="42" y="92" width="156" height="94" rx="14" fill="${c.base}"/>
    <path d="M42 106Q42 92 56 92H184Q198 92 198 106V114H42Z" fill="${c.shade}"/>
    ${stitch(c, 'M50 122V170Q50 178 58 178H182Q190 178 190 170V122')}
    <circle cx="172" cy="158" r="7.5" fill="none" stroke="${c.shade}" stroke-width="2.2"/>`,

  cardholder: (c) => `
    ${ground(60, 190)}
    <rect x="80" y="62" width="80" height="56" rx="7" fill="${CARD_A}" ${CARD_EDGE}/>
    <rect x="90" y="72" width="15" height="11" rx="2.5" fill="${METAL_LIGHT}"/>
    <path d="M66 106Q66 96 76 96H100Q120 116 140 96H164Q174 96 174 106V172Q174 182 164 182H76Q66 182 66 172Z" fill="${c.base}"/>
    <path d="M66 138H174V144H66Z" fill="${c.shade}" opacity=".8"/>
    ${stitch(c, 'M74 106Q74 104 77 104H98Q120 124 142 104H163Q166 104 166 107V171Q166 174 163 174H77Q74 174 74 171Z')}`,

  clutch: (c) => `
    ${ground(84, 194)}
    <rect x="38" y="80" width="164" height="106" rx="14" fill="${c.base}"/>
    <path d="M38 94Q38 80 52 80H188Q202 80 202 94L133 143Q120 152 107 143Z" fill="${c.shade}"/>
    ${stitch(c, 'M52 89H188L128 133Q120 139 112 133Z')}
    ${stitch(c, 'M48 176H192')}
    <circle cx="120" cy="140" r="7" fill="${METAL}"/>
    <circle cx="120" cy="140" r="3.2" fill="${METAL_DARK}"/>`,

  belt: (c) => `
    ${ground(92, 182)}
    <g transform="rotate(-9 120 128)">
      <path d="M62 112H198Q214 112 214 128Q214 144 198 144H62Z" fill="${c.base}"/>
      ${stitch(c, 'M70 118H200')}
      ${stitch(c, 'M70 138H200')}
      <circle cx="160" cy="128" r="2.8" fill="${c.deep}"/>
      <circle cx="173" cy="128" r="2.8" fill="${c.deep}"/>
      <circle cx="186" cy="128" r="2.8" fill="${c.deep}"/>
      <rect x="44" y="114" width="26" height="28" fill="${c.shade}"/>
      <rect x="80" y="106" width="13" height="44" rx="3" fill="${c.shade}"/>
      <rect x="28" y="103" width="42" height="50" rx="11" fill="none" stroke="${METAL}" stroke-width="6.5"/>
      <path d="M36 128H82" stroke="${METAL_DARK}" stroke-width="4" stroke-linecap="round"/>
    </g>`,

  'belt-slim': (c) => `
    ${ground(92, 180)}
    <g transform="rotate(-9 120 128)">
      <path d="M62 119H202Q211 119 211 128Q211 137 202 137H62Z" fill="${c.base}"/>
      ${stitch(c, 'M70 123.5H202')}
      ${stitch(c, 'M70 132.5H202')}
      <circle cx="166" cy="128" r="2.2" fill="${c.deep}"/>
      <circle cx="177" cy="128" r="2.2" fill="${c.deep}"/>
      <circle cx="188" cy="128" r="2.2" fill="${c.deep}"/>
      <rect x="50" y="120" width="20" height="16" fill="${c.shade}"/>
      <rect x="80" y="114" width="10" height="28" rx="2.5" fill="${c.shade}"/>
      <rect x="36" y="112" width="32" height="32" rx="9" fill="none" stroke="${METAL}" stroke-width="5"/>
      <path d="M42 128H80" stroke="${METAL_DARK}" stroke-width="3.2" stroke-linecap="round"/>
    </g>`,

  keychain: (c) => `
    ${ground(42, 206)}
    <circle cx="120" cy="56" r="22" fill="none" stroke="${METAL}" stroke-width="5"/>
    <rect x="114" y="74" width="12" height="22" rx="6" fill="none" stroke="${METAL}" stroke-width="4"/>
    <path d="M96 104Q96 94 106 94H134Q144 94 144 104V178Q144 197 120 199Q96 197 96 178Z" fill="${c.base}"/>
    <path d="M96 104Q96 94 106 94H134Q144 94 144 104V113H96Z" fill="${c.shade}"/>
    <circle cx="120" cy="103.5" r="4.2" fill="${METAL}"/>
    ${stitch(c, 'M104 121V177Q104 189 120 191Q136 189 136 177V121')}`,

  passport: (c) => `
    ${ground(58, 202)}
    <rect x="72" y="50" width="96" height="144" rx="12" fill="${c.base}"/>
    <path d="M72 62Q72 50 84 50H92V194H84Q72 194 72 182Z" fill="${c.shade}" opacity=".7"/>
    ${stitch(c, 'M100 58H152Q160 58 160 66V178Q160 186 152 186H100')}
    <circle cx="128" cy="110" r="20" fill="none" stroke="${c.shade}" stroke-width="2.6"/>
    <ellipse cx="128" cy="110" rx="8.5" ry="20" fill="none" stroke="${c.shade}" stroke-width="2"/>
    <path d="M108 110H148" stroke="${c.shade}" stroke-width="2"/>
    <rect x="106" y="144" width="44" height="4.5" rx="2.2" fill="${c.shade}"/>
    <rect x="114" y="154" width="28" height="3.5" rx="1.7" fill="${c.shade}"/>`,
};

export const ILLUSTRATIONS = {
  tote: 'Bolso tote',
  crossbody: 'Bandolera',
  baguette: 'Cartera baguette',
  bucket: 'Bolso bucket',
  backpack: 'Mochila',
  wallet: 'Billetera',
  cardholder: 'Tarjetero',
  clutch: 'Sobre / clutch',
  belt: 'Cinturón',
  'belt-slim': 'Cinturón angosto',
  keychain: 'Llavero',
  passport: 'Porta pasaporte',
};

/** Devuelve el SVG de una pieza pintada con el color indicado. */
export function illustration(kind, hex = '#e3b967', label = '') {
  const draw = DRAW[kind] || DRAW.tote;
  const title = label ? `<title>${String(label).replace(/[<>&"]/g, '')}</title>` : '';
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" class="h-full w-full" ${label ? '' : 'aria-hidden="true"'}>${title}${draw(palette(hex))}</svg>`;
}

/** Fondo pastel tono sobre tono para la pieza (más claro que el cuero). */
export function tileColor(hex) {
  const dark = luminance(hex) < 0.12;
  return mix(hex, '#fff8e5', dark ? 0.84 : 0.68);
}

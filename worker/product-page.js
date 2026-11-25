// HU-61: la vista previa de un producto compartido (/p/{id}).
//
// Funciones puras: reciben el JSON publico de la API (lo mismo que ve un
// visitante en la app, sin datos de quien vende) y devuelven el HTML ya
// escapado. Sin JavaScript en el navegador: todo se arma aqui.

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.musubi.app';

const ID = /^[0-9a-f]{24}$/;
const PHOTO = /^\/media\/[A-Za-z0-9/_-]+\.webp$/;

export const isProductId = (id) => ID.test(id);

export const escape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** "$450" o "$1,250.50", como la app (sin ICU: el resultado no cambia por region). */
export function formatPrice(cents) {
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest === 0 ? `$${grouped}` : `$${grouped}.${String(rest).padStart(2, '0')}`;
}

/**
 * Lo que la pagina puede mostrar del producto, o `null` si el JSON no tiene la
 * forma esperada (nunca se pinta algo a medias). Solo nombre, precio, estado,
 * categoria y la primera foto: quien vende no sale (RNF-05, HU-61).
 */
export function readProduct(json, apiOrigin) {
  if (!json || typeof json !== 'object') return null;
  const { id, title, priceCents, status, condition, category, photos } = json;
  if (typeof id !== 'string' || !isProductId(id)) return null;
  if (typeof title !== 'string' || title.trim() === '') return null;
  if (!Number.isInteger(priceCents) || priceCents < 0) return null;
  if (status !== 'active' && status !== 'soldOut') return null;
  const photo = Array.isArray(photos) ? photos.find((p) => typeof p === 'string' && PHOTO.test(p)) : undefined;
  return {
    id,
    title: title.trim(),
    price: formatPrice(priceCents),
    soldOut: status === 'soldOut',
    condition: condition === 'new' ? 'Nuevo' : condition === 'used' ? 'Usado' : null,
    category: category && typeof category.name === 'string' ? category.name : null,
    photo: photo ? `${apiOrigin}${photo}` : null,
  };
}

/** "Abrir en Musubi": en Android abre la app si esta instalada y si no, Google Play. */
export function openInAppUrl(id) {
  return `intent://musubiapp.com.mx/p/${id}#Intent;scheme=https;package=com.musubi.app;S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`;
}

const playIcon =
  '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.6v16.8a1 1 0 0 0 1.52.86l13.6-8.4a1 1 0 0 0 0-1.72L7.52 2.74A1 1 0 0 0 6 3.6z"/></svg>';

function actions(id, android) {
  const open = android && id
    ? `<a class="share-open" href="${escape(openInAppUrl(id))}">Abrir en Musubi</a>`
    : '';
  return `<div class="share-actions">${open}<a class="share-play" href="${PLAY_URL}">${playIcon}<span>Descargar en Google Play</span></a></div>`;
}

const note =
  '<p class="fine share-note">Para comprarlo o escribirle a quien lo vende, entra a Musubi con tu correo institucional. Solo estudiantes verificados de tu campus.</p>';

/** Las tres versiones de la pagina: el producto, "Ya no está disponible" y "Abre Musubi para verlo". */
export function productPage(product, { android }) {
  const meta = [product.condition, product.category].filter(Boolean).join(' · ');
  const photo = product.photo
    ? `<img class="share-photo" src="${escape(product.photo)}" alt="Foto de ${escape(product.title)}" width="640" height="640">`
    : '<div class="share-photo share-photo-empty" aria-hidden="true"></div>';
  const badge = product.soldOut ? '<span class="share-badge">Agotado</span>' : '';
  const body = `<section class="wrap share">
<article class="share-card">
${photo}
<div class="share-info">
<p class="share-kicker">Compartido desde Musubi</p>
<h1>${escape(product.title)}</h1>
<p class="share-price">${escape(product.price)}${badge}</p>
${meta ? `<p class="share-meta">${escape(meta)}</p>` : ''}
</div>
</article>
${actions(product.id, android)}
${note}
</section>`;
  const description = product.soldOut
    ? `${product.price} · Agotado por ahora. Velo en Musubi, el mercado de tu campus.`
    : `${product.price} en Musubi, el mercado de tu campus.`;
  return {
    status: 200,
    title: product.title,
    description,
    image: product.photo,
    imageAlt: `Foto de ${product.title}`,
    body,
  };
}

export function unavailablePage(id, { android }) {
  return {
    status: 404,
    title: 'Ya no está disponible',
    description: 'Este producto ya no está disponible en Musubi. Mira lo que hay en tu campus.',
    image: null,
    body: `<section class="wrap share share-empty">
<h1>Ya no está disponible</h1>
<p>Quien lo publicó lo vendió, lo pausó o lo quitó de Musubi.</p>
${actions(id, android)}
<p><a class="button-secondary" href="/">Conoce Musubi</a></p>
</section>`,
  };
}

export function fallbackPage(id, { android }) {
  return {
    status: 200,
    title: 'Abre Musubi para verlo',
    description: 'Te compartieron un producto de Musubi, el mercado de tu campus.',
    image: null,
    body: `<section class="wrap share share-empty">
<h1>Abre Musubi para verlo</h1>
<p>Te compartieron un producto de Musubi, el mercado de estudiantes de tu campus. Ábrelo en la app para ver los detalles.</p>
${actions(id, android)}
${note}
</section>`,
  };
}

/** Las etiquetas Open Graph de la vista previa (WhatsApp, Telegram, etc.). */
export function headTags(page) {
  const tags = [
    '<meta name="robots" content="noindex">',
    `<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}">`,
  ];
  if (page.image) {
    tags.push(
      `<meta property="og:image" content="${escape(page.image)}">`,
      `<meta property="og:image:alt" content="${escape(page.imageAlt)}">`,
    );
  }
  return tags.join('\n');
}

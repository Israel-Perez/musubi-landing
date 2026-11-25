// Worker de musubiapp.com.mx (HU-61). Solo atiende /p/{id}: la vista previa de
// un producto compartido desde la app. Todo lo demas son los archivos
// estaticos de dist/ (env.ASSETS), igual que antes.
//
// Lee el detalle PUBLICO del producto en la API (GET /api/v1/products/{id} sin
// sesion: lo mismo que ve un visitante, sin datos de quien vende) y arma el
// HTML en el servidor. El navegador no recibe JavaScript (misma CSP del sitio,
// con la foto de la API como unica imagen externa).
import { shell } from './shell.generated.js';
import {
  fallbackPage,
  headTags,
  isProductId,
  productPage,
  readProduct,
  unavailablePage,
} from './product-page.js';

const SHARE_PATH = /^\/p\/([^/]+)\/?$/;
const DEFAULT_API = 'https://api.musubiapp.com.mx';
const API_TIMEOUT_MS = 4000;

/** Los mismos encabezados de src/static/_headers; solo cambia img-src (la foto vive en la API). */
export function securityHeaders(apiOrigin) {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': `default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data: ${apiOrigin}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex',
  };
}

/** Rellena la plantilla en una sola pasada: un valor nunca se vuelve a procesar. */
export function fill(template, values) {
  return template.replace(/\{\{(ID|TITLE|DESCRIPTION|HEAD|BODY)\}\}/g, (_, key) => values[key]);
}

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadProduct(id, apiOrigin) {
  try {
    const res = await fetch(`${apiOrigin}/api/v1/products/${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      // Cloudflare guarda la respuesta 5 min: compartir en un grupo no golpea la API.
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (res.status === 404) return { kind: 'gone' };
    if (!res.ok) return { kind: 'error' };
    const product = readProduct(await res.json(), apiOrigin);
    return product ? { kind: 'ok', product } : { kind: 'error' };
  } catch {
    // Sin red, la API apagada o JSON roto: la pagina generica, nunca un 500.
    return { kind: 'error' };
  }
}

export async function sharePage(request, id, env) {
  const apiOrigin = env.API_ORIGIN || DEFAULT_API;
  const android = /Android/i.test(request.headers.get('User-Agent') ?? '');
  let page;
  let cache = 'public, max-age=300';
  if (!isProductId(id)) {
    page = unavailablePage(null, { android });
  } else {
    const result = await loadProduct(id, apiOrigin);
    if (result.kind === 'ok') page = productPage(result.product, { android });
    else if (result.kind === 'gone') page = unavailablePage(id, { android });
    else {
      page = fallbackPage(id, { android });
      cache = 'no-store';
    }
  }
  const html = fill(shell, {
    // Solo un id valido llega a la URL canonica; si no, la del inicio de /p.
    ID: isProductId(id) ? id : '',
    TITLE: escapeText(page.title),
    DESCRIPTION: escapeText(page.description),
    HEAD: headTags(page),
    BODY: page.body,
  });
  return new Response(request.method === 'HEAD' ? null : html, {
    status: page.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': cache,
      ...securityHeaders(apiOrigin),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = SHARE_PATH.exec(url.pathname);
    if (!match) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    let id;
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      id = '';
    }
    return sharePage(request, id, env);
  },
};

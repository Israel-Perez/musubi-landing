// HU-61: pruebas del Worker de /p/{id} con node:test (sin dependencias).
// Corre despues de `node build.mjs`, que genera worker/shell.generated.js.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { fill, securityHeaders } from '../worker/index.js';
import { formatPrice, openInAppUrl, PLAY_URL, readProduct } from '../worker/product-page.js';

const API = 'https://api.example.test';
const env = {
  API_ORIGIN: API,
  ASSETS: { fetch: async () => new Response('asset', { status: 200 }) },
};
const id = '6716a0000000000000000099';
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

// Mismo JSON que ContractTest/Fixtures/product-detail.json de musubi-api, sin sesion (seller null).
const detail = (over = {}) => ({
  id,
  title: 'Calculadora científica Casio fx-991ES Plus',
  description: 'La usé un semestre para Cálculo y Física.',
  category: { slug: 'calculadoras', name: 'Calculadoras' },
  priceCents: 45000,
  condition: 'used',
  conditionDetail: 'likeNew',
  stock: 1,
  status: 'active',
  photos: ['/media/products/6716a0000000000000000001/0123456789abcdef0123456789abcdef.webp'],
  seller: null,
  publishedAt: '2026-11-06T12:00:00Z',
  ...over,
});

let calls;
let reply;
const realFetch = globalThis.fetch;
beforeEach(() => {
  calls = [];
  reply = () => Response.json(detail());
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return reply();
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const get = (path, ua = android, method = 'GET') =>
  worker.fetch(new Request(`https://musubiapp.com.mx${path}`, { method, headers: { 'User-Agent': ua } }), env);

test('un producto disponible: nombre, precio, foto y Open Graph, sin quien vende ni scripts', async () => {
  const res = await get(`/p/${id}`);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${API}/api/v1/products/${id}`);
  // Sin sesion: nunca manda credenciales a la API.
  assert.equal(calls[0].init.headers.Authorization, undefined);
  const html = await res.text();
  assert.match(html, /<title>Calculadora científica Casio fx-991ES Plus · Musubi<\/title>/);
  assert.match(html, /<meta property="og:title" content="Calculadora científica Casio fx-991ES Plus · Musubi">/);
  assert.match(html, /<meta property="og:description" content="\$450 en Musubi, el mercado de tu campus\.">/);
  assert.match(html, new RegExp(`<meta property="og:image" content="${API}/media/products/6716a0000000000000000001/0123456789abcdef0123456789abcdef\\.webp">`));
  assert.match(html, new RegExp(`<link rel="canonical" href="https://musubiapp.com.mx/p/${id}">`));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /class="share-price">\$450</);
  assert.match(html, /Usado · Calculadoras/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\{\{/);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
});

test('en Android sale "Abrir en Musubi" (intent con Google Play de respaldo); en la compu solo Google Play', async () => {
  const phone = await (await get(`/p/${id}`, android)).text();
  assert.ok(phone.includes('Abrir en Musubi'));
  assert.ok(phone.includes(openInAppUrl(id).replace(/&/g, '&amp;')));
  assert.ok(phone.includes(PLAY_URL));
  const pc = await (await get(`/p/${id}`, desktop)).text();
  assert.ok(!pc.includes('Abrir en Musubi'));
  assert.ok(pc.includes('Descargar en Google Play'));
});

test('una agotada se muestra con "Agotado"', async () => {
  reply = () => Response.json(detail({ status: 'soldOut', stock: 0 }));
  const html = await (await get(`/p/${id}`)).text();
  assert.match(html, /share-badge">Agotado</);
  assert.match(html, /Agotado por ahora/);
});

test('vendido, pausado o eliminado (404 de la API): "Ya no está disponible", sin datos', async () => {
  reply = () => Response.json({ code: 'listings.product_not_found' }, { status: 404 });
  const res = await get(`/p/${id}`);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /<h1>Ya no está disponible<\/h1>/);
  assert.doesNotMatch(html, /og:image/);
  assert.doesNotMatch(html, /Calculadora/);
});

test('la API caida o lenta: "Abre Musubi para verlo" sin guardar en cache', async () => {
  reply = () => {
    throw new TypeError('fetch failed');
  };
  const res = await get(`/p/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.match(await res.text(), /<h1>Abre Musubi para verlo<\/h1>/);
  reply = () => new Response('oops', { status: 503 });
  assert.match(await (await get(`/p/${id}`)).text(), /Abre Musubi para verlo/);
});

test('un id que no es de MongoDB no llama a la API', async () => {
  for (const bad of ['abc', '..%2F..%2Fetc', '6716A0000000000000000099', `${id}0`, '%E0%A4%A']) {
    const res = await get(`/p/${bad}`);
    assert.equal(res.status, 404, bad);
  }
  assert.equal(calls.length, 0);
});

test('el texto de la publicacion se escapa (sin HTML ni etiquetas inyectadas)', async () => {
  reply = () =>
    Response.json(
      detail({
        title: '"><script>alert(1)</script>{{BODY}}',
        category: { slug: 'x', name: '<img src=x onerror=alert(1)>' },
        photos: ['https://malo.example/x.webp', '/media/../../secreto.webp', '/media/products/ok/a.webp'],
      }),
    );
  const html = await (await get(`/p/${id}`)).text();
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
  assert.ok(html.includes('{{BODY}}'), 'el titulo no se vuelve a rellenar');
  assert.doesNotMatch(html, /malo\.example|secreto/);
  assert.match(html, new RegExp(`${API}/media/products/ok/a\\.webp`));
});

test('JSON con otra forma: la pagina generica', async () => {
  reply = () => Response.json({ id, title: 42 });
  assert.match(await (await get(`/p/${id}`)).text(), /Abre Musubi para verlo/);
});

test('HEAD sin cuerpo y otros metodos con 405', async () => {
  const head = await get(`/p/${id}`, android, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await get(`/p/${id}`, android, 'POST')).status, 405);
});

test('las demas rutas siguen siendo los archivos estaticos', async () => {
  for (const path of ['/', '/privacidad', '/p', '/producto/x', '/p/x/y', '/.well-known/assetlinks.json']) {
    assert.equal(await (await get(path)).text(), 'asset', path);
  }
  assert.equal(calls.length, 0);
});

test('los encabezados son los de _headers; solo img-src agrega la API', async () => {
  const file = await readFile(new URL('../src/static/_headers', import.meta.url), 'utf8');
  const res = await get(`/p/${id}`);
  for (const [name, value] of Object.entries(securityHeaders(API))) {
    if (name === 'X-Robots-Tag') continue;
    const expected = name === 'Content-Security-Policy' ? value.replace(` ${API}`, '') : value;
    assert.ok(file.includes(`${name}: ${expected}`), `${name} difiere de _headers`);
    assert.equal(res.headers.get(name), value);
  }
});

test('precio como la app y lectura defensiva del JSON', () => {
  assert.equal(formatPrice(45000), '$450');
  assert.equal(formatPrice(125050), '$1,250.50');
  assert.equal(formatPrice(5), '$0.05');
  assert.equal(formatPrice(100000000), '$1,000,000');
  assert.equal(readProduct(detail({ status: 'hidden' }), API), null);
  assert.equal(readProduct(detail({ priceCents: -1 }), API), null);
  assert.equal(readProduct(detail({ photos: [] }), API).photo, null);
  assert.equal(fill('{{TITLE}}-{{ID}}', { TITLE: '{{ID}}', ID: 'x' }), '{{ID}}-x');
});

test('assetlinks.json: el paquete de la app y huellas SHA-256 validas', async () => {
  const links = JSON.parse(await readFile(new URL('../src/static/.well-known/assetlinks.json', import.meta.url), 'utf8'));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(links[0].target.package_name, 'com.musubi.app');
  assert.equal(links[0].target.sha256_cert_fingerprints.length, 2); // llave de subida y firma de Google Play
  for (const fp of links[0].target.sha256_cert_fingerprints) assert.match(fp, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

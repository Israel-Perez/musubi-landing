// Genera el sitio estatico de musubiapp.com.mx en dist/ (Node 18+, sin dependencias).
//
// Los avisos legales tienen una sola fuente: musubi-app/assets/legal/*.md.
// Orden de busqueda: LEGAL_DIR -> ../musubi-app/assets/legal (repos hermanos)
// -> GitHub (rama main de musubi-app). Si no se encuentran, el build falla:
// nunca se publica un aviso viejo o inventado.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const site = 'https://musubiapp.com.mx';
const contact = 'contacto@musubiapp.com.mx';
const legalRaw = 'https://raw.githubusercontent.com/Israel-Perez/musubi-app/main/assets/legal/';

const legalDocs = [
  { file: 'aviso-de-privacidad.md', path: 'privacidad', title: 'Aviso de privacidad' },
  { file: 'terminos-y-condiciones.md', path: 'terminos', title: 'Términos y condiciones' },
];

async function readLegal(file) {
  const dirs = [process.env.LEGAL_DIR, join(root, '..', 'musubi-app', 'assets', 'legal')].filter(Boolean);
  for (const dir of dirs) {
    const local = join(dir, file);
    if (existsSync(local)) return { text: await readFile(local, 'utf8'), from: local };
  }
  const res = await fetch(legalRaw + file);
  if (!res.ok) throw new Error(`No se pudo leer ${file} de musubi-app (${res.status})`);
  return { text: await res.text(), from: legalRaw + file };
}

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mismo Markdown minimo que LegalDocumentView de la app: titulos, parrafos,
// listas con "- ", **negritas**, [enlaces](url) y correos.
function inline(text) {
  return escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|mailto:[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})(?=[\s).,;]|$)/gi, '$1<a href="mailto:$2">$2</a>');
}

function markdown(md) {
  const out = [];
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      (list ??= []).push(line.slice(2));
    } else {
      if (list) flush();
      para.push(line);
    }
  }
  flush();
  return out.join('\n');
}

const logo = (cls = 'logo') =>
  `<svg class="${cls}" viewBox="0 0 64 40" fill="none" aria-hidden="true">` +
  '<circle cx="24" cy="20" r="14" class="ring-red" stroke-width="6"/>' +
  '<circle cx="40" cy="20" r="14" class="ring-ink" stroke-width="6"/>' +
  '<path d="M24 6A14 14 0 0 1 37.16 15.21" class="ring-gap" stroke-width="11"/>' +
  '<path d="M24 6A14 14 0 0 1 37.16 15.21" class="ring-red" stroke-width="6"/>' +
  '<path d="M40 34A14 14 0 0 1 26.84 24.79" class="ring-gap" stroke-width="11"/>' +
  '<path d="M40 34A14 14 0 0 1 26.84 24.79" class="ring-ink" stroke-width="6"/>' +
  '</svg>';

function layout({ path, title, description, body }) {
  const url = path ? `${site}/${path}` : `${site}/`;
  const fullTitle = path ? `${title} · Musubi` : title;
  const nav = [
    ['', 'Inicio'],
    ['privacidad', 'Privacidad'],
    ['eliminar-cuenta', 'Eliminar cuenta'],
  ]
    .map(([p, label]) => `<a href="/${p}"${p === path ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(fullTitle)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escape(fullTitle)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_MX">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17171A" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/PlusJakartaSans-ExtraBold.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="Musubi, inicio">${logo()}<span>Musubi</span></a>
    <nav aria-label="Principal">${nav}</nav>
  </div>
</header>
<main id="contenido">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-row">
    <div class="footer-brand">${logo()}<span>Musubi</span></div>
    <nav aria-label="Legal">
      <a href="/privacidad">Aviso de privacidad</a>
      <a href="/terminos">Términos y condiciones</a>
      <a href="/eliminar-cuenta">Eliminar mi cuenta</a>
      <a href="mailto:${contact}">${contact}</a>
    </nav>
    <p class="fine">Proyecto estudiantil de la Universidad Tecnológica de Tula-Tepeji. Musubi no cobra comisiones ni procesa pagos.</p>
  </div>
</footer>
</body>
</html>
`;
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(join(root, 'src', 'static'), dist, { recursive: true });

  const pages = [];
  for (const name of await readdir(join(root, 'src', 'pages'))) {
    if (!name.endsWith('.html')) continue;
    const src = await readFile(join(root, 'src', 'pages', name), 'utf8');
    // Primera linea: <!-- titulo | descripcion -->
    const meta = /^<!--\s*(.+?)\s*\|\s*(.+?)\s*-->\n/.exec(src);
    if (!meta) throw new Error(`${name}: falta la linea <!-- titulo | descripcion -->`);
    const path = name === 'index.html' ? '' : name.replace(/\.html$/, '');
    const body = src.slice(meta[0].length).replaceAll('{{CONTACT}}', contact);
    pages.push({ path, file: name, title: meta[1], description: meta[2], body });
  }

  for (const doc of legalDocs) {
    const { text, from } = await readLegal(doc.file);
    const html = markdown(text);
    const lead = /<p>(.*?)<\/p>/.exec(html)?.[1]?.replace(/<[^>]+>/g, '') ?? doc.title;
    pages.push({
      path: doc.path,
      file: `${doc.path}.html`,
      title: doc.title,
      description: `${doc.title} de Musubi. ${lead}`,
      body: `<article class="wrap legal doc">\n${html}\n<p class="source">Mismo texto que en la app de Musubi. Dudas o solicitudes: <a href="mailto:${contact}">${contact}</a>.</p>\n</article>`,
    });
    console.log(`legal: ${doc.file} <- ${from}`);
  }

  for (const page of pages) await writeFile(join(dist, page.file), layout(page));

  const urls = pages.filter((p) => p.path !== '404').map((p) => `  <url><loc>${site}/${p.path}</loc></url>`);
  await writeFile(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  );

  // Enlaces internos rotos = build fallido.
  const known = new Set(['/', ...pages.map((p) => `/${p.path}`), ...(await readdir(dist)).map((f) => `/${f}`)]);
  for (const page of pages) {
    const html = await readFile(join(dist, page.file), 'utf8');
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)"/g)) {
      if (!known.has(href) && !existsSync(join(dist, href))) throw new Error(`${page.file}: enlace roto ${href}`);
    }
  }
  console.log(`ok: ${pages.length} paginas en dist/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

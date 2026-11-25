# musubi-landing

Sitio público de Musubi en **https://musubiapp.com.mx**: inicio, aviso de privacidad, términos y condiciones, y cómo eliminar tu cuenta. Google Play pide estas URL para publicar la app. También muestra la vista previa de un producto compartido desde la app (`/p/{id}`, HU-61).

Repos hermanos:
- [`musubi-api`](https://github.com/Israel-Perez/musubi-api): back .NET 10;
- [`musubi-app`](https://github.com/Israel-Perez/musubi-app): app Flutter, y **fuente única de los avisos legales**.

## Cómo funciona

- HTML y CSS estáticos, **sin JavaScript, sin cookies y sin rastreo**. `build.mjs` (Node 18 o superior, sin dependencias) genera `dist/`.
- **Avisos legales:** `/privacidad` y `/terminos` se generan en cada build desde `musubi-app/assets/legal/*.md`, así que la app y el sitio siempre dicen lo mismo. Para cambiar un aviso, cámbialo en `musubi-app` y vuelve a desplegar este sitio.
- **Dónde busca los avisos el build:**
  1. la carpeta de `LEGAL_DIR`;
  2. `../musubi-app/assets/legal` (repos hermanos);
  3. la rama `main` de `musubi-app` en GitHub.

  Si no los encuentra, falla. Nunca publica un aviso viejo.
- **El build revisa los enlaces internos** y falla si alguno está roto.
- **Producto compartido (`/p/{id}`, HU-61):**
  - Lo atiende el Worker (`worker/index.js`). Es el único código de servidor del sitio, y todas las demás rutas siguen siendo los archivos de `dist/`.
  - El Worker lee el detalle **público** del producto en la API (`GET /api/v1/products/{id}` sin sesión: lo mismo que ve un visitante, sin datos de quien vende).
  - Arma el HTML con las etiquetas Open Graph (foto, nombre y precio) para WhatsApp. En Android agrega "Abrir en Musubi" (un `intent://` que cae en Google Play si la app no está).
  - Un producto vendido, pausado o eliminado muestra "Ya no está disponible". Si la API no responde, muestra "Abre Musubi para verlo".
  - Cloudflare guarda cada respuesta de la API 5 minutos y la página lleva `noindex`. El navegador no recibe JavaScript: misma CSP, y la foto de la API es la única imagen externa.
  - La plantilla (`worker/shell.generated.js`) la genera `build.mjs` con el mismo encabezado y pie del sitio.
- **App Links (HU-61):** `/.well-known/assetlinks.json` deja que Android abra `https://musubiapp.com.mx/p/{id}` directo en la app. Lleva la huella SHA-256 de la llave de subida y la de la llave con la que Google Play firma la app (Play Console → Integridad de la app → Firma de apps). Sin la de Play, el enlace abre esta página y "Abrir en Musubi" sigue funcionando.
- **Seguridad:** `src/static/_headers` define CSP sin scripts, HSTS, `nosniff`, sin iframes y sin permisos de cámara, micrófono ni ubicación.

## Comandos

```powershell
node build.mjs                                     # genera dist/ y la plantilla del Worker
node --test                                        # pruebas del Worker de /p/{id} (después del build)
npx wrangler dev                                   # el sitio con el Worker en http://127.0.0.1:8787
python -m http.server 8765 --directory dist        # vista previa en http://127.0.0.1:8765
```

## Estructura

| Ruta | Contenido |
|---|---|
| `build.mjs` | Generador: plantilla común, Markdown de los avisos, `sitemap.xml`, revisión de enlaces y la plantilla del Worker |
| `worker/` | Worker de `/p/{id}` (HU-61): `index.js` (rutas, API y encabezados) y `product-page.js` (HTML escapado) |
| `test/` | Pruebas del Worker con `node:test`, sin dependencias |
| `src/pages/*.html` | Páginas propias (`index`, `eliminar-cuenta`, `404`). La primera línea es `<!-- título \| descripción -->`. El inicio es de pantalla completa y trae su propio encabezado y pie; las demás usan los de la plantilla |
| `src/static/` | `styles.css` (tokens de la guía de estilo de la app y estilos del inicio, en claro y oscuro), `musubi-hero.jpg` (foto del inicio), `favicon.svg`, fuentes Plus Jakarta Sans (OFL), `_headers` y `robots.txt` |
| `.github/workflows/ci.yml` | Build, páginas esperadas y que no haya scripts ni recursos de terceros |

## Despliegue (Cloudflare Workers con archivos estáticos)

- **Proyecto:** Worker `musubi-landing`, conectado a este repo (Workers Builds) y configurado en `wrangler.jsonc`. Sirve `dist/`; el código de `worker/` solo corre en `/p/*` (`run_worker_first`). La URL de la API está en `vars.API_ORIGIN`.
- **Build command:** `node build.mjs`.
- **Deploy command:** `npx wrangler deploy`.
- **Comando de vista previa (otras ramas):** `npx wrangler versions upload`.
- **Dominios** (Settings → Domains & Routes): `musubiapp.com.mx` y `www.musubiapp.com.mx`.
- **Despliegue:** cada push a `main` despliega solo y cada PR tiene su vista previa.
- **Avisos de `musubi-app`:** si cambian, vuelve a desplegar desde Deployments.

## Reglas

Las del equipo (`musubi-api/docs/guia-equipo.md`):
- rama `feature/SCRUM-NN-slug` y PR con la clave de Jira;
- nada de secretos;
- textos en español.

Además, en este repo:
- no se agregan scripts, analíticas ni fuentes externas;
- lo que el sitio promete de la app (funciones, plazos, datos) debe coincidir con el aviso de privacidad y con lo que la app hace.

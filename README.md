# musubi-landing

Sitio público de Musubi en **https://musubiapp.com.mx**: inicio, aviso de privacidad, términos y condiciones, y cómo eliminar tu cuenta. Google Play pide estas URL para publicar la app.

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
- **Seguridad:** `src/static/_headers` define CSP sin scripts, HSTS, `nosniff`, sin iframes y sin permisos de cámara, micrófono ni ubicación.

## Comandos

```powershell
node build.mjs                                     # genera dist/
python -m http.server 8765 --directory dist        # vista previa en http://127.0.0.1:8765
```

## Estructura

| Ruta | Contenido |
|---|---|
| `build.mjs` | Generador: plantilla común, Markdown de los avisos, `sitemap.xml` y revisión de enlaces |
| `src/pages/*.html` | Páginas propias (`index`, `eliminar-cuenta`, `404`). La primera línea es `<!-- título \| descripción -->` |
| `src/static/` | `styles.css` (tokens de la guía de estilo de la app), `favicon.svg`, fuentes Plus Jakarta Sans (OFL), `_headers` y `robots.txt` |
| `.github/workflows/ci.yml` | Build, páginas esperadas y que no haya scripts ni recursos de terceros |

## Despliegue (Cloudflare Workers con archivos estáticos)

- **Proyecto:** Worker `musubi-landing`, conectado a este repo (Workers Builds) y configurado en `wrangler.jsonc`. Solo sirve `dist/`: no hay código de servidor.
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

# AGENTS.md — musubi-landing

Sitio público estático de Musubi (`musubiapp.com.mx`). Lee `README.md` antes de cambiar algo. El flujo del equipo está en `../musubi-api/docs/guia-equipo.md`.

## Reglas
- **Avisos legales:** su única fuente es `musubi-app/assets/legal/*.md`. Nunca copies ni edites su texto aquí.
- **Sin JavaScript, analíticas, cookies ni recursos de terceros.** La CSP de `src/static/_headers` los bloquea y el CI lo revisa. Fuentes y SVG van empaquetados.
- **Todo lo que el sitio diga de la app** (funciones, datos, plazos) debe coincidir con el aviso de privacidad y con lo que la app hace hoy. Si algo no existe todavía, dilo ("muy pronto").
- **Marca:**
  - colores de la guía de estilo (`musubi-app/lib/core/theme/musubi_tokens.dart`), con modo oscuro por `prefers-color-scheme`;
  - logo del SVG de la maqueta;
  - área táctil de al menos 44 px.
- **Textos en español (es-MX).** Sin nombres reales de personas.
- **Sin secretos:** el sitio es público y no los necesita.

## Verificación
- `node build.mjs` termina con `ok`: sin enlaces rotos y con los avisos encontrados.
- Revisa a 390 px y a 1280 px, en claro y en oscuro.
- El YAML del CI pasa `actionlint .github/workflows/ci.yml`.

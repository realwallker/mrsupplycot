# Mr Supply · Cotizador

Aplicación web colaborativa para administrar el catálogo de Mr Supply y crear cotizaciones con PVP. Incluye 443 productos del catálogo depurado, importación/exportación Excel, edición de productos, historial de cotizaciones y documento imprimible premium.

## Producción

- Aplicación: https://cotizadorweb-eight.vercel.app
- Repositorio: https://github.com/realwallker/mrsupplycot
- Base de datos y sincronización: Supabase

## Ejecutar localmente

```bash
npm install
npm run dev
```

Sin variables de entorno la aplicación funciona en modo demostración: guarda en el navegador y sincroniza otras pestañas del mismo equipo.

## Activar colaboración online

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/migrations/001_initial_schema.sql` en el SQL Editor.
3. En Authentication, habilita Email (Magic Link), configura la URL del sitio e invita a cada trabajador autorizado desde el panel de usuarios.
4. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Reinicia la aplicación. El primer usuario autenticado cargará automáticamente el catálogo inicial.

El enlace abre directamente el cotizador sin inicio de sesión. Productos y cotizaciones se comparten mediante Supabase Realtime. La migración `002_public_link_access.sql` habilita el acceso anónimo de lectura y escritura necesario para este modo privado-por-enlace.

## Desplegar

Importa este repositorio en Vercel, configura las dos variables `VITE_SUPABASE_*` y despliega con los valores predeterminados de Vite (`npm run build`, salida `dist`).

## Excel

- **Importar:** `.xlsx`, `.xls` o `.csv`. Los productos se actualizan por SKU y los nuevos se agregan.
- **Exportar catálogo:** genera un `.xlsx` editable con todos los campos principales.
- **Exportar cotización:** genera un `.xlsx` con cliente, líneas, PVP, descuentos, impuestos y total.
- **Imprimir:** el botón de impresión produce una cotización A4 con el branding de Mr Supply; desde el navegador puede guardarse como PDF.

El porcentaje de impuesto es configurable por cotización y parte en 0%, para no imponer una regla fiscal fija.

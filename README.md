# Control Gym

SaaS para administrar gimnasios pequeños y medianos. Incluye panel de administrador, miembros, planes, cuotas, comprobantes, pagos, reportes PDF/Excel, medidas, fotos de progreso, rachas, anuncios y check-in mediante QR.

## Versión estable 2026-08-04

Esta entrega incorpora:

- Aislamiento de datos por gimnasio mediante RLS.
- Comprobantes y fotos de progreso en buckets privados.
- Creación y eliminación de miembros mediante la Edge Function `admin-users`.
- Cuotas únicas por miembro y vencimiento.
- Ciclos de pago consecutivos calculados en Supabase.
- Revisión atómica del comprobante completo: si cubre varias cuotas, todas se
  aprueban o rechazan juntas y se envía una sola notificación al miembro.
- Escritura financiera bloqueada desde el navegador; altas y revisiones pasan
  por funciones transaccionales de Supabase.
- Aviso a los administradores cuando llega un comprobante.
- Protección contra archivar planes que todavía tienen miembros.
- Regla configurable para check-in con cuota vencida.
- Recuperación automática ante archivos antiguos de un deploy de Vercel/PWA.
- Diseño adaptable para móvil, incluida la corrección de los menús de perfil y cierre de sesión.

## Actualizar una instalación existente

Sigue el archivo [`PASOS_PARA_SUBIR.md`](PASOS_PARA_SUBIR.md). La migración nueva que debe ejecutarse es:

```text
supabase/migrations/20260804_financial_integrity.sql
```

No borra pagos. Si encuentra cuotas duplicadas, conserva la principal y marca las demás como rechazadas con una nota para mantener el historial.

## Instalación nueva

En una base nueva ejecuta las migraciones en este orden:

1. `supabase/migrations/20260802_security_integrity.sql`
2. `supabase/migrations/20260804_financial_integrity.sql`
3. `supabase/verification_queries.sql` para comprobar la instalación.

Después despliega `supabase/functions/admin-users/index.ts` como Edge Function con el nombre exacto `admin-users` y verificación JWT activa.

## Variables de Vercel

Obligatorias:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU-CLAVE-ANON
```

Opcionales como respaldo visual:

```env
VITE_GYM_NAME=Mi Gimnasio
VITE_GYM_WHATSAPP=50212345678
```

El nombre y WhatsApp utilizados por cada cuenta se leen principalmente de la tabla `gyms`, por lo que distintos gimnasios pueden utilizar el mismo despliegue.

Nunca agregues `SUPABASE_SERVICE_ROLE_KEY` ni una variable `VITE_SUPABASE_SERVICE_KEY` a GitHub o Vercel.

## Desarrollo

```bash
npm install
npm test
npm run dev
```

Compilación de producción:

```bash
npm run build
```

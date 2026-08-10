# Control Gym — instalación de un solo gimnasio

Aplicación React/Vite + Supabase para administrar miembros, planes, pagos, comprobantes, medidas, fotos de progreso, reportes, anuncios y asistencia.

Cada repositorio/proyecto Supabase admite **un solo gimnasio**. El índice `single_gym_only_uidx` impide crear una segunda fila en `gyms`; para otro cliente se despliega otra copia independiente.

## Controles incluidos

- RLS y archivos privados.
- Administradores obligados a usar MFA/TOTP.
- Contraseña temporal con cambio obligatorio para miembros nuevos.
- Recuperación de contraseña por email.
- Alta y edición transaccional de perfil + membresía.
- Archivado reversible; pagos e historial no se borran.
- QR temporal de 90 segundos, no consultable por miembros.
- Check-in vencido basado únicamente en pagos aprobados.
- Vouchers inmutables una vez vinculados.
- Límite de 5 MB y MIME de imagen en Storage.
- Pagos y planes modificados mediante RPC validadas.
- Bitácora administrativa.
- Paginación para no truncar colecciones al límite de la API.
- Notificaciones de vencimiento mediante `pg_cron`.
- Cabeceras CSP/HSTS y demás protecciones en Vercel.

## Actualizar una instalación existente

Sigue [PASOS_PARA_SUBIR.md](PASOS_PARA_SUBIR.md). La migración nueva es:

```text
supabase/migrations/20260808_single_gym_hardening.sql
```

Antes ejecuta `supabase/preflight_existing.sql` y crea un backup. La migración conserva pagos, usuarios y archivos.

## Instalación nueva

Ejecuta en este orden:

1. `supabase/migrations/20260801_initial_schema.sql`
2. `supabase/migrations/20260802_security_integrity.sql`
3. `supabase/migrations/20260804_financial_integrity.sql`
4. `supabase/migrations/20260808_single_gym_hardening.sql`
5. Crea el usuario administrador en Authentication.
6. Edita y ejecuta `supabase/bootstrap_single_gym.sql`.
7. Ejecuta `supabase/verification_queries.sql`.
8. Despliega `supabase/functions/admin-users/index.ts` con JWT activo.

## Variables del frontend

Copia `.env.example` como `.env.local` para desarrollo. En Vercel configura:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
VITE_GYM_NAME=Mi Gimnasio
VITE_GYM_WHATSAPP=50212345678
VITE_GYM_TIMEZONE=America/Guatemala
```

No agregues `SUPABASE_SERVICE_ROLE_KEY` al frontend, GitHub o Vercel.

En secretos de la Edge Function configura el origen permitido:

```text
APP_ORIGINS=https://tu-app.vercel.app
```

Para preview y producción puedes separar varios orígenes con coma.

## Auth obligatorio

En Supabase Authentication:

- desactiva registro público;
- usa contraseña mínima de 10 caracteres;
- habilita TOTP;
- configura Site URL y Redirect URLs de Vercel;
- configura SMTP para recuperación de contraseña.

## Desarrollo

```bash
npm ci
npm test
npm run build
npm audit --omit=dev
```

La app necesita Supabase para pruebas end-to-end; las pruebas unitarias locales no reemplazan `verification_queries.sql` ni la prueba con cuentas reales.

# Actualizar Control Gym con seguridad

## 1. Preflight y backup

1. Crea un backup del proyecto Supabase.
2. Ejecuta `supabase/preflight_existing.sql` en SQL Editor.
3. Debe existir exactamente un gimnasio.
4. Las consultas de DPI duplicado, plan de otro gimnasio, referencias sin gimnasio y duplicados deben devolver cero filas.
5. Si aparece una fila, corrige ese dato antes de continuar.

## 2. Migración Supabase

Ejecuta completo:

```text
supabase/migrations/20260808_single_gym_hardening.sql
```

La migración no borra miembros, pagos ni archivos. Crea bitácora, MFA administrativo, tokens temporales de check-in, archivado y límites de Storage.

Si el SQL muestra un `NOTICE` indicando que no pudo configurar `pg_cron`, habilita la extensión en Database > Extensions, vuelve a ejecutar la migración y confirma el job con:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'control-gym-payment-notifications';
```

## 3. Edge Function

Despliega `supabase/functions/admin-users/index.ts` con nombre exacto `admin-users` y verificación JWT activa.

Configura el secreto, sustituyendo tu dominio:

```text
APP_ORIGINS=https://tu-app.vercel.app
```

No copies ni expongas `SUPABASE_SERVICE_ROLE_KEY`; Supabase la proporciona a la función en servidor.

## 4. Authentication

En Authentication > URL Configuration:

- Site URL: tu dominio de producción.
- Redirect URLs: producción y previews necesarios.

En Authentication activa TOTP, desactiva signup público, fija mínimo 10 caracteres y configura SMTP. En el siguiente acceso cada administrador deberá enrolar su autenticador.

## 5. Vercel

Configura las variables descritas en README y despliega el repositorio completo. La CSP permite dominios `*.supabase.co`; si utilizas un dominio Supabase personalizado, agrégalo a `vercel.json`.

## 6. Verificación

Ejecuta `supabase/verification_queries.sql` y realiza estas pruebas con datos de prueba:

1. Admin inicia sesión, enrola MFA y abre el panel.
2. Crea un miembro; al primer login se exige cambiar la contraseña temporal.
3. Usa “Olvidé mi contraseña” y confirma el enlace SMTP.
4. Abre Check-in: el QR debe mostrar cuenta regresiva y renovarse.
5. Un token vencido debe fallar.
6. Con `allow_overdue_checkin=false`, un pago pendiente no debe permitir entrada; uno aprobado sí.
7. Envía un voucher y apruébalo; una sesión de miembro no debe poder sobrescribirlo ni borrarlo.
8. Archiva y restaura un miembro; sus pagos deben permanecer.
9. Intenta archivar un plan asignado; debe fallar.
10. Revisa la pestaña Bitácora y confirma los eventos.
11. Carga más de 1,000 pagos/asistencias en un entorno de prueba y confirma que la paginación recupera todos.

## 7. Rollback

No reviertas con borrados manuales. Si la migración falla, conserva el mensaje completo y restaura el backup solo si hubo cambios fuera de la transacción. La migración principal usa una transacción y se revierte automáticamente ante errores.

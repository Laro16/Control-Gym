# Actualización de seguridad — 2 de agosto de 2026

Esta versión corrige las políticas que permitían a un miembro cambiar su
`role`/`gym_id`, insertar pagos aprobados y registrar asistencia sin validar el
QR en el servidor.

## Orden obligatorio de instalación

1. Haz una copia de seguridad de la base de datos desde Supabase.
   La migración conserva los datos de negocio, pero si existen varias
   asistencias del mismo miembro en el mismo día conservará solo una.
2. En **SQL Editor**, ejecuta completo:
   `supabase/migrations/20260802_security_integrity.sql`.
3. En **Edge Functions**, vuelve a desplegar `admin-users` usando el archivo
   `supabase/functions/admin-users/index.ts` de esta versión. Mantén activa la
   verificación de JWT.
4. Confirma los buckets:
   - `vouchers`: privado.
   - `progress`: privado.
   - `avatars`: público.
   - `logos`: público.
5. Ejecuta `supabase/verification_queries.sql`. Todos los resultados deben
   coincidir con los comentarios incluidos en ese archivo. Si aparecen otras
   políticas sobre `storage.objects`, comparte ese resultado antes de publicar:
   una política permisiva adicional se combina con las nuevas y podría volver
   a abrir los archivos privados.
6. Publica el frontend actualizado en Vercel.
7. Cierra la sesión y vuelve a entrar antes de probar.

No publiques el frontend antes de ejecutar la migración: esta versión usa las
funciones SQL `register_checkin`, `submit_member_payments` y
`attach_payment_voucher`.

## Pruebas mínimas después de instalar

1. Crear un miembro nuevo con contraseña de al menos 8 caracteres.
2. Entrar con ese miembro y escanear el QR dos veces: solo debe existir una
   asistencia para el día.
3. Registrar una transferencia con comprobante y confirmar que quede
   `pending` hasta que el administrador la apruebe.
4. Abrir el comprobante y una foto de progreso desde admin y miembro.
5. Desactivar al miembro: al recargar debe ver “Membresía inactiva” y el QR no
   debe aceptar su asistencia.
6. Reactivarlo y luego eliminar un usuario de prueba. Deben desaparecer su
   acceso, pagos, asistencias y archivos.

## Configuración manual recomendada

En Supabase > Authentication, desactiva el registro público por email si todos
los miembros serán creados por el administrador. La aplicación no necesita
registro público.

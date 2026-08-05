# Pasos para actualizar Control Gym

## 1. Supabase primero

Antes de subir el frontend:

1. Entra a Supabase.
2. Abre **SQL Editor**.
3. Abre en este proyecto el archivo `supabase/migrations/20260804_financial_integrity.sql`.
4. Copia todo su contenido, pégalo en SQL Editor y presiona **Run**.
5. Debe finalizar sin mensajes rojos.

No necesitas Supabase Pro ni crear un backup para ejecutar esta migración. No elimina pagos: los posibles duplicados quedan rechazados y documentados.

## 2. Reemplazar el proyecto en GitHub

1. Descomprime el ZIP completo.
2. Copia su contenido sobre tu copia local del repositorio, respetando las carpetas.
3. No copies `node_modules` ni `dist`; no vienen incluidos y Vercel los genera.
4. Confirma los cambios con el mensaje:

```text
Actualiza Control Gym: integridad de cuotas, pagos y diseño móvil
```

5. Sube el commit a GitHub.

Si trabajas desde la web de GitHub, no subas el ZIP como un archivo: descomprímelo y carga el contenido dentro de la raíz del repositorio.

## 3. Vercel

Vercel iniciará el deploy automáticamente. Cuando indique **Ready**:

1. Cierra por completo todas las pestañas de Control Gym.
2. Si la tienes instalada como PWA, ciérrala también.
3. Abre nuevamente la aplicación.

## 4. Pruebas rápidas obligatorias

Realiza estas pruebas con datos de prueba:

1. Admin → **Inicio** → presiona **Cuotas vencidas** y confirma que baja a la lista filtrada.
2. Admin → **Pagos** → registra un pago en efectivo y comprueba el nuevo vencimiento.
3. Cliente → **Pagos** → selecciona el tercer ciclo; deben seleccionarse también el primero y segundo.
4. Cliente → envía un comprobante; el admin debe recibir una notificación.
5. Admin → aprueba el pago; si el comprobante cubre varias cuotas, todas deben
   quedar aprobadas y el cliente debe recibir una sola notificación.
6. Admin → intenta archivar un plan que tenga miembros; el sistema debe impedirlo.
7. Admin → **Calendario** → configura si se permite check-in con cuota vencida.
8. En celular abre el perfil y confirma que **Cerrar sesión** queda visible y no se traslapa.

También puedes ejecutar `supabase/verification_queries.sql` en SQL Editor. Las consultas de duplicados deben devolver cero filas.

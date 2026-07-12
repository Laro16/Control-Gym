# 📦 Entrega: Control Gym — Modo un solo gimnasio + cierre de seguridad

## Qué cambió en esta entrega

**1. Modo un solo gimnasio (sin tocar la base de datos)**
- Eliminada la pestaña "Plataforma" y todo el panel de alta de gimnasios
- Eliminado el concepto de super-admin (`VITE_SUPERADMIN_EMAIL` ya no se usa)
- Eliminadas las funciones `provisionGymWithAdmin` y `listAllGyms`
- **Cero cambios de SQL**: tu base y tus datos quedan exactamente como están

**2. Cierre de seguridad (la service key ya no viaja al navegador)**
- `VITE_SUPABASE_SERVICE_KEY` eliminada por completo del frontend
- Crear y eliminar usuarios ahora pasa por la Edge Function `admin-users`,
  que corre en el servidor de Supabase y verifica que quien llama sea un
  admin autenticado de tu gimnasio

## Archivos de esta entrega

| Archivo | Acción |
|---|---|
| `src/App.jsx` | Reemplazar |
| `src/supabase.jsx` | Reemplazar |
| `src/components/AdminDashboard.jsx` | Reemplazar |
| `src/components/AdminMembers.jsx` | Reemplazar |
| `supabase/functions/admin-users/index.ts` | **Nuevo** |
| `README.md` | Reemplazar |
| `src/components/GymOnboarding.jsx` | **ELIMINAR en GitHub** (paso 2) |

Los demás componentes (AdminReports, AdminOverview, AdminPayments, etc.)
importan `adminCreateUser` pero no cambian: el nombre y la forma de la
función se mantienen, así que no hay que tocarlos.

---

## Orden de despliegue — SEGUIR ESTE ORDEN

### Paso 1 — Desplegar la Edge Function (Supabase) — PRIMERO
Se hace primero para que, cuando el nuevo frontend llegue a Vercel,
crear miembros ya funcione sin interrupciones.

1. Entra a tu proyecto en Supabase → **Edge Functions** (menú izquierdo)
2. **Deploy a new function** → **Via Editor**
3. Nombre exacto: `admin-users`
4. Borra el código de ejemplo y pega TODO el contenido de
   `supabase/functions/admin-users/index.ts`
5. **Deploy**
6. Deja la verificación de JWT activada (viene así por defecto)

No hay que configurar ningún secreto: Supabase inyecta la `service_role`
key automáticamente dentro de la función.

### Paso 2 — Subir el código a GitHub
1. En tu repo → **Add file → Upload files**: arrastra las carpetas `src/` y
   `supabase/` y el archivo `README.md` de esta entrega (respeta las rutas)
2. Commit → Vercel redeploya solo
3. **Eliminar el archivo viejo**: abre `src/components/GymOnboarding.jsx` en
   GitHub → botón `⋯` (arriba a la derecha) → **Delete file** → commit
   - Si se te olvida, el build NO se rompe (ya nada lo importa), pero es
     mejor eliminarlo para no dejar código muerto

### Paso 3 — Limpiar variables en Vercel
1. Tu proyecto en Vercel → **Settings → Environment Variables**
2. **ELIMINA** `VITE_SUPABASE_SERVICE_KEY`
3. **ELIMINA** `VITE_SUPERADMIN_EMAIL` (si existe)
4. **Deployments → ⋯ → Redeploy** para que el cambio de variables aplique

Deben quedar solo 4 variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_GYM_WHATSAPP`, `VITE_GYM_NAME`.

### Paso 4 — Rotar la llave comprometida (Supabase) — NO ES OPCIONAL
La service key viajó dentro del JavaScript público: cualquiera que haya
visitado la app pudo copiarla del navegador. Mientras no la rotes, esa
llave sigue abriendo toda tu base aunque ya no la uses en el código.

En Supabase → **Settings → API**:

- **Si ves llaves nuevas** (tipo `sb_secret_...`): rota/revoca solamente la
  secret key. Listo, la anon no se toca.
- **Si tus llaves son las clásicas** (empiezan con `eyJ...`): la única forma
  es **Settings → API → JWT Settings → "Generate new JWT secret"**.
  ⚠️ Esto regenera TAMBIÉN la anon key, así que inmediatamente después:
  1. Copia la **nueva** anon key
  2. Actualiza `VITE_SUPABASE_ANON_KEY` en Vercel y en tu `.env` local
  3. Redeploy en Vercel
  4. Todos los usuarios tendrán que iniciar sesión de nuevo una vez (normal)

Si después de rotar falla crear miembros: entra a **Edge Functions →
admin-users → Deploy** de nuevo (la función toma la llave nueva).

### Paso 5 — Probar
1. Entra como admin → ya no aparece la pestaña "Plataforma" ✓
2. **Miembros → Nuevo miembro** → crea un usuario de prueba ✓
3. Cierra sesión y entra con ese usuario de prueba ✓
4. Bórralo o desactívalo cuando termines

---

## Por qué NO se hizo el revert completo de la base

La tabla `gyms` no es "lo multi-gimnasio": es donde vive la configuración de
TU gimnasio (logo, color, código QR de check-in, días cerrados, feriados).
Quitarla obligaba a una migración destructiva en una base viva (borrar
columnas, tabla, funciones y reescribir las 22 políticas RLS) para terminar
creando otra tabla igual con otro nombre. La app queda visual y
funcionalmente de un solo gimnasio, y si algún día retomas el SaaS, la base
ya lo soporta.

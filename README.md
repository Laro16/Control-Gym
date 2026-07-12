# 🏋️ GymApp — Sistema de Gestión para tu Gimnasio

App web completa para un gimnasio. React + Vite + Tailwind + Supabase.

> **Modo un solo gimnasio.** La app opera para un único gimnasio: el logo, color,
> código QR de check-in, horarios y feriados se configuran desde el propio panel
> de administración. La base de datos conserva internamente la estructura por
> gimnasio (tabla `gyms` y campo `gym_id`), pero eso es invisible para el uso
> diario y no requiere ninguna acción.

---

## ✅ LISTA DE ARCHIVOS DEL PROYECTO

```
gymapp/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vercel.json
├── supabase/
│   └── functions/
│       └── admin-users/
│           └── index.ts    ← Edge Function (crear/eliminar usuarios)
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── supabase.jsx
    ├── components/
    │   ├── Login.jsx
    │   ├── AdminDashboard.jsx (+ Overview, Members, Payments, Plans,
    │   │                        Stats, Reports, Announcements)
    │   ├── UserDashboard.jsx  (+ Home, Payments, Plans, Body, Streak, Account)
    │   ├── CheckIn.jsx / CheckInQR.jsx / GymSchedule.jsx
    │   └── shared.jsx
    └── utils/
        ├── helpers.js
        ├── theme.js
        └── whatsapp.js
```

---

## PASO 1 — CONFIGURAR SUPABASE

### 1.1 Crear proyecto en Supabase
1. Ve a https://supabase.com y entra a tu cuenta
2. Haz clic en **"New Project"**
3. Elige un nombre (ej: `mi-gimnasio`), pon una contraseña segura y selecciona la región más cercana
4. Espera ~2 minutos a que termine de crearse

> Si vas a usar el **mismo proyecto Supabase que ya tienes funcionando**,
> sáltate 1.1, 1.2, 1.3 y 1.5 — tu base ya está lista.

### 1.2 Ejecutar el SQL
En **SQL Editor** ejecuta, en este orden, los scripts con los que se construyó
la base: estructura de tablas, políticas RLS, funciones (`is_admin`,
`current_gym_id`, `handle_new_user`) y `fase-final.sql` (job diario de
notificaciones con `pg_cron`).

### 1.3 Crear Storage Buckets
En **"Storage"** crea estos 4 buckets:

| Nombre    | ¿Público? | Para qué sirve                     |
|-----------|-----------|-------------------------------------|
| `vouchers`| NO        | Comprobantes de pago                |
| `progress`| NO        | Fotos de progreso corporal          |
| `avatars` | SÍ        | Fotos de perfil                     |
| `logos`   | SÍ        | Logo del gimnasio                   |

### 1.4 Configurar políticas de Storage
Para `vouchers` y `progress` (privados), ve a cada bucket → **Policies** → **New Policy** → "For full customization":

**Política para subir archivos (INSERT):**
```sql
-- Nombre: allow_authenticated_upload
-- Operation: INSERT
(auth.role() = 'authenticated')
```

**Política para leer archivos (SELECT):**
```sql
-- Nombre: allow_authenticated_read
-- Operation: SELECT
(auth.role() = 'authenticated')
```

Para `avatars` y `logos` (públicos), solo agrega la política de INSERT para
usuarios autenticados.

### 1.5 Crear el gimnasio y el primer administrador
1. Ve a **SQL Editor** y crea el gimnasio (guarda el `id` que devuelve):

```sql
INSERT INTO public.gyms (name, whatsapp_number)
VALUES ('Nombre de tu Gimnasio', '50212345678')
RETURNING id;
```

2. Ve a **"Authentication"** → **"Users"** → **"Add user"** → **"Create new user"**,
   pon el email y contraseña del administrador, y crea el usuario.
3. Vuelve a **SQL Editor** y conviértelo en admin del gimnasio (reemplaza el
   email y el UUID del gimnasio del paso 1):

```sql
UPDATE public.profiles
SET role = 'admin',
    full_name = 'Tu Nombre de Administrador',
    gym_id = 'PEGA-AQUI-EL-UUID-DEL-GIMNASIO'
WHERE email = 'correo-del-admin@ejemplo.com';
```

⚠️ Sin el `gym_id` en su perfil, el admin entrará pero no verá nada: todas las
políticas de seguridad filtran por el gimnasio del usuario.

### 1.6 Obtener las credenciales de Supabase
1. Ve a **"Settings"** (ícono de engranaje) → **"API"**
2. Copia:
   - **Project URL** → la necesitas para `VITE_SUPABASE_URL`
   - **anon / public key** → la necesitas para `VITE_SUPABASE_ANON_KEY`

⚠️ **NUNCA copies la `service_role` key al proyecto ni a Vercel.** Toda variable
`VITE_*` termina dentro del JavaScript público que descarga cualquier visitante,
y con esa llave se saltan todas las políticas de seguridad de la base.

### 1.7 Desplegar la Edge Function `admin-users`
Crear y eliminar usuarios requiere la `service_role` key, así que eso corre en
el servidor de Supabase, nunca en el navegador:

1. En Supabase, ve a **"Edge Functions"** (menú izquierdo)
2. Haz clic en **"Deploy a new function"** → **"Via Editor"**
3. Nombre exacto: `admin-users`
4. Borra el código de ejemplo y pega TODO el contenido de
   `supabase/functions/admin-users/index.ts`
5. Haz clic en **"Deploy"**
6. Deja activada la verificación de JWT (viene activada por defecto)

No hay que configurar ningún secreto: Supabase inyecta automáticamente la
`service_role` key dentro de la función.

---

## PASO 2 — CONFIGURAR EL PROYECTO LOCAL

### 2.1 Crear el archivo .env
En la raíz del proyecto, crea un archivo llamado `.env` (sin extensión) con este contenido:

```
VITE_SUPABASE_URL=https://TUPROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...TU_CLAVE_AQUI
VITE_GYM_WHATSAPP=50212345678
VITE_GYM_NAME=Mi Gimnasio
```

- `VITE_SUPABASE_URL` → URL de tu proyecto (del paso 1.6)
- `VITE_SUPABASE_ANON_KEY` → clave anon (del paso 1.6)
- `VITE_GYM_WHATSAPP` → número de WhatsApp del gimnasio (con código de país, sin +)
- `VITE_GYM_NAME` → nombre de tu gimnasio

⚠️ **IMPORTANTE**: El archivo `.env` ya está en el `.gitignore`, así que NO se sube a GitHub.

---

## PASO 3 — SUBIR A GITHUB

1. Crea un repositorio nuevo en https://github.com (ej: `mi-gimnasio-app`)
2. Asegúrate de que sea **privado** (Private)
3. Sube los archivos del proyecto (por la web de GitHub o con git desde terminal)

---

## PASO 4 — DEPLOY EN VERCEL

1. Ve a https://vercel.com y entra con tu cuenta de GitHub
2. Haz clic en **"Add New Project"**
3. Selecciona el repositorio `mi-gimnasio-app`
4. Vercel lo detectará como proyecto Vite automáticamente
5. Antes de hacer deploy, haz clic en **"Environment Variables"** y agrega SOLO estas 4 variables:

| Variable                | Valor                                      |
|-------------------------|--------------------------------------------|
| `VITE_SUPABASE_URL`     | https://tuproyecto.supabase.co             |
| `VITE_SUPABASE_ANON_KEY`| tu clave anon de Supabase                  |
| `VITE_GYM_WHATSAPP`     | 50212345678 (sin + ni espacios)            |
| `VITE_GYM_NAME`         | Mi Gimnasio                                |

6. Haz clic en **"Deploy"**
7. Espera ~2 minutos y listo. Te dará una URL como `mi-gimnasio-app.vercel.app`

---

## PASO 5 — CONFIGURAR DOMINIO PERSONALIZADO (opcional)

Si quieres usar `app.migimnasio.com`:
1. En Vercel → tu proyecto → **"Settings"** → **"Domains"**
2. Agrega tu dominio
3. Sigue las instrucciones para apuntar los DNS

---

## CÓMO CREAR NUEVOS USUARIOS (miembros)

Cuando te llegue un nuevo cliente al gimnasio:

1. Entra a la app como administrador
2. Ve a **"Miembros"** → **"Nuevo miembro"**
3. Llena nombre, email, y pon una contraseña temporal
4. Elige su plan y fecha de inicio
5. Dale al miembro su email y contraseña para que entre a la app

El alta pasa por la Edge Function `admin-users` (paso 1.7): si al crear un
miembro sale un error de servidor, verifica que esa función esté desplegada.

---

## CÓMO REGISTRAR UN PAGO

**El administrador:**
- Ve a **"Pagos"** → **"Registrar pago"**
- Selecciona el miembro, monto, método y fechas
- El pago queda como "Aprobado" automáticamente

**El usuario:**
- Ve a **"Mis pagos"**
- Si pagó por transferencia/depósito: presiona "Subir comprobante", sube la foto
- El estado queda "Pendiente" hasta que el admin lo apruebe
- Puede enviar el comprobante por WhatsApp al admin con el botón

---

## PERSONALIZACIÓN

- **Logo**: desde el menú del avatar del admin → "Cambiar logo del gimnasio"
- **Color**: se guarda en la tabla `gyms` (`primary_color`) y se aplica solo
- **Horarios y feriados**: pestaña "Calendario" del panel admin
- **Nombre**: variable `VITE_GYM_NAME` en Vercel y en tu `.env` local

---

## DEPENDENCIAS INSTALADAS Y POR QUÉ

| Paquete              | Para qué sirve                                      |
|----------------------|-----------------------------------------------------|
| `@supabase/supabase-js` | Conectar con Supabase (base de datos y auth)     |
| `jspdf`              | Generar PDFs de comprobantes e historial            |
| `jspdf-autotable`    | Tablas dentro de los PDFs                           |
| `lucide-react`       | Íconos modernos y limpios                           |
| `qrcode.react`       | Código QR de check-in                               |
| `xlsx`               | Exportar Excel con historial de pagos               |

---

## INSTALAR DEPENDENCIAS (solo la primera vez local)

```bash
npm install
```

Para correr en local:
```bash
npm run dev
```

---

## SOBRE LA ESTRUCTURA MULTI-GIMNASIO

La base de datos conserva la tabla `gyms` y el campo `gym_id`: esa tabla es
donde vive la configuración del gimnasio (logo, color, código QR, días
cerrados, feriados), así que se necesita igual con uno que con varios. Si en
el futuro quieres volver a ofrecer la app a más gimnasios, la base ya lo
soporta; solo habría que reconstruir el panel de alta de gimnasios en el
frontend.

---

## SOPORTE Y PROBLEMAS COMUNES

**"Invalid API key"** → Revisa que las variables de entorno en Vercel sean correctas (sin espacios extra)

**El admin no puede ver usuarios** → Ejecuta el UPDATE de SQL del paso 1.5: el perfil del admin necesita `role = 'admin'` **y** su `gym_id`

**Las fotos no suben** → Verifica que creaste los 4 buckets de Storage con los nombres exactos

**Error al crear miembro** → Verifica que la Edge Function `admin-users` esté desplegada (paso 1.7) y que el email no esté ya registrado

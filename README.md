# 🏋️ GymApp — Sistema de Gestión para Gimnasios

App web completa para gimnasios pequeños. React + Vite + Tailwind + Supabase.

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
├── .env.example
├── .gitignore
├── SUPABASE_SQL.sql        ← SQL que debes ejecutar en Supabase
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── supabase.jsx
    ├── components/
    │   ├── Login.jsx
    │   └── dashboard.jsx
    └── utils/
        ├── helpers.js
        └── whatsapp.js
```

---

## PASO 1 — CONFIGURAR SUPABASE

### 1.1 Crear proyecto en Supabase
1. Ve a https://supabase.com y entra a tu cuenta
2. Haz clic en **"New Project"**
3. Elige un nombre (ej: `mi-gimnasio`), pon una contraseña segura y selecciona la región más cercana
4. Espera ~2 minutos a que termine de crearse

### 1.2 Ejecutar el SQL
1. En tu proyecto de Supabase, haz clic en **"SQL Editor"** (menú izquierdo)
2. Haz clic en **"New query"**
3. Abre el archivo `SUPABASE_SQL.sql` de este proyecto
4. Copia TODO el contenido y pégalo en el editor
5. Haz clic en **"Run"** (botón verde)
6. Debe decir "Success" al terminar

### 1.3 Crear Storage Buckets
1. En Supabase, ve a **"Storage"** (menú izquierdo)
2. Haz clic en **"New bucket"** y crea estos 3:

| Nombre    | ¿Público? | Para qué sirve                     |
|-----------|-----------|-------------------------------------|
| `vouchers`| NO        | Comprobantes de pago                |
| `progress`| NO        | Fotos de progreso corporal          |
| `avatars` | SÍ        | Fotos de perfil                     |

Para crear cada uno:
- Escribe el nombre exacto
- Marca "Public bucket" solo para `avatars`
- Clic en "Create bucket"

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

Para `avatars` (público), no necesitas políticas adicionales.

### 1.5 Crear el primer administrador
1. Ve a **"Authentication"** → **"Users"** → **"Add user"** → **"Create new user"**
2. Pon el email y contraseña del administrador
3. Haz clic en **"Create User"**
4. Copia el UUID del usuario que aparece (algo como `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
5. Ve a **SQL Editor** y ejecuta esto (reemplaza el UUID y el email):

```sql
UPDATE public.profiles
SET role = 'admin', full_name = 'Tu Nombre de Administrador'
WHERE id = 'PEGA-AQUI-EL-UUID-DEL-USUARIO';
```

### 1.6 Obtener las credenciales de Supabase
1. Ve a **"Settings"** (ícono de engranaje) → **"API"**
2. Copia:
   - **Project URL** → la necesitas para `VITE_SUPABASE_URL`
   - **anon / public key** → la necesitas para `VITE_SUPABASE_ANON_KEY`

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

⚠️ **IMPORTANTE**: El archivo `.env` ya está en el `.gitignore`, así que NO se sube a GitHub. Tus credenciales están seguras.

---

## PASO 3 — SUBIR A GITHUB

1. Crea un repositorio nuevo en https://github.com (ej: `mi-gimnasio-app`)
2. Asegúrate de que sea **privado** (Private)
3. **NO** marques "Initialize with README"
4. En tu computadora, abre una terminal en la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "Primer commit - GymApp"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mi-gimnasio-app.git
git push -u origin main
```

Reemplaza `TU_USUARIO` y `mi-gimnasio-app` con tus datos reales.

---

## PASO 4 — DEPLOY EN VERCEL

1. Ve a https://vercel.com y entra con tu cuenta de GitHub
2. Haz clic en **"Add New Project"**
3. Selecciona el repositorio `mi-gimnasio-app`
4. Vercel lo detectará como proyecto Vite automáticamente
5. Antes de hacer deploy, haz clic en **"Environment Variables"** y agrega las 4 variables:

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

El miembro entra a la misma URL de la app con su email y contraseña.

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

## PERSONALIZACIÓN DE COLORES Y NOMBRE

Para cambiar el color naranja por uno diferente, edita `tailwind.config.js`:

```js
brand: {
  500: '#F97316',  // ← Cambia este color por el tuyo
  600: '#ea6c10',  // ← Un poco más oscuro que el anterior
}
```

Para cambiar el nombre del gimnasio, solo actualiza la variable `VITE_GYM_NAME` en Vercel y en tu `.env` local.

---

## DEPENDENCIAS INSTALADAS Y POR QUÉ

| Paquete              | Para qué sirve                                      |
|----------------------|-----------------------------------------------------|
| `@supabase/supabase-js` | Conectar con Supabase (base de datos y auth)     |
| `jspdf`              | Generar PDFs de comprobantes e historial            |
| `jspdf-autotable`    | Tablas dentro de los PDFs                           |
| `lucide-react`       | Íconos modernos y limpios                           |
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

## PREPARADO PARA SAAS FUTURO

El sistema ya tiene:
- Tabla `gyms` con `id`, `name`, `primary_color`, etc.
- Campo `gym_id` en `members`, `plans`, etc.
- Solo necesitarás agregar filtros por `gym_id` cuando tengas múltiples gimnasios

---

## SOPORTE Y PROBLEMAS COMUNES

**"Invalid API key"** → Revisa que las variables de entorno en Vercel sean correctas (sin espacios extra)

**El admin no puede ver usuarios** → Ejecuta el UPDATE de SQL del paso 1.5 para marcar el usuario como admin

**Las fotos no suben** → Verifica que creaste los 3 buckets de Storage con los nombres exactos

**Error al crear miembro** → Asegúrate de que el email no esté ya registrado en Supabase

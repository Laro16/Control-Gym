# Actualizar Laro16/Control-Gym sin instalar programas

Este paquete contiene únicamente los archivos que cambian respecto a la rama `main` revisada el 10 de agosto de 2026.

## Archivos incluidos

- `.env.example` (nuevo)
- `.gitignore` (nuevo)
- `PASOS_PARA_SUBIR.md`
- `README.md`
- `src/App.jsx`
- `src/components/SecurityGates.jsx`
- `supabase/config.toml`
- `supabase/functions/admin-users/index.ts`
- `supabase/INSTALACION_LIMPIA_CONTROL_GYM.sql` (nuevo)
- `supabase/migrations/20260804_financial_integrity.sql`
- `supabase/migrations/20260808_single_gym_hardening.sql`
- `supabase/migrations/20260810_remove_admin_mfa.sql` (nuevo)
- `supabase/REANUDAR_INSTALACION_DESPUES_ERROR_42601.sql` (nuevo)
- `tests/security-contracts.test.js`

## Subirlos desde el navegador

1. Descarga y descomprime `Control-Gym-SOLO-CAMBIOS-GITHUB-v4-SIN-MFA.zip`.
2. Abre `https://github.com/Laro16/Control-Gym`.
3. Presiona la tecla `.` para abrir el editor web de GitHub.
4. En el explorador izquierdo, confirma que estás en la raíz de `Control-Gym`.
5. Arrastra **el contenido de la carpeta descomprimida**, no la carpeta contenedora, hacia la raíz del explorador.
6. Acepta reemplazar los archivos existentes cuando lo solicite. Las carpetas `src`, `supabase` y `tests` deben quedar en la raíz; no deben quedar dentro de una carpeta adicional.
7. Abre **Source Control**, escribe el mensaje `Publicar Control Gym sin MFA` y confirma el commit en `main`.
8. Vercel debería iniciar un despliegue automático. Espera a que aparezca `Ready`.

No subas archivos `.env`, `.env.local`, claves de Supabase ni `SUPABASE_SERVICE_ROLE_KEY`.

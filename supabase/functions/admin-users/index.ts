// ═══════════════════════════════════════════════════════════════
// Edge Function: admin-users
// ═══════════════════════════════════════════════════════════════
// Reemplaza el uso de VITE_SUPABASE_SERVICE_KEY en el frontend.
// La service role key vive SOLO aquí (en el servidor de Supabase);
// el navegador nunca la ve.
//
// Acciones:
//   { action: 'create', email, password, fullName }
//       → crea (o reactiva) un usuario del gimnasio del admin que llama
//   { action: 'delete', profileId }
//       → elimina de Auth a un usuario del gimnasio del admin que llama
//
// Seguridad:
//   1. Solo acepta llamadas de usuarios autenticados (token JWT).
//   2. Verifica en la base que quien llama tenga role = 'admin'.
//   3. El gym_id se lee del perfil del admin — nunca del navegador.
//   4. No permite tocar cuentas de otros gimnasios ni de otros admins.
//
// Las variables SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente:
// no hay que configurar ningún secreto manualmente.
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  // Preflight del navegador
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) Identificar a quien llama usando SU propio token
    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: callerUser }, error: authErr } = await caller.auth.getUser()
    if (authErr || !callerUser) return json({ error: 'No autenticado' }, 401)

    // 2) Cliente con service role (solo existe en el servidor)
    const admin = createClient(supabaseUrl, serviceKey)

    // 3) Verificar que quien llama es admin y obtener su gimnasio
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, gym_id')
      .eq('id', callerUser.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.gym_id) {
      return json({ error: 'Solo un administrador puede realizar esta acción' }, 403)
    }
    const gymId = callerProfile.gym_id

    const body = await req.json().catch(() => null)
    if (!body?.action) return json({ error: 'Falta el campo action' }, 400)

    // ── CREAR (o reactivar) USUARIO ──────────────────────────
    if (body.action === 'create') {
      const { email, password, fullName } = body
      if (!email || !password || !fullName) {
        return json({ error: 'Faltan datos: nombre, email o contraseña' }, 400)
      }
      if (String(password).length < 6) {
        return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
      }

      const metadata = { full_name: fullName, role: 'user', gym_id: gymId }

      // Intento 1: crear normalmente. El trigger handle_new_user
      // sella el gym_id en el perfil a partir de estos metadatos.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })

      if (!error) {
        // Refuerzo del perfil por si el trigger fallara
        await admin.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'user',
          gym_id: gymId,
        })
        return json({ user: { id: data.user.id, email: data.user.email } })
      }

      const msg = (error.message || '').toLowerCase()
      const yaRegistrado =
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        msg.includes('already exists')
      if (!yaRegistrado) return json({ error: error.message }, 400)

      // Reactivar un email que ya estuvo registrado (usuario eliminado)
      const { data: listData, error: listErr } =
        await admin.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) return json({ error: listErr.message }, 400)

      const existing = listData?.users?.find(
        (u) => u.email?.toLowerCase() === String(email).toLowerCase(),
      )
      if (!existing) return json({ error: 'Este email ya está registrado.' }, 400)

      // Seguridad: no reciclar cuentas de admins ni de otros gimnasios
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('role, gym_id')
        .eq('id', existing.id)
        .maybeSingle()
      if (
        existingProfile &&
        (existingProfile.role === 'admin' ||
          (existingProfile.gym_id && existingProfile.gym_id !== gymId))
      ) {
        return json({ error: 'Este email ya está en uso por otra cuenta.' }, 400)
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
        ban_duration: 'none',
      })
      if (updErr) return json({ error: updErr.message }, 400)

      // Recrear el perfil por si quedó huérfano
      await admin.from('profiles').upsert({
        id: existing.id,
        email,
        full_name: fullName,
        role: 'user',
        gym_id: gymId,
      })
      return json({ user: { id: existing.id, email } })
    }

    // ── ELIMINAR USUARIO DE AUTH ─────────────────────────────
    if (body.action === 'delete') {
      const { profileId } = body
      if (!profileId) return json({ error: 'Falta profileId' }, 400)

      // Seguridad: solo miembros (no admins) y solo del propio gimnasio
      const { data: target } = await admin
        .from('profiles')
        .select('role, gym_id')
        .eq('id', profileId)
        .maybeSingle()
      if (target) {
        if (target.role === 'admin') {
          return json({ error: 'No se puede eliminar a un administrador' }, 403)
        }
        if (target.gym_id && target.gym_id !== gymId) {
          return json({ error: 'Ese usuario no pertenece a tu gimnasio' }, 403)
        }
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(profileId)
      if (delErr) return json({ error: delErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: `Acción desconocida: ${body.action}` }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    return json({ error: message }, 500)
  }
})

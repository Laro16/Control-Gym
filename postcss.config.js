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

const cleanText = (value: unknown, max = 500) => {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, max) : null
}

const validDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Configuracion del servidor incompleta' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user: callerUser }, error: authError } = await caller.auth.getUser()
    if (authError || !callerUser) return json({ error: 'No autenticado' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, gym_id')
      .eq('id', callerUser.id)
      .single()

    if (callerProfileError || callerProfile?.role !== 'admin' || !callerProfile.gym_id) {
      return json({ error: 'Solo un administrador puede realizar esta accion' }, 403)
    }
    const gymId = callerProfile.gym_id as string

    const body = await req.json().catch(() => null)
    if (!body?.action) return json({ error: 'Falta el campo action' }, 400)

    if (body.action === 'create') {
      const email = cleanText(body.email, 320)?.toLowerCase()
      const password = String(body.password ?? '')
      const fullName = cleanText(body.fullName, 160)
      const phone = cleanText(body.phone, 40)
      const birthDate = validDate(body.birthDate) ? body.birthDate : null
      const startDate = validDate(body.startDate) ? body.startDate : null
      const emergencyContact = cleanText(body.emergencyContact, 250)
      const notes = cleanText(body.notes, 2000)
      const planId = cleanText(body.planId, 80)

      if (!email || !password || !fullName || !startDate) {
        return json({ error: 'Nombre, email, contrasena y fecha de inicio son obligatorios' }, 400)
      }
      if (password.length < 8) {
        return json({ error: 'La contrasena debe tener al menos 8 caracteres' }, 400)
      }

      if (planId) {
        const { data: plan } = await admin
          .from('plans')
          .select('id')
          .eq('id', planId)
          .eq('gym_id', gymId)
          .eq('is_active', true)
          .maybeSingle()
        if (!plan) return json({ error: 'El plan no pertenece a este gimnasio o esta inactivo' }, 400)
      }

      let authUserId: string | null = null
      let createdNow = false

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'user', gym_id: gymId },
      })

      if (!createError && created.user) {
        authUserId = created.user.id
        createdNow = true
      } else {
        const message = (createError?.message || '').toLowerCase()
        const alreadyExists = message.includes('already') &&
          (message.includes('registered') || message.includes('exists'))
        if (!alreadyExists) return json({ error: createError?.message || 'No se pudo crear la cuenta' }, 400)

        // Buscar en todas las paginas; no se limita a los primeros 1000 usuarios.
        let page = 1
        while (!authUserId) {
          const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          if (listError) return json({ error: listError.message }, 400)
          const existing = usersPage.users.find(u => u.email?.toLowerCase() === email)
          if (existing) {
            authUserId = existing.id
            break
          }
          if (usersPage.users.length < 1000) break
          page += 1
        }
        if (!authUserId) return json({ error: 'Este email ya esta registrado' }, 400)

        const { data: existingProfile } = await admin
          .from('profiles')
          .select('role, gym_id')
          .eq('id', authUserId)
          .maybeSingle()
        if (existingProfile?.role === 'admin' ||
            (existingProfile?.gym_id && existingProfile.gym_id !== gymId)) {
          return json({ error: 'Este email esta en uso por otra cuenta' }, 400)
        }

        const { data: existingMember } = await admin
          .from('members')
          .select('id')
          .eq('profile_id', authUserId)
          .maybeSingle()
        if (existingMember) return json({ error: 'Este usuario ya tiene una ficha de miembro' }, 400)

        const { error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: 'user', gym_id: gymId },
          ban_duration: 'none',
        })
        if (updateAuthError) return json({ error: updateAuthError.message }, 400)
      }

      const rollbackNewAuthUser = async () => {
        if (createdNow && authUserId) await admin.auth.admin.deleteUser(authUserId)
      }

      const { error: profileError } = await admin.from('profiles').upsert({
        id: authUserId,
        email,
        full_name: fullName,
        phone,
        birth_date: birthDate,
        role: 'user',
        gym_id: gymId,
      })
      if (profileError) {
        await rollbackNewAuthUser()
        return json({ error: 'No se pudo crear el perfil: ' + profileError.message }, 400)
      }

      const { data: member, error: memberError } = await admin
        .from('members')
        .insert({
          profile_id: authUserId,
          plan_id: planId,
          start_date: startDate,
          emergency_contact: emergencyContact,
          notes,
          gym_id: gymId,
          status: 'active',
        })
        .select('id, profile_id')
        .single()

      if (memberError) {
        await admin.from('profiles').delete().eq('id', authUserId)
        await rollbackNewAuthUser()
        return json({ error: 'No se pudo crear la ficha: ' + memberError.message }, 400)
      }

      return json({ user: { id: authUserId, email }, member })
    }

    if (body.action === 'delete') {
      const memberId = cleanText(body.memberId, 80)
      const profileId = cleanText(body.profileId, 80)
      if (!memberId || !profileId) return json({ error: 'Faltan memberId y profileId' }, 400)

      const { data: target } = await admin
        .from('members')
        .select('id, profile_id, gym_id, profile:profiles(role)')
        .eq('id', memberId)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (!target || target.gym_id !== gymId) return json({ error: 'Miembro no encontrado' }, 404)
      const targetProfile = Array.isArray(target.profile) ? target.profile[0] : target.profile
      if (targetProfile?.role === 'admin') return json({ error: 'No se puede eliminar a un administrador' }, 403)

      // Eliminar primero los archivos privados y el avatar. Los nombres viven
      // directamente dentro de la carpeta memberId/profileId.
      for (const [bucket, folder] of [['vouchers', memberId], ['progress', memberId], ['avatars', profileId]]) {
        const { data: files, error: listError } = await admin.storage.from(bucket).list(folder, { limit: 1000 })
        if (listError) return json({ error: `No se pudieron revisar los archivos de ${bucket}` }, 400)
        const paths = (files || []).filter(f => f.name).map(f => `${folder}/${f.name}`)
        if (paths.length) {
          const { error: removeError } = await admin.storage.from(bucket).remove(paths)
          if (removeError) return json({ error: `No se pudieron eliminar los archivos de ${bucket}` }, 400)
        }
      }

      const { error: dataError } = await admin.rpc('delete_member_data', {
        p_member_id: memberId,
        p_profile_id: profileId,
      })
      if (dataError) return json({ error: 'No se pudieron eliminar los datos: ' + dataError.message }, 400)

      const { error: authDeleteError } = await admin.auth.admin.deleteUser(profileId)
      if (authDeleteError) {
        return json({ error: 'Los datos se eliminaron, pero la cuenta de acceso requiere limpieza manual' }, 500)
      }
      return json({ ok: true })
    }

    return json({ error: `Accion desconocida: ${body.action}` }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    return json({ error: message }, 500)
  }
})

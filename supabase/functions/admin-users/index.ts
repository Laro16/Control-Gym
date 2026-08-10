import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1'

const configuredOrigins = (Deno.env.get('APP_ORIGINS') || Deno.env.get('APP_ORIGIN') || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean)

const corsHeaders = (req: Request) => {
  const requestOrigin = (req.headers.get('Origin') || '').replace(/\/$/, '')
  const allowedOrigin = configuredOrigins.includes(requestOrigin)
    ? requestOrigin
    : configuredOrigins[0] || requestOrigin || '*'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  })

const cleanText = (value: unknown, max = 500) => {
  const valueText = String(value ?? '').trim()
  return valueText ? valueText.slice(0, max) : null
}

const validDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405)

  if (!configuredOrigins.length) {
    return json(req, { error: 'APP_ORIGINS no está configurado en el servidor' }, 500)
  }

  const requestOrigin = (req.headers.get('Origin') || '').replace(/\/$/, '')
  if (configuredOrigins.length && requestOrigin && !configuredOrigins.includes(requestOrigin)) {
    return json(req, { error: 'Origen no autorizado' }, 403)
  }

  const contentLength = Number(req.headers.get('Content-Length') || 0)
  if (contentLength > 32 * 1024) return json(req, { error: 'Solicitud demasiado grande' }, 413)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { error: 'Configuración del servidor incompleta' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user: callerUser }, error: authError } = await caller.auth.getUser()
    if (authError || !callerUser) return json(req, { error: 'No autenticado' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const getBanState = async (userId: string) => {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error || !data.user) throw new Error('No se pudo verificar la cuenta de acceso')
      const bannedUntil = data.user.banned_until ? new Date(data.user.banned_until).getTime() : 0
      return bannedUntil > Date.now()
    }

    const setBanState = async (userId: string, banned: boolean) => {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: banned ? '876000h' : 'none',
      })
      if (error) {
        throw new Error(banned
          ? 'No se pudo bloquear la cuenta de acceso'
          : 'No se pudo reactivar la cuenta de acceso')
      }
    }

    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('role, gym_id')
      .eq('id', callerUser.id)
      .single()

    if (callerProfileError || callerProfile?.role !== 'admin' || !callerProfile.gym_id) {
      return json(req, { error: 'Solo un administrador puede realizar esta acción' }, 403)
    }
    const gymId = callerProfile.gym_id as string

    const { data: secureAdmin, error: secureAdminError } = await caller.rpc('is_admin')
    if (secureAdminError || secureAdmin !== true) {
      return json(req, { error: 'Completa la verificación MFA antes de administrar usuarios' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body?.action) return json(req, { error: 'Falta el campo action' }, 400)

    if (body.action === 'create') {
      const email = cleanText(body.email, 320)?.toLowerCase()
      const password = String(body.password ?? '')
      const fullName = cleanText(body.fullName, 160)
      const phone = cleanText(body.phone, 40)
      const rawDpi = cleanText(body.dpi, 40)
      const dpi = rawDpi ? rawDpi.replace(/\D/g, '') : null
      const birthDate = validDate(body.birthDate) ? body.birthDate : null
      const startDate = validDate(body.startDate) ? body.startDate : null
      const emergencyContact = cleanText(body.emergencyContact, 250)
      const notes = cleanText(body.notes, 2000)
      const planId = cleanText(body.planId, 80)

      if (!email || !validEmail(email) || !password || !fullName || !startDate) {
        return json(req, { error: 'Nombre, email válido, contraseña y fecha de inicio son obligatorios' }, 400)
      }
      if (password.length < 10) {
        return json(req, { error: 'La contraseña temporal debe tener al menos 10 caracteres' }, 400)
      }
      if (dpi && !/^\d{13}$/.test(dpi)) {
        return json(req, { error: 'El DPI debe contener exactamente 13 dígitos' }, 400)
      }

      if (planId) {
        const { data: plan } = await admin
          .from('plans')
          .select('id')
          .eq('id', planId)
          .eq('gym_id', gymId)
          .eq('is_active', true)
          .maybeSingle()
        if (!plan) return json(req, { error: 'El plan no pertenece a este gimnasio o está inactivo' }, 400)
      }

      // Nunca se reutiliza una cuenta existente ni se cambia su contraseña.
      // La recuperación de acceso siempre pertenece al dueño del email.
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createError || !created.user) {
        const conflict = /already|registered|exists/i.test(createError?.message || '')
        return json(req, {
          error: conflict
            ? 'Este email ya está registrado. Usa recuperación de contraseña o un email diferente.'
            : createError?.message || 'No se pudo crear la cuenta',
        }, conflict ? 409 : 400)
      }

      const authUserId = created.user.id
      const { data: member, error: provisionError } = await admin.rpc('provision_member_data', {
        p_actor_id: callerUser.id,
        p_auth_user_id: authUserId,
        p_gym_id: gymId,
        p_email: email,
        p_full_name: fullName,
        p_phone: phone,
        p_dpi: dpi,
        p_birth_date: birthDate,
        p_plan_id: planId,
        p_start_date: startDate,
        p_emergency_contact: emergencyContact,
        p_notes: notes,
      })

      if (provisionError) {
        await admin.auth.admin.deleteUser(authUserId)
        const duplicateDpi = provisionError.code === '23505'
        return json(req, {
          error: duplicateDpi
            ? 'Este DPI ya está asignado a otro miembro.'
            : 'No se pudo crear la ficha: ' + provisionError.message,
        }, 400)
      }

      return json(req, { user: { id: authUserId, email }, member })
    }

    if (body.action === 'update') {
      const memberId = cleanText(body.memberId, 80)
      const fullName = cleanText(body.fullName, 160)
      const phone = cleanText(body.phone, 40)
      const rawDpi = cleanText(body.dpi, 40)
      const dpi = rawDpi ? rawDpi.replace(/\D/g, '') : null
      const birthDate = validDate(body.birthDate) ? body.birthDate : null
      const startDate = validDate(body.startDate) ? body.startDate : null
      const emergencyContact = cleanText(body.emergencyContact, 250)
      const notes = cleanText(body.notes, 2000)
      const planId = cleanText(body.planId, 80)
      const status = cleanText(body.status, 30)

      if (!memberId || !fullName || !startDate || !status) {
        return json(req, { error: 'Faltan datos obligatorios del miembro' }, 400)
      }
      if (dpi && !/^\d{13}$/.test(dpi)) {
        return json(req, { error: 'El DPI debe contener exactamente 13 dígitos' }, 400)
      }
      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return json(req, { error: 'Estado de membresía no válido' }, 400)
      }

      const { data: target, error: targetError } = await admin
        .from('members')
        .select('id, profile_id, gym_id, archived_at')
        .eq('id', memberId)
        .eq('gym_id', gymId)
        .maybeSingle()
      if (targetError || !target || target.archived_at) {
        return json(req, { error: 'Miembro no encontrado o archivado' }, 404)
      }

      const previousBanState = await getBanState(target.profile_id)
      const desiredBanState = status !== 'active'
      const authStateChanged = previousBanState !== desiredBanState
      if (authStateChanged) await setBanState(target.profile_id, desiredBanState)

      const { data, error } = await caller.rpc('admin_update_member_data', {
        p_member_id: memberId,
        p_full_name: fullName,
        p_phone: phone,
        p_dpi: dpi,
        p_birth_date: birthDate,
        p_status: status,
        p_plan_id: planId,
        p_start_date: startDate,
        p_emergency_contact: emergencyContact,
        p_notes: notes,
      })
      if (error) {
        if (authStateChanged) {
          try { await setBanState(target.profile_id, previousBanState) } catch { /* se conserva el error principal */ }
        }
        return json(req, {
          error: error.code === '23505' ? 'Este DPI ya está asignado a otro miembro.' : error.message,
        }, 400)
      }
      return json(req, { ok: true, member: data })
    }

    if (['deactivate', 'archive', 'restore'].includes(body.action)) {
      const memberId = cleanText(body.memberId, 80)
      if (!memberId) return json(req, { error: 'Falta memberId' }, 400)

      const { data: target } = await admin
        .from('members')
        .select('id, profile_id, gym_id, archived_at, profile:profiles(role)')
        .eq('id', memberId)
        .eq('gym_id', gymId)
        .maybeSingle()
      if (!target) return json(req, { error: 'Miembro no encontrado' }, 404)
      const targetProfile = Array.isArray(target.profile) ? target.profile[0] : target.profile
      if (targetProfile?.role === 'admin') return json(req, { error: 'No se puede modificar a un administrador' }, 403)

      const rpcName = body.action === 'archive'
        ? 'archive_member'
        : body.action === 'restore' ? 'restore_member' : 'deactivate_member'

      const previousBanState = await getBanState(target.profile_id)
      const desiredBanState = body.action !== 'restore'
      const authStateChanged = previousBanState !== desiredBanState
      if (authStateChanged) await setBanState(target.profile_id, desiredBanState)

      const { error: stateError } = await caller.rpc(rpcName, { p_member_id: memberId })
      if (stateError) {
        if (authStateChanged) {
          try { await setBanState(target.profile_id, previousBanState) } catch { /* se conserva el error principal */ }
        }
        return json(req, { error: stateError.message }, 400)
      }

      return json(req, { ok: true })
    }

    if (body.action === 'delete') {
      return json(req, {
        error: 'El borrado permanente está deshabilitado. Archiva al miembro para conservar el historial financiero.',
      }, 410)
    }

    return json(req, { error: `Acción desconocida: ${body.action}` }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    return json(req, { error: message }, 500)
  }
})

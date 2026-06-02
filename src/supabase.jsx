import { createClient } from '@supabase/supabase-js'

const supabaseUrl      = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey  = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Cliente normal — para todo el uso general
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin — SOLO para crear usuarios sin afectar la sesión activa
// storageKey diferente evita el warning de "multiple GoTrueClient instances"
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'gymapp-admin-auth',
      }
    })
  : null

// ── AUTENTICACIÓN ──────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ── PERFIL ─────────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

// ── CREAR USUARIO SIN AFECTAR SESIÓN DEL ADMIN ────────────
// Si el email ya existia (usuario eliminado), lo reactiva con nueva contraseña
export const adminCreateUser = async (email, password, fullName) => {
  if (!supabaseAdmin) {
    return { error: { message: 'Falta VITE_SUPABASE_SERVICE_KEY en las variables de entorno' } }
  }

  // Intento 1: crear normalmente
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'user' }
  })

  if (!error) return { data, error: null }

  // Si el error es "ya registrado", buscar y reactivar el usuario
  const isAlreadyRegistered =
    error.message?.toLowerCase().includes('already been registered') ||
    error.message?.toLowerCase().includes('already registered') ||
    error.message?.toLowerCase().includes('already exists')

  if (!isAlreadyRegistered) return { data, error }

  // Buscar el usuario por email en Auth
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return { data: null, error: listError }

  const existingUser = listData?.users?.find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  )
  if (!existingUser) return { data: null, error }

  // Reactivar: nueva contrasena, desbanear, actualizar metadatos
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    existingUser.id,
    {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'user' },
      ban_duration: 'none',
    }
  )

  if (updateError) return { data: null, error: updateError }

  // Recrear perfil por si quedo huerfano
  await supabase.from('profiles').upsert({
    id: existingUser.id,
    email,
    full_name: fullName,
    role: 'user'
  })

  return { data: { user: existingUser }, error: null }
}

// ── MIEMBROS ───────────────────────────────────────────────
export const getMembers = async () => {
  const { data, error } = await supabase
    .from('members')
    .select(`
      *,
      profile:profiles(*),
      plan:plans(*)
    `)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const getMemberByProfile = async (profileId) => {
  const { data, error } = await supabase
    .from('members')
    .select(`
      *,
      profile:profiles(*),
      plan:plans(*)
    `)
    .eq('profile_id', profileId)
    .single()
  return { data, error }
}

export const updateMember = async (id, updates) => {
  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Desactivar miembro (reversible — solo cambia status)
export const deactivateMember = async (id) => {
  const { error } = await supabase
    .from('members')
    .update({ status: 'inactive' })
    .eq('id', id)
  return { error }
}

// Reactivar miembro
export const reactivateMember = async (id) => {
  const { error } = await supabase
    .from('members')
    .update({ status: 'active' })
    .eq('id', id)
  return { error }
}

// Eliminar miembro COMPLETAMENTE (borra de Auth + todas sus tablas)
// Requiere VITE_SUPABASE_SERVICE_KEY configurada en Vercel
export const deleteMemberPermanently = async (memberId, profileId) => {
  if (!supabaseAdmin) {
    return { error: { message: 'Falta VITE_SUPABASE_SERVICE_KEY en las variables de entorno de Vercel.' } }
  }

  // 1) Eliminar datos relacionados en orden (por foreign keys)
  await supabase.from('attendance').delete().eq('member_id', memberId)
  await supabase.from('measurements').delete().eq('member_id', memberId)
  await supabase.from('progress_photos').delete().eq('member_id', memberId)
  await supabase.from('payments').delete().eq('member_id', memberId)
  await supabase.from('members').delete().eq('id', memberId)
  await supabase.from('notifications').delete().eq('profile_id', profileId)

  // 2) Eliminar de Supabase Auth (requiere service role)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(profileId)
  return { error }
}

// ── PAGOS ──────────────────────────────────────────────────
export const getPayments = async (memberId = null) => {
  let query = supabase
    .from('payments')
    .select(`*, member:members(*, profile:profiles(*))`)
    .order('due_date', { ascending: false })
  if (memberId) query = query.eq('member_id', memberId)
  const { data, error } = await query
  return { data, error }
}

export const createPayment = async (payment) => {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single()
  return { data, error }
}

export const updatePayment = async (id, updates) => {
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const uploadVoucher = async (file, memberId) => {
  const ext = file.name.split('.').pop()
  const path = `${memberId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('vouchers')
    .upload(path, file, { upsert: false })
  if (error) return { error }
  const { data: urlData } = supabase.storage.from('vouchers').getPublicUrl(path)
  return { url: urlData.publicUrl }
}

// ── MEDIDAS ────────────────────────────────────────────────
export const getMeasurements = async (memberId) => {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .eq('member_id', memberId)
    .order('measured_at', { ascending: false })
  return { data, error }
}

export const createMeasurement = async (measurement) => {
  const { data, error } = await supabase
    .from('measurements')
    .insert(measurement)
    .select()
    .single()
  return { data, error }
}

export const updateMeasurement = async (id, updates) => {
  const { data, error } = await supabase
    .from('measurements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ── FOTOS DE PROGRESO ──────────────────────────────────────
export const getProgressPhotos = async (memberId) => {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('member_id', memberId)
    .order('photo_date', { ascending: false })
  return { data, error }
}

export const uploadProgressPhoto = async (file, memberId) => {
  const ext = file.name.split('.').pop()
  const path = `${memberId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('progress')
    .upload(path, file)
  if (error) return { error }
  const { data: urlData } = supabase.storage.from('progress').getPublicUrl(path)
  return { url: urlData.publicUrl }
}

export const createProgressPhoto = async (photo) => {
  const { data, error } = await supabase
    .from('progress_photos')
    .insert(photo)
    .select()
    .single()
  return { data, error }
}

// ── ASISTENCIA ─────────────────────────────────────────────
export const getAttendance = async (memberId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('member_id', memberId)
    .order('attended_date', { ascending: false })
  return { data, error }
}

export const markAttendance = async (memberId, date) => {
  const { data, error } = await supabase
    .from('attendance')
    .upsert({ member_id: memberId, attended_date: date })
    .select()
    .single()
  return { data, error }
}

export const removeAttendance = async (memberId, date) => {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('member_id', memberId)
    .eq('attended_date', date)
  return { error }
}

// ── NOTIFICACIONES ─────────────────────────────────────────
export const getNotifications = async (profileId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

export const markAllNotificationsRead = async (profileId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false)
  return { error }
}

export const createNotification = async (notif) => {
  const { error } = await supabase.from('notifications').insert(notif)
  return { error }
}

// ── ANUNCIOS ──────────────────────────────────────────────────
export const getAnnouncements = async (onlyActive = true) => {
  let query = supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (onlyActive) {
    query = query.eq('is_active', true)
  }
  const { data, error } = await query
  return { data, error }
}

export const createAnnouncement = async (announcement) => {
  const { data, error } = await supabase
    .from('announcements')
    .insert(announcement)
    .select()
    .single()
  return { data, error }
}

export const updateAnnouncement = async (id, updates) => {
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const deleteAnnouncement = async (id) => {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
  return { error }
}

// ── PLANES ─────────────────────────────────────────────────
export const getPlans = async () => {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price')
  return { data, error }
}

export const createPlan = async (plan) => {
  const { data, error } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single()
  return { data, error }
}

export const updatePlan = async (id, updates) => {
  const { data, error } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const deletePlan = async (id) => {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: false })
    .eq('id', id)
  return { error }
}
// ── ANUNCIOS ───────────────────────────────────────────────
export const getAnnouncements = async () => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('visible', true)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().split('T')[0]}`)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createAnnouncement = async (ann) => {
  const { data, error } = await supabase
    .from('announcements')
    .insert(ann)
    .select()
    .single()
  return { data, error }
}

export const updateAnnouncement = async (id, updates) => {
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const deleteAnnouncement = async (id) => {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
  return { error }
}

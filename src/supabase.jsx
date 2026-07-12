import { createClient } from '@supabase/supabase-js'

// Fecha de HOY en hora local (no UTC) — para filtros por fecha
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const supabaseUrl      = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Cliente normal — para todo el uso general
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── OPERACIONES PRIVILEGIADAS (Edge Function) ──────────────
// La service role key ya NO vive en el frontend: cualquier variable
// VITE_* se empaqueta en el JavaScript público que descarga el
// navegador, y con esa llave se saltan TODAS las políticas RLS.
// Crear y eliminar usuarios de Auth ahora pasa por la Edge Function
// "admin-users", que corre en el servidor de Supabase y verifica
// que quien llama sea un administrador autenticado.
const invokeAdminUsers = async (body) => {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // Intentar extraer el mensaje real que devolvió la función
    let message = error.message || 'Error en el servidor'
    try {
      const ctx = await error.context?.json()
      if (ctx?.error) message = ctx.error
    } catch { /* la respuesta no traía JSON */ }
    return { data: null, error: { message } }
  }
  if (data?.error) return { data: null, error: { message: data.error } }
  return { data, error: null }
}

// ── AUTENTICACIÓN ──────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ── GIMNASIO (su configuración: logo, color, QR, horarios) ───────────────────────────────
// Lee el gimnasio del usuario actual (RLS solo deja ver el propio)
export const getMyGym = async (gymId) => {
  let query = supabase.from('gyms').select('*')
  if (gymId) query = query.eq('id', gymId)
  else query = query.limit(1)
  const { data, error } = await query.single()
  return { data, error }
}

// Actualiza datos del gimnasio actual (nombre, whatsapp, color, logo…)
export const updateGym = async (gymId, updates) => {
  const { data, error } = await supabase
    .from('gyms')
    .update(updates)
    .eq('id', gymId)
    .select()
    .single()
  return { data, error }
}

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
// Ahora pasa por la Edge Function "admin-users": corre en el servidor,
// valida que quien llama sea un admin autenticado y usa la service
// role SOLO del lado del servidor. Si el email ya existía (usuario
// eliminado), la función lo reactiva con la nueva contraseña.
// El gym_id se determina en el servidor a partir del perfil del
// admin que llama — el navegador ya no lo envía.
export const adminCreateUser = async (email, password, fullName) => {
  // Devuelve { data: { user: { id, email } }, error } — misma forma que antes
  return invokeAdminUsers({ action: 'create', email, password, fullName })
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
// El borrado en Auth pasa por la Edge Function "admin-users"
export const deleteMemberPermanently = async (memberId, profileId) => {
  // 1) Eliminar datos relacionados en orden (por foreign keys)
  await supabase.from('attendance').delete().eq('member_id', memberId)
  await supabase.from('measurements').delete().eq('member_id', memberId)
  await supabase.from('progress_photos').delete().eq('member_id', memberId)
  await supabase.from('payments').delete().eq('member_id', memberId)
  await supabase.from('members').delete().eq('id', memberId)
  await supabase.from('notifications').delete().eq('profile_id', profileId)

  // 2) Eliminar de Supabase Auth (la Edge Function valida y ejecuta)
  const { error } = await invokeAdminUsers({ action: 'delete', profileId })
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
    .or(`expires_at.is.null,expires_at.gte.${localToday()}`)
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

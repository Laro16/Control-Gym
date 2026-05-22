import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export const createMember = async (profileData, memberData) => {
  // 1) Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin
    ? await supabase.auth.admin.createUser({
        email: profileData.email,
        password: profileData.password,
        user_metadata: { full_name: profileData.full_name, role: 'user' }
      })
    : { data: null, error: new Error('Usa el método signUp desde el panel') }

  if (authError) return { error: authError }

  // 2) Crear el miembro
  const { data, error } = await supabase
    .from('members')
    .insert({ ...memberData, profile_id: authData.user.id })
    .select()
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

export const deleteMember = async (id) => {
  const { error } = await supabase.from('members').delete().eq('id', id)
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
  const { data, error } = await supabase.storage
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

export const markNotificationRead = async (id) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  return { error }
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

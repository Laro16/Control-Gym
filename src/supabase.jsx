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

const PRIVATE_URL_TTL_SECONDS = 60 * 60
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const validateImageFile = (file, maxMb = 5) => {
  if (!file) return 'Selecciona una imagen'
  if (!IMAGE_TYPES[file.type]) return 'Solo se permiten imagenes JPG, PNG o WebP'
  if (file.size > maxMb * 1024 * 1024) return `La imagen no debe superar ${maxMb} MB`
  return null
}

// Las columnas existentes conservan el nombre *_url por compatibilidad, pero
// para buckets privados guardan una ruta estable. Al leer se genera una URL
// firmada de corta duracion. Tambien migra de forma transparente URLs publicas
// antiguas que hayan quedado almacenadas.
const storagePath = (value, bucket) => {
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) return String(value).replace(/^\/+/, '')
  try {
    const url = new URL(value)
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ]
    const marker = markers.find(m => url.pathname.includes(m))
    return marker ? decodeURIComponent(url.pathname.split(marker)[1]) : null
  } catch {
    return null
  }
}

const signPrivateValues = async (values, bucket) => {
  const paths = [...new Set(values.map(v => storagePath(v, bucket)).filter(Boolean))]
  if (!paths.length) return new Map()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, PRIVATE_URL_TTL_SECONDS)
  if (error || !data) return new Map()
  return new Map(data.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]))
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
export const adminCreateUser = async (email, password, fullName, memberData = {}) => {
  return invokeAdminUsers({
    action: 'create',
    email,
    password,
    fullName,
    phone: memberData.phone || null,
    birthDate: memberData.birth_date || null,
    planId: memberData.plan_id || null,
    startDate: memberData.start_date,
    emergencyContact: memberData.emergency_contact || null,
    notes: memberData.notes || null,
  })
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
  const safeUpdates = { ...updates }
  // Una columna UUID no acepta la cadena vacía. En los formularios, "Sin plan"
  // usa value="", así que se convierte explícitamente a NULL antes de guardar.
  if (Object.prototype.hasOwnProperty.call(safeUpdates, 'plan_id')) {
    safeUpdates.plan_id = safeUpdates.plan_id || null
  }
  const { data, error } = await supabase
    .from('members')
    .update(safeUpdates)
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
  return invokeAdminUsers({ action: 'delete', memberId, profileId })
}

// ── PAGOS ──────────────────────────────────────────────────
export const getPayments = async (memberId = null) => {
  let query = supabase
    .from('payments')
    .select(`*, member:members(*, profile:profiles(*))`)
    .order('due_date', { ascending: false })
  if (memberId) query = query.eq('member_id', memberId)
  const { data, error } = await query
  if (error || !data) return { data, error }
  const signed = await signPrivateValues(data.map(p => p.voucher_url), 'vouchers')
  return {
    data: data.map(p => {
      const path = storagePath(p.voucher_url, 'vouchers')
      return {
        ...p,
        voucher_path: path,
        voucher_url: path ? signed.get(path) || null : null,
      }
    }),
    error: null,
  }
}

// Aprobar/rechazar en el servidor evita estados parciales: Supabase actualiza
// aprobador, fecha y notificación al miembro dentro de una sola transacción.
export const reviewPayment = async (paymentId, status) => {
  const { data, error } = await supabase.rpc('review_payment', {
    p_payment_id: paymentId,
    p_status: status,
  })
  return { data, error }
}

// El vencimiento del siguiente ciclo se calcula en Supabase. Así un admin no
// puede crear por accidente una cuota duplicada o saltarse un ciclo.
export const registerAdminPayment = async ({ member_id, amount, payment_method, payment_date, notes }) => {
  const { data, error } = await supabase.rpc('register_admin_payment', {
    p_member_id: member_id,
    p_amount: Number(amount),
    p_payment_method: payment_method,
    p_payment_date: payment_date || null,
    p_notes: notes?.trim() || null,
  })
  return { data, error }
}

export const uploadVoucher = async (file, memberId) => {
  const validationError = validateImageFile(file)
  if (validationError) return { error: { message: validationError } }
  const ext = IMAGE_TYPES[file.type]
  const path = `${memberId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('vouchers')
    .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
  if (error) return { error }
  return { path }
}

export const attachPaymentVoucher = async (paymentId, voucherPath) => {
  const { data, error } = await supabase.rpc('attach_payment_voucher', {
    p_payment_id: paymentId,
    p_voucher_path: voucherPath,
  })
  return { data, error }
}

export const submitMemberPayments = async (dueDates, method, voucherPath) => {
  const { data, error } = await supabase.rpc('submit_member_payments', {
    p_due_dates: dueDates,
    p_payment_method: method,
    p_voucher_path: voucherPath,
  })
  return { data, error }
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
  if (error || !data) return { data, error }
  const signed = await signPrivateValues(data.map(p => p.photo_url), 'progress')
  return {
    data: data.map(p => {
      const path = storagePath(p.photo_url, 'progress')
      return {
        ...p,
        photo_path: path,
        photo_url: path ? signed.get(path) || null : null,
      }
    }),
    error: null,
  }
}

export const uploadProgressPhoto = async (file, memberId) => {
  const validationError = validateImageFile(file)
  if (validationError) return { error: { message: validationError } }
  const ext = IMAGE_TYPES[file.type]
  const path = `${memberId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('progress')
    .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
  if (error) return { error }
  return { path }
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
    .upsert(
      { member_id: memberId, attended_date: date },
      { onConflict: 'member_id,attended_date' }
    )
    .select()
    .single()
  return { data, error }
}

export const registerCheckin = async (code) => {
  const { data, error } = await supabase.rpc('register_checkin', { p_code: code })
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

export const createPlan = async (plan, gymId) => {
  const { data, error } = await supabase
    .from('plans')
    .insert({ ...plan, gym_id: gymId })
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
  const { data, error } = await supabase.rpc('archive_plan', { p_plan_id: id })
  return { data, error }
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

export const getAdminAnnouncements = async () => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return { data, error }
}

export const createAnnouncement = async (ann, gymId) => {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ ...ann, gym_id: gymId })
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

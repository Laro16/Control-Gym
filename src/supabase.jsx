import { createClient } from '@supabase/supabase-js'

const DEFAULT_GYM_TIMEZONE = import.meta.env.VITE_GYM_TIMEZONE || 'America/Guatemala'
const GYM_COLUMNS = [
  'id', 'name', 'logo_url', 'primary_color', 'whatsapp_number', 'address',
  'created_at', 'closed_weekdays', 'holidays', 'timezone', 'allow_overdue_checkin',
].join(',')
const PAGE_SIZE = 500

// Fecha de respaldo en la zona del gimnasio, nunca en la zona del dispositivo.
const localToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_GYM_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

const fetchAllPages = async (buildQuery) => {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
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

export const requestPasswordReset = (email) =>
  supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })

export const updateCurrentPassword = (password) =>
  supabase.auth.updateUser({ password })

export const completeInitialPasswordChange = () =>
  supabase.rpc('complete_initial_password_change')

// ── GIMNASIO (su configuración: logo, color, QR, horarios) ───────────────────────────────
// Lee el gimnasio del usuario actual (RLS solo deja ver el propio)
export const getMyGym = async (gymId) => {
  let query = supabase.from('gyms').select(GYM_COLUMNS)
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
    .select(GYM_COLUMNS)
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
    dpi: memberData.dpi || null,
    birthDate: memberData.birth_date || null,
    planId: memberData.plan_id || null,
    startDate: memberData.start_date,
    emergencyContact: memberData.emergency_contact || null,
    notes: memberData.notes || null,
  })
}

// Actualiza en el servidor los datos personales y de membresía de un usuario.
// Se usa la misma Edge Function protegida para que un administrador solamente
// pueda modificar miembros de su propio gimnasio.
export const adminUpdateMember = async (memberId, updates = {}) => {
  return invokeAdminUsers({
    action: 'update',
    memberId,
    fullName: updates.full_name,
    phone: updates.phone || null,
    dpi: updates.dpi || null,
    birthDate: updates.birth_date || null,
    status: updates.status,
    planId: updates.plan_id || null,
    startDate: updates.start_date,
    emergencyContact: updates.emergency_contact || null,
    notes: updates.notes || null,
  })
}

// ── MIEMBROS ───────────────────────────────────────────────
export const getMembers = async () => {
  return fetchAllPages(() => supabase
    .from('members')
    .select(`
      *,
      profile:profiles(*),
      plan:plans(*)
    `)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }))
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
  return adminUpdateMember(id, safeUpdates)
}

// Desactivar miembro: cambia el estado y bloquea la cuenta Auth.
export const deactivateMember = async (id) => {
  return invokeAdminUsers({ action: 'deactivate', memberId: id })
}

// Reactivar miembro
export const reactivateMember = async (id) => {
  return invokeAdminUsers({ action: 'restore', memberId: id })
}

// Archivar conserva pagos, asistencia y evidencia financiera; además bloquea Auth.
export const archiveMember = async (memberId) =>
  invokeAdminUsers({ action: 'archive', memberId })

// Alias temporal para componentes antiguos: ya no borra datos.
export const deleteMemberPermanently = async (memberId) => archiveMember(memberId)

// ── PAGOS ──────────────────────────────────────────────────
export const getPayments = async (memberId = null) => {
  const { data, error } = await fetchAllPages(() => {
    let query = supabase
      .from('payments')
      .select(`*, member:members(*, profile:profiles(*))`)
      .order('due_date', { ascending: false })
      .order('id', { ascending: false })
    if (memberId) query = query.eq('member_id', memberId)
    return query
  })
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

export const issueCheckinToken = async (ttlSeconds = 90) => {
  const { data, error } = await supabase.rpc('issue_checkin_token', {
    p_ttl_seconds: ttlSeconds,
  })
  return { data, error }
}

export const getGymBusinessDate = async () => {
  const { data, error } = await supabase.rpc('get_gym_business_date')
  return { data, error }
}

// ── MEDIDAS ────────────────────────────────────────────────
export const getMeasurements = async (memberId) => {
  return fetchAllPages(() => supabase
    .from('measurements')
    .select('*')
    .eq('member_id', memberId)
    .order('measured_at', { ascending: false })
    .order('id', { ascending: false }))
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
  const { data, error } = await fetchAllPages(() => supabase
    .from('progress_photos')
    .select('*')
    .eq('member_id', memberId)
    .order('photo_date', { ascending: false })
    .order('id', { ascending: false }))
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
  return fetchAllPages(() => supabase
    .from('attendance')
    .select('*')
    .eq('member_id', memberId)
    .order('attended_date', { ascending: false })
    .order('id', { ascending: false }))
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

export const getAuditEvents = async (limit = 200) => {
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
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
  void gymId
  return savePlan(null, plan)
}

export const updatePlan = async (id, updates) => {
  return savePlan(id, updates)
}

const savePlan = async (id, plan) => {
  const { data, error } = await supabase.rpc('save_plan', {
    p_plan_id: id,
    p_name: plan.name,
    p_description: plan.description || null,
    p_price: Number(plan.price),
    p_duration_days: Number(plan.duration_days),
    p_features: plan.features || [],
  })
  return { data, error }
}

export const deletePlan = async (id) => {
  const { data, error } = await supabase.rpc('archive_plan', { p_plan_id: id })
  return { data, error }
}
// ── ANUNCIOS ───────────────────────────────────────────────
export const getAnnouncements = async () => {
  const { data: serverToday } = await getGymBusinessDate()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('visible', true)
    .or(`expires_at.is.null,expires_at.gte.${serverToday || localToday()}`)
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

import { useState, useEffect, useCallback } from 'react'
import {
  Users, CreditCard, Bell, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet,
  Dumbbell, TrendingUp, TrendingDown, Minus, Camera, Calendar,
  LogOut, Home, ClipboardList, MessageCircle, Eye,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle, Layers
} from 'lucide-react'
import {
  supabase,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement, updateMeasurement,
  updateMember, deleteMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  generatePaymentPDF, generatePaymentHistoryPDF, generatePaymentHistoryExcel,
  generateMasterExcel, today, addDays, calculateStreak
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'

// ── SMALL COMPONENTS ──────────────────────────────────────

function StatusDot({ status }) {
  const s = paymentStatusLabel[status] || paymentStatusLabel.current
  return <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-semibold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ open, onClose, onConfirm, message }) {
  return (
    <Modal open={open} onClose={onClose} title="Confirmar acción">
      <p className="text-gray-300 mb-5">{message}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-danger" onClick={() => { onConfirm(); onClose() }}>Confirmar</button>
      </div>
    </Modal>
  )
}

// ── ADMIN DASHBOARD ────────────────────────────────────────
export function AdminDashboard({ profile, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [plans, setPlans] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [m, p, pl, n] = await Promise.all([
      getMembers(), getPayments(), getPlans(),
      getNotifications(profile.id)
    ])
    setMembers(m.data || [])
    setPayments(p.data || [])
    setPlans(pl.data || [])
    setNotifications(n.data || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  const unread = notifications.filter(n => !n.is_read).length

  const tabs = [
    { id: 'overview',  label: 'Inicio',    icon: Home },
    { id: 'members',   label: 'Miembros',  icon: Users },
    { id: 'payments',  label: 'Pagos',     icon: CreditCard },
    { id: 'plans',     label: 'Planes',    icon: Layers },
    { id: 'reports',   label: 'Reportes',  icon: FileText },
  ]

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      {/* TOP BAR */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand-500" />
            <span className="font-display text-xl tracking-wide text-white">
              {import.meta.env.VITE_GYM_NAME || 'GymApp'}
            </span>
            <span className="hidden sm:inline text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="relative btn-ghost p-2"
              onClick={() => {
                setShowNotifs(!showNotifs)
                if (!showNotifs) markAllNotificationsRead(profile.id)
              }}
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button className="btn-ghost p-2" onClick={onLogout}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificaciones dropdown */}
        {showNotifs && (
          <div className="absolute right-4 top-14 w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-96 overflow-y-auto">
            <h4 className="font-semibold text-sm text-gray-400 mb-3">Notificaciones</h4>
            {notifications.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin notificaciones</p>
            ) : notifications.slice(0, 20).map(n => (
              <div key={n.id} className={`py-2.5 border-b border-gray-800 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-50'}`}>
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-gray-400">{n.message}</p>
                <p className="text-xs text-gray-600 mt-0.5">{formatDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* NAV TABS */}
      <nav className="bg-gray-900/50 border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {loading ? <Spinner /> : (
          <>
            {tab === 'overview' && <AdminOverview members={members} payments={payments} onRefresh={loadData} profile={profile} />}
            {tab === 'members' && <AdminMembers members={members} plans={plans} onRefresh={loadData} />}
            {tab === 'payments' && <AdminPayments payments={payments} onRefresh={loadData} profile={profile} />}
            {tab === 'plans'   && <AdminPlans plans={plans} onRefresh={loadData} />}
            {tab === 'reports' && <AdminReports members={members} payments={payments} />}
          </>
        )}
      </main>
    </div>
  )
}

// ── OVERVIEW ───────────────────────────────────────────────
function AdminOverview({ members, payments, profile }) {
  const active = members.filter(m => m.status === 'active').length
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const overdueMembers = members.filter(m => {
    const mp = payments.filter(p => p.member_id === m.id && p.status !== 'rejected')
    if (!mp.length) return false
    const last = mp[0]
    return getPaymentStatus(last.due_date) === 'overdue'
  })

  const totalMonth = payments
    .filter(p => p.status === 'approved' && p.payment_date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((a, p) => a + Number(p.amount), 0)

  const stats = [
    { label: 'Miembros activos', value: active, icon: Users, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Pendientes de aprobación', value: pendingPayments.length, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Con cuota vencida', value: overdueMembers.length, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Ingresos este mes', value: formatCurrency(totalMonth), icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title">Bienvenido, {profile.full_name.split(' ')[0]} 👋</h2>
        <p className="text-gray-500 text-sm mt-1">{formatDate(today())}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card-hover">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alertas de cuotas */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-brand-500" />
          Estado de cuotas
        </h3>
        <div className="space-y-2">
          {members.slice(0, 8).map(m => {
            const mp = payments.filter(p => p.member_id === m.id)
            const last = mp[0]
            const st = last ? getPaymentStatus(last.due_date) : 'current'
            const stLabel = paymentStatusLabel[st]
            return (
              <div key={m.id} className="card flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 ${stLabel.bg || 'bg-gray-800'} flex items-center justify-center`}>
                    <span className="text-xs font-bold text-white">
                      {m.profile?.full_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.profile?.full_name}</p>
                    <p className="text-xs text-gray-500">{last ? `Vence ${formatDate(last.due_date)}` : 'Sin pagos'}</p>
                  </div>
                </div>
                <span className={stLabel.cls}>{stLabel.text}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagos pendientes */}
      {pendingPayments.length > 0 && (
        <div>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            Comprobantes pendientes ({pendingPayments.length})
          </h3>
          <div className="space-y-2">
            {pendingPayments.map(p => (
              <div key={p.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{p.member?.profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(p.amount)} — {formatDate(p.due_date)}</p>
                </div>
                <span className="badge-yellow">Pendiente</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ADMIN MEMBERS ──────────────────────────────────────────
function AdminMembers({ members, plans, onRefresh }) {
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = members.filter(m =>
    m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.profile?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (memberId) => {
    await deleteMember(memberId)
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="section-title">Miembros</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Nuevo miembro
        </button>
      </div>

      <input
        className="input"
        placeholder="Buscar por nombre o email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="space-y-3">
        {filtered.map(m => (
          <div key={m.id} className="card-hover">
            <div className="flex items-center justify-between gap-3">
              <button
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => setSelected(selected?.id === m.id ? null : m)}
              >
                <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex-shrink-0 flex items-center justify-center">
                  <span className="font-bold text-brand-400">{m.profile?.full_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{m.profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{m.profile?.email} · {m.plan?.name || 'Sin plan'}</p>
                </div>
              </button>
              <div className="flex items-center gap-1">
                <span className={m.status === 'active' ? 'badge-green' : 'badge-gray'}>
                  {m.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
                <button className="btn-ghost p-1.5" onClick={() => setSelected(m)}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="btn-danger p-1.5" onClick={() => setConfirmDelete(m.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selected?.id === m.id && (
              <MemberDetail member={m} plans={plans} onRefresh={onRefresh} onClose={() => setSelected(null)} />
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No se encontraron miembros
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        message="¿Eliminar este miembro? Esta acción no se puede deshacer."
      />

      <CreateMemberModal open={showCreate} onClose={() => { setShowCreate(false); onRefresh() }} plans={plans} />
    </div>
  )
}

// ── MEMBER DETAIL (dentro del admin) ──────────────────────
function MemberDetail({ member, plans, onRefresh, onClose }) {
  const [tab, setTab] = useState('info')
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [showMeasForm, setShowMeasForm] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoadingData(true)
      const [m, p] = await Promise.all([
        getMeasurements(member.id),
        getProgressPhotos(member.id)
      ])
      setMeasurements(m.data || [])
      setPhotos(p.data || [])
      setLoadingData(false)
    }
    load()
  }, [member.id])

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'measures', label: 'Medidas' },
    { id: 'photos', label: 'Fotos' },
  ]

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-500 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingData && <div className="py-4 text-center text-gray-500 text-sm">Cargando...</div>}

      {!loadingData && tab === 'info' && (
        <EditMemberForm member={member} plans={plans} onSave={async (updates) => {
          await updateMember(member.id, updates)
          onRefresh()
        }} />
      )}

      {!loadingData && tab === 'measures' && (
        <div className="space-y-3">
          <button className="btn-primary text-sm" onClick={() => setShowMeasForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Agregar medidas
          </button>
          {measurements.slice(0, 6).map((m, i) => (
            <MeasurementCard key={m.id} current={m} previous={measurements[i + 1]} />
          ))}
          {measurements.length === 0 && <p className="text-gray-500 text-sm">Sin medidas registradas</p>}
          <Modal open={showMeasForm} onClose={() => setShowMeasForm(false)} title="Nueva medición">
            <MeasurementForm memberId={member.id} onSave={async (data) => {
              await createMeasurement({ ...data, member_id: member.id })
              const m = await getMeasurements(member.id)
              setMeasurements(m.data || [])
              setShowMeasForm(false)
            }} />
          </Modal>
        </div>
      )}

      {!loadingData && tab === 'photos' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(p => (
              <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square bg-gray-800">
                <img src={p.photo_url} alt="progreso" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-[10px] text-white">{formatDate(p.photo_date)}</p>
                  <p className="text-[10px] text-gray-300">{p.angle}</p>
                </div>
              </div>
            ))}
          </div>
          {photos.length === 0 && <p className="text-gray-500 text-sm">Sin fotos de progreso</p>}
        </div>
      )}
    </div>
  )
}

function EditMemberForm({ member, plans, onSave }) {
  const [form, setForm] = useState({
    status: member.status || 'active',
    plan_id: member.plan_id || '',
    start_date: member.start_date || today(),
    emergency_contact: member.emergency_contact || '',
    notes: member.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="label">Plan</label>
          <select className="input" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">Sin plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Fecha de inicio</label>
        <input type="date" className="input" value={form.start_date}
          onChange={e => setForm({ ...form, start_date: e.target.value })} />
      </div>
      <div>
        <label className="label">Contacto de emergencia</label>
        <input className="input" value={form.emergency_contact}
          placeholder="Nombre y teléfono"
          onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
      </div>
      <div>
        <label className="label">Notas internas</label>
        <textarea className="input" rows={2} value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : saved ? <><Check className="w-4 h-4" /> Guardado</> : 'Guardar cambios'}
      </button>
    </div>
  )
}

function MeasurementCard({ current, previous }) {
  return (
    <div className="card text-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-white">{formatDate(current.measured_at)}</p>
        {current.weight_kg && (
          <span className="badge-gray">{current.weight_kg} kg</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {measurementFields.filter(f => current[f.key]).map(f => {
          const diff = previous ? getMeasurementDiff(current, previous, f.key) : null
          return (
            <div key={f.key} className="bg-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="font-semibold text-white">{current[f.key]} {f.unit}</p>
              {diff !== null && (
                <p className={`text-xs flex items-center gap-0.5 ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} {f.unit}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MeasurementForm({ memberId, onSave }) {
  const [form, setForm] = useState({ measured_at: today() })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Fecha</label>
        <input type="date" className="input" value={form.measured_at}
          onChange={e => setForm({ ...form, measured_at: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {measurementFields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label} ({f.unit})</label>
            <input
              type="number" step="0.1" className="input"
              placeholder={`0.0 ${f.unit}`}
              value={form[f.key] || ''}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="input" rows={2} value={form.notes || ''}
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar medidas'}
      </button>
    </div>
  )
}

function CreateMemberModal({ open, onClose, plans }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
    plan_id: '', start_date: today(), birth_date: '',
    emergency_contact: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      setError('Nombre, email y contraseña son obligatorios')
      return
    }
    setLoading(true)
    setError('')

    // Primero registrar con auth.signUp
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, role: 'user' }
      }
    })

    if (authErr) { setError(authErr.message); setLoading(false); return }

    // Esperar un momento para que el trigger cree el perfil
    await new Promise(r => setTimeout(r, 1500))

    // Crear el miembro
    const { error: memErr } = await supabase.from('members').insert({
      profile_id: authData.user.id,
      plan_id: form.plan_id || null,
      start_date: form.start_date,
      emergency_contact: form.emergency_contact,
      notes: form.notes,
    })

    if (memErr) { setError(memErr.message); setLoading(false); return }

    // Actualizar perfil con datos extra
    await supabase.from('profiles').update({
      phone: form.phone,
      birth_date: form.birth_date || null
    }).eq('id', authData.user.id)

    setSuccess(true)
    setLoading(false)
    setTimeout(() => { setSuccess(false); setStep(1); setForm({ full_name: '', email: '', phone: '', password: '', plan_id: '', start_date: today(), birth_date: '', emergency_contact: '', notes: '' }); onClose() }, 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo miembro">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-white">¡Miembro creado con éxito!</p>
          <p className="text-sm text-gray-400 mt-1">Ya puede iniciar sesión con su correo y contraseña</p>
        </div>
      ) : (
        <div className="space-y-3">
          {step === 1 && (
            <>
              <div><label className="label">Nombre completo *</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Contraseña temporal *</label>
                <input type="text" className="input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              <div><label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Fecha de nacimiento</label>
                <input type="date" className="input" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
              <button className="btn-primary w-full" onClick={() => { if (!form.email || !form.full_name || !form.password) { setError('Campos obligatorios incompletos'); return } setError(''); setStep(2) }}>
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div><label className="label">Plan</label>
                <select className="input" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
                  <option value="">Sin plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>)}
                </select></div>
              <div><label className="label">Fecha de inicio</label>
                <input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">Contacto de emergencia</label>
                <input className="input" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} /></div>
              <div><label className="label">Notas internas</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Atrás</button>
                <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
                  {loading ? 'Creando...' : 'Crear miembro'}
                </button>
              </div>
            </>
          )}
          {step === 1 && error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

// ── ADMIN PAYMENTS ─────────────────────────────────────────
function AdminPayments({ payments, onRefresh, profile }) {
  const [filter, setFilter] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const filters = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'approved', label: 'Aprobados' },
    { id: 'rejected', label: 'Rechazados' },
  ]

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter)

  const handleApprove = async (payment) => {
    await updatePayment(payment.id, {
      status: 'approved',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    })
    await createNotification({
      profile_id: payment.member?.profile?.id,
      type: 'payment_approved',
      title: 'Pago aprobado ✅',
      message: `Tu pago de ${formatCurrency(payment.amount)} del ${formatDate(payment.due_date)} fue aprobado.`,
    })
    onRefresh()
  }

  const handleReject = async (payment) => {
    await updatePayment(payment.id, { status: 'rejected' })
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="section-title">Pagos</h2>
        <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4" /> Registrar pago
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button key={f.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${filter === f.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            onClick={() => setFilter(f.id)}
          >{f.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(p => {
          const st = approvalStatusLabel[p.status]
          const payStatus = getPaymentStatus(p.due_date)
          const dueLabel = paymentStatusLabel[payStatus]
          return (
            <div key={p.id} className="card-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-white truncate">{p.member?.profile?.full_name}</p>
                    <span className={st.cls}>{st.text}</span>
                    <span className={dueLabel.cls}>{dueLabel.text}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
                    <span>{formatCurrency(p.amount)}</span>
                    <span>Vence: {formatDate(p.due_date)}</span>
                    {p.payment_method === 'cash'
                      ? <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Efectivo</span>
                      : <span>{p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito'}</span>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.voucher_url && (
                    <a href={p.voucher_url} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="Ver voucher">
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  {p.status === 'pending' && (
                    <>
                      <button className="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center transition-all" onClick={() => handleApprove(p)} title="Aprobar">
                        <Check className="w-4 h-4" />
                      </button>
                      <button className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition-all" onClick={() => handleReject(p)} title="Rechazar">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button className="btn-ghost p-1.5" onClick={() => sendPaymentReminder(p, p.member)} title="Recordatorio WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No hay pagos en esta categoría
          </div>
        )}
      </div>

      <CreatePaymentModal open={showCreateForm} onClose={() => { setShowCreateForm(false); onRefresh() }} />
    </div>
  )
}

function CreatePaymentModal({ open, onClose }) {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member_id: '', amount: '', payment_method: 'cash', payment_date: today(), due_date: addDays(today(), 30), notes: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) getMembers().then(r => setMembers(r.data || []))
  }, [open])

  const handleCreate = async () => {
    if (!form.member_id || !form.amount) return
    setLoading(true)
    await createPayment({ ...form, status: 'approved' })
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago">
      <div className="space-y-3">
        <div>
          <label className="label">Miembro *</label>
          <select className="input" value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
            <option value="">Seleccionar miembro</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.profile?.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Monto (Q) *</label>
            <input type="number" step="0.01" className="input" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Método</label>
            <select className="input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="deposit">Depósito</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha de pago</label>
            <input type="date" className="input" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Fecha vencimiento</label>
            <input type="date" className="input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Notas</label>
          <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className="btn-primary w-full" onClick={handleCreate} disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar pago'}
        </button>
      </div>
    </Modal>
  )
}

// ── ADMIN PLANES ───────────────────────────────────────────
function AdminPlans({ plans, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_days: 30, features: '' })
  const [saving, setSaving] = useState(false)

  const openEdit = (plan) => {
    setEditing(plan)
    setForm({
      name: plan.name, description: plan.description || '',
      price: plan.price, duration_days: plan.duration_days,
      features: (plan.features || []).join(', ')
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = {
      name: form.name, description: form.description,
      price: Number(form.price), duration_days: Number(form.duration_days),
      features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : []
    }
    if (editing) await updatePlan(editing.id, payload)
    else await createPlan(payload)
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', description: '', price: '', duration_days: 30, features: '' })
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Planes</h2>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', duration_days: 30, features: '' }); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo plan
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.id} className="card-hover">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-white">{p.name}</h3>
              <div className="flex gap-1">
                <button className="btn-ghost p-1.5" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></button>
                <button className="btn-danger p-1.5" onClick={() => { deletePlan(p.id); onRefresh() }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <p className="text-2xl font-bold text-brand-400">{formatCurrency(p.price)}</p>
            <p className="text-xs text-gray-500">{p.duration_days} días</p>
            {p.description && <p className="text-sm text-gray-400 mt-2">{p.description}</p>}
            {p.features?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {p.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Sin planes creados
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar plan' : 'Nuevo plan'}>
        <div className="space-y-3">
          <div><label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label>
            <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Precio (Q) *</label>
              <input type="number" step="0.01" className="input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><label className="label">Duración (días)</label>
              <input type="number" className="input" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} /></div>
          </div>
          <div><label className="label">Beneficios (separados por coma)</label>
            <input className="input" placeholder="Acceso 24h, Clases grupales, Nutrición" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} /></div>
          <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Actualizar plan' : 'Crear plan'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── ADMIN REPORTS ──────────────────────────────────────────
function AdminReports({ members, payments }) {
  const [selectedMember, setSelectedMember] = useState('')

  const member = members.find(m => m.id === selectedMember)
  const memberPayments = payments.filter(p => p.member_id === selectedMember)

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="section-title">Reportes</h2>

      {/* Descarga global */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte global</h3>
        <p className="text-sm text-gray-400 mb-4">Descarga toda la información del gimnasio</p>
        <button className="btn-primary" onClick={() => generateMasterExcel(members, payments)}>
          <FileSpreadsheet className="w-4 h-4" /> Descargar Excel maestro
        </button>
      </div>

      {/* Por miembro */}
      <div className="card">
        <h3 className="font-semibold text-white mb-3">Reporte por miembro</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Seleccionar miembro</label>
            <select className="input" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.profile?.full_name}</option>)}
            </select>
          </div>
          {selectedMember && (
            <div className="flex flex-wrap gap-2 mt-2">
              <button className="btn-primary" onClick={() => generatePaymentHistoryPDF(memberPayments, member)}>
                <FileText className="w-4 h-4" /> PDF historial
              </button>
              <button className="btn-secondary" onClick={() => generatePaymentHistoryExcel(memberPayments, member)}>
                <FileSpreadsheet className="w-4 h-4" /> Excel historial
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// USER DASHBOARD
// ════════════════════════════════════════════════════════════
export function UserDashboard({ profile, onLogout }) {
  const [tab, setTab] = useState('home')
  const [member, setMember] = useState(null)
  const [payments, setPayments] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [attendance, setAttendance] = useState([])
  const [notifications, setNotifications] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [mem, pl, notifs] = await Promise.all([
      getMemberByProfile(profile.id),
      getPlans(),
      getNotifications(profile.id)
    ])
    const m = mem.data
    setMember(m)
    setPlans(pl.data || [])
    setNotifications(notifs.data || [])

    if (m?.id) {
      const [pay, meas, ph, att] = await Promise.all([
        getPayments(m.id),
        getMeasurements(m.id),
        getProgressPhotos(m.id),
        getAttendance(m.id)
      ])
      setPayments(pay.data || [])
      setMeasurements(meas.data || [])
      setPhotos(ph.data || [])
      setAttendance(att.data || [])
    }
    setLoading(false)
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  const unread = notifications.filter(n => !n.is_read).length

  const tabs = [
    { id: 'home',       label: 'Inicio',    icon: Home },
    { id: 'payments',   label: 'Pagos',     icon: CreditCard },
    { id: 'body',       label: 'Cuerpo',    icon: TrendingUp },
    { id: 'streak',     label: 'Racha',     icon: Calendar },
    { id: 'plans',      label: 'Planes',    icon: ClipboardList },
  ]

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand-500" />
            <span className="font-display text-xl tracking-wide text-white">
              {import.meta.env.VITE_GYM_NAME || 'GymApp'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative btn-ghost p-2" onClick={() => {
              setShowNotifs(!showNotifs)
              if (!showNotifs) markAllNotificationsRead(profile.id)
            }}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button className="btn-ghost p-2" onClick={onLogout}><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
        {showNotifs && (
          <div className="absolute right-4 top-14 w-72 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-80 overflow-y-auto">
            {notifications.length === 0 ? <p className="text-gray-500 text-sm">Sin notificaciones</p> :
              notifications.slice(0, 15).map(n => (
                <div key={n.id} className={`py-2.5 border-b border-gray-800 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-50'}`}>
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.message}</p>
                </div>
              ))
            }
          </div>
        )}
      </header>

      {/* BOTTOM NAV (mobile) / TOP NAV (desktop) */}
      <nav className="bg-gray-900/50 border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 py-1 overflow-x-auto no-scrollbar">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {loading ? <Spinner /> : (
          <>
            {tab === 'home'     && <UserHome member={member} payments={payments} profile={profile} />}
            {tab === 'payments' && <UserPayments payments={payments} member={member} onRefresh={loadData} />}
            {tab === 'body'     && <UserBody measurements={measurements} photos={photos} member={member} onRefresh={loadData} />}
            {tab === 'streak'   && <UserStreak attendance={attendance} member={member} onRefresh={loadData} />}
            {tab === 'plans'    && <UserPlans plans={plans} currentPlanId={member?.plan_id} />}
          </>
        )}
      </main>
    </div>
  )
}

// ── USER HOME ──────────────────────────────────────────────
function UserHome({ member, payments, profile }) {
  const lastPayment = payments[0]
  const payStatus = lastPayment ? getPaymentStatus(lastPayment.due_date) : null
  const stLabel = payStatus ? paymentStatusLabel[payStatus] : null

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="section-title">Hola, {profile.full_name.split(' ')[0]} 💪</h2>
        {member && <p className="text-gray-500 text-sm mt-1">Miembro desde {formatDate(member.start_date)}</p>}
      </div>

      {member && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Inicio</p>
            <p className="font-semibold text-white mt-1">{formatDate(member.start_date)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Plan actual</p>
            <p className="font-semibold text-white mt-1">{member.plan?.name || 'Sin plan'}</p>
          </div>
        </div>
      )}

      {lastPayment && (
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-400">Estado de cuota</p>
            <span className={stLabel.cls}>{stLabel.text}</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">{formatCurrency(lastPayment.amount)}</p>
          <p className="text-sm text-gray-500">Vence el {formatDate(lastPayment.due_date)}</p>
        </div>
      )}

      {!member && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Tu perfil de miembro aún no está configurado. Contacta al administrador.</p>
        </div>
      )}
    </div>
  )
}

// ── USER PAYMENTS ──────────────────────────────────────────
function UserPayments({ payments, member, onRefresh }) {
  const [showUpload, setShowUpload] = useState(null)

  const handleUploadVoucher = async (paymentId, file) => {
    if (!file || !member) return
    const { url, error } = await uploadVoucher(file, member.id)
    if (error) { alert('Error al subir el comprobante'); return }
    await updatePayment(paymentId, { voucher_url: url, status: 'pending', payment_date: today() })
    setShowUpload(null)
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Mis pagos</h2>
      <div className="space-y-3">
        {payments.map(p => {
          const st = approvalStatusLabel[p.status]
          const dueStatus = getPaymentStatus(p.due_date)
          const dueLabel = paymentStatusLabel[dueStatus]
          return (
            <div key={p.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{formatCurrency(p.amount)}</span>
                    <span className={st.cls}>{st.text}</span>
                    <span className={dueLabel.cls}>{dueLabel.text}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Vence: {formatDate(p.due_date)}</p>
                </div>
                {p.payment_method === 'cash'
                  ? <div className="flex items-center gap-1 text-emerald-400 text-xs"><Banknote className="w-4 h-4" /> Efectivo</div>
                  : <div className="text-xs text-gray-400">{p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito'}</div>
                }
              </div>

              {/* Comprobante */}
              {p.voucher_url && (
                <div className="rounded-xl overflow-hidden bg-gray-800">
                  <img src={p.voucher_url} alt="comprobante" className="w-full max-h-48 object-cover" />
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap gap-2">
                {p.status !== 'approved' && !p.voucher_url && p.payment_method !== 'cash' && (
                  <>
                    <label className="btn-secondary text-sm cursor-pointer">
                      <Camera className="w-3.5 h-3.5" /> Subir comprobante
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUploadVoucher(p.id, e.target.files[0])} />
                    </label>
                  </>
                )}
                {(p.voucher_url || p.payment_method === 'cash') && (
                  <button className="btn-ghost text-sm" onClick={() => sendVoucherToAdmin(p, member)}>
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                )}
                <button className="btn-ghost text-sm" onClick={() => generatePaymentPDF(p, member)}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          )
        })}
        {payments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Sin historial de pagos
          </div>
        )}
      </div>
    </div>
  )
}

// ── USER BODY (medidas + fotos) ───────────────────────────
function UserBody({ measurements, photos, member, onRefresh }) {
  const [tab, setTab] = useState('measures')
  const [uploading, setUploading] = useState(false)

  const latest = measurements[0]
  const prev = measurements[1]

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !member) return
    setUploading(true)
    const { url, error } = await uploadProgressPhoto(file, member.id)
    if (!error) {
      await createProgressPhoto({ member_id: member.id, photo_url: url, photo_date: today() })
      onRefresh()
    }
    setUploading(false)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Mi cuerpo</h2>
      <div className="flex gap-2">
        {['measures', 'photos'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-400 hover:text-white bg-gray-800'}`}>
            {t === 'measures' ? 'Medidas' : 'Fotos'}
          </button>
        ))}
      </div>

      {tab === 'measures' && (
        <div className="space-y-3">
          {latest ? (
            <>
              <div className="card">
                <p className="text-xs text-gray-500 mb-3">Última medición: {formatDate(latest.measured_at)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {measurementFields.filter(f => latest[f.key]).map(f => {
                    const diff = prev ? getMeasurementDiff(latest, prev, f.key) : null
                    return (
                      <div key={f.key} className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">{f.label}</p>
                        <p className="text-lg font-bold text-white">{latest[f.key]} <span className="text-xs text-gray-400">{f.unit}</span></p>
                        {diff !== null && (
                          <p className={`text-xs flex items-center gap-1 mt-0.5 ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)} {f.unit}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {measurements.slice(1).map(m => (
                <div key={m.id} className="card opacity-60">
                  <p className="text-xs text-gray-500 mb-1">{formatDate(m.measured_at)}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    {measurementFields.filter(f => m[f.key]).map(f => (
                      <span key={f.key}>{f.label}: {m[f.key]} {f.unit}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Sin medidas registradas aún
            </div>
          )}
        </div>
      )}

      {tab === 'photos' && (
        <div className="space-y-4">
          <label className={`btn-primary w-full cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Camera className="w-4 h-4" /> {uploading ? 'Subiendo...' : 'Subir foto de progreso'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            {photos.map(p => (
              <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square bg-gray-800">
                <img src={p.photo_url} alt="progreso" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 px-2 py-2">
                  <p className="text-xs text-white">{formatDate(p.photo_date)}</p>
                </div>
              </div>
            ))}
          </div>
          {photos.length === 0 && <p className="text-center text-gray-500 py-6">Sin fotos de progreso</p>}
        </div>
      )}
    </div>
  )
}

// ── USER STREAK ────────────────────────────────────────────
function UserStreak({ attendance, member, onRefresh }) {
  const [marking, setMarking] = useState(false)

  const streak = calculateStreak(attendance)
  const attended = new Set(attendance.map(a => a.attended_date))
  const todayStr = today()
  const markedToday = attended.has(todayStr)

  const handleToggleToday = async () => {
    if (!member) return
    setMarking(true)
    if (markedToday) await removeAttendance(member.id, todayStr)
    else await markAttendance(member.id, todayStr)
    onRefresh()
    setMarking(false)
  }

  // Generar los últimos 35 días para el calendario visual
  const calDays = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const str = d.toISOString().split('T')[0]
    const dow = d.getDay()
    calDays.push({ date: str, dow, attended: attended.has(str), isSunday: dow === 0 })
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="section-title">Mi racha</h2>

      {/* Streak counter */}
      <div className="card text-center py-6">
        <div className="text-6xl font-display tracking-wider text-brand-400">{streak}</div>
        <p className="text-gray-400 mt-1">días de racha activa 🔥</p>
        <p className="text-xs text-gray-600 mt-2">Los domingos no cuentan · Sábado es opcional</p>
      </div>

      {/* Marcar hoy */}
      <button
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95 ${markedToday ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'btn-primary'}`}
        onClick={handleToggleToday}
        disabled={marking}
      >
        {marking ? (
          <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : markedToday ? (
          <><CheckCircle className="w-5 h-5" /> Entrenamiento marcado hoy</>
        ) : (
          <><Dumbbell className="w-5 h-5" /> Marcar entrenamiento de hoy</>
        )}
      </button>

      {/* Calendario */}
      <div className="card">
        <p className="text-xs text-gray-500 mb-3">Últimos 35 días</p>
        <div className="grid grid-cols-7 gap-1">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
            <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
          ))}
          {calDays.map(d => (
            <div
              key={d.date}
              title={d.date}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all
                ${d.isSunday ? 'bg-gray-800/30 text-gray-700' :
                  d.attended ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30' :
                  d.date === todayStr ? 'border border-brand-500/50 text-brand-400' :
                  'bg-gray-800/30 text-gray-600'
                }`}
            >
              {new Date(d.date + 'T12:00:00').getDate()}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── USER PLANES ────────────────────────────────────────────
function UserPlans({ plans, currentPlanId }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Planes</h2>
      <div className="space-y-3">
        {plans.map(p => (
          <div key={p.id} className={`card-hover ${p.id === currentPlanId ? 'border-brand-500/40' : ''}`}>
            {p.id === currentPlanId && (
              <div className="badge-green mb-2 inline-flex">Tu plan actual</div>
            )}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{p.name}</h3>
                {p.description && <p className="text-sm text-gray-400 mt-0.5">{p.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-brand-400">{formatCurrency(p.price)}</p>
                <p className="text-xs text-gray-500">{p.duration_days} días</p>
              </div>
            </div>
            {p.features?.length > 0 && (
              <ul className="mt-3 space-y-1.5 pt-3 border-t border-gray-800">
                {p.features.map((f, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Sin planes disponibles
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  Users, CreditCard, Bell, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet,
  Dumbbell, TrendingUp, TrendingDown, Minus, Camera, Calendar,
  LogOut, Home, ClipboardList, MessageCircle, Eye,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle, Layers,
  Sun, Moon, User, Lock, Flame, Trophy, Star, Zap, Target
} from 'lucide-react'
import { playNotifSound, playAchievementSound } from '../App'
import {
  supabase, adminCreateUser, updateMember as updateMemberRecord,
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
  displayValue, getMeasurementComment, daysBetween,
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
export function AdminDashboard({ profile, onLogout, darkMode, onToggleTheme, onProfileUpdate }) {
  const [tab, setTab] = useState('overview')
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [plans, setPlans] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

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
          <div className="flex items-center gap-1">
            <button className="btn-ghost p-2" onClick={onToggleDark} title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="relative btn-ghost p-2" onClick={() => { setShowNotifs(p => !p); setShowProfile(false); if (!showNotifs) { markAllNotificationsRead(profile.id); if(unread > 0) playNotifSound() } }}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button className="btn-ghost p-1.5" onClick={() => { setShowProfile(p => !p); setShowNotifs(false) }} title="Mi perfil">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover ring-2 ring-brand-500/30" />
                : <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center"><span className="text-xs font-bold text-brand-400">{profile.full_name?.[0]?.toUpperCase()}</span></div>
              }
            </button>
          </div>
        </div>

        {/* Notificaciones dropdown */}
        {showNotifs && (
          <div className="absolute right-4 top-14 w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-300">Notificaciones</h4>
              <button onClick={() => { markAllNotificationsRead(profile.id); setShowNotifs(false) }} className="text-xs text-gray-500 hover:text-white">Marcar leídas</button>
            </div>
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

        {/* Perfil dropdown admin */}
        {showProfile && (
          <div className="absolute right-4 top-14 w-64 card border border-gray-700 shadow-2xl z-50 animate-slide-up">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-800">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center"><span className="font-bold text-brand-400">{profile.full_name?.[0]?.toUpperCase()}</span></div>
              }
              <div>
                <p className="font-semibold text-white text-sm">{profile.full_name}</p>
                <p className="text-xs text-gray-500">{profile.email}</p>
                <span className="text-[10px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full">Admin</span>
              </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 text-sm py-2 px-1 rounded-lg hover:bg-red-500/10 transition-all">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
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
            {tab === 'overview' && <AdminOverview members={members} payments={payments} onRefresh={loadData} profile={profile} onNavigate={(a) => { if(a==='refresh') loadData(); else setTab(a) }} />}
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
function AdminOverview({ members, payments, profile, onNavigate }) {
  const [filter, setFilter] = useState(null) // null | 'active' | 'pending' | 'overdue'

  const active = members.filter(m => m.status === 'active').length
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const overdueMembers = members.filter(m => {
    const mp = payments.filter(p => p.member_id === m.id && p.status !== 'rejected')
    // Sin pagos y ya pasó el mes de inicio → vencida
    if (!mp.length) {
      // Más de 30 días desde inicio sin pagos → vencido
      return m.start_date ? daysBetween(m.start_date, today()) > 30 : false
    }
    return getPaymentStatus(mp[0].due_date) === 'overdue'
  })
  const totalMonth = payments
    .filter(p => p.status === 'approved' && p.payment_date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((a, p) => a + Number(p.amount), 0)

  const stats = [
    { id: 'active',  label: 'Miembros activos',        value: active,                  icon: Users,         color: 'text-brand-400',   bg: 'bg-brand-500/10',   clickable: true },
    { id: 'pending', label: 'Pendientes de aprobación', value: pendingPayments.length,  icon: Clock,         color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  clickable: true },
    { id: 'overdue', label: 'Con cuota vencida',        value: overdueMembers.length,   icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10',     clickable: true },
    { id: 'income',  label: 'Ingresos este mes',        value: formatCurrency(totalMonth), icon: CreditCard,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', clickable: false },
  ]

  // Miembros filtrados según stat activo
  const filteredMembers = filter === 'active'  ? members.filter(m => m.status === 'active')
    : filter === 'overdue' ? overdueMembers
    : members

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title">Bienvenido, {profile.full_name.split(' ')[0]} 👋</h2>
        <p className="text-gray-500 text-sm mt-1">{formatDate(today())}</p>
      </div>

      {/* Stats interactivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <button
            key={s.id}
            onClick={() => s.clickable && setFilter(filter === s.id ? null : s.id)}
            className={`card text-left transition-all duration-200 ${s.clickable ? 'hover:border-gray-600 active:scale-95 cursor-pointer' : 'cursor-default'}
              ${filter === s.id ? 'border-brand-500/50 ring-1 ring-brand-500/30' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            {s.clickable && <div className="text-[10px] text-gray-600 mt-1">Toca para filtrar</div>}
          </button>
        ))}
      </div>

      {/* Pagos pendientes — clicables para aprobar */}
      {filter === 'pending' || pendingPayments.length > 0 ? (
        <div>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            Comprobantes pendientes ({pendingPayments.length})
          </h3>
          {pendingPayments.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin comprobantes pendientes</p>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map(p => (
                <div key={p.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{p.member?.profile?.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(p.amount)} · {p.notes || ''} · Vence {formatDate(p.due_date)}
                      </p>
                    </div>
                    <span className="badge-yellow flex-shrink-0">Pendiente</span>
                  </div>
                  {p.voucher_url && (
                    <div className="relative rounded-xl overflow-hidden bg-gray-800 group">
                      <img src={p.voucher_url} alt="comprobante" className="w-full max-h-40 object-cover" />
                      <a href={p.voucher_url} target="_blank" rel="noreferrer" download
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="w-3 h-3" /> Ver
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold py-2 rounded-xl transition-all text-sm"
                      onClick={async () => {
                        await updatePayment(p.id, { status: 'approved', approved_at: new Date().toISOString() })
                        await createNotification({ profile_id: p.member?.profile_id, type: 'payment_approved', title: 'Pago aprobado ✅', message: `Tu pago de ${formatCurrency(p.amount)} fue aprobado.` })
                        onNavigate('refresh')
                      }}>
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold py-2 rounded-xl transition-all text-sm"
                      onClick={async () => {
                        await updatePayment(p.id, { status: 'rejected' })
                        onNavigate('refresh')
                      }}>
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Lista de miembros filtrada */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-brand-500" />
          {filter === 'active' ? 'Miembros activos' : filter === 'overdue' ? 'Con cuota vencida' : 'Estado de cuotas'}
          {filter && <button onClick={() => setFilter(null)} className="ml-auto text-xs text-gray-500 hover:text-white">Ver todos</button>}
        </h3>
        <div className="space-y-2">
          {filteredMembers.map(m => {
            const mp = payments.filter(p => p.member_id === m.id && p.status !== 'rejected')
            const last = mp[0]
            // Sin pagos → "Sin pago" en rojo (no "Al día")
            const st = !last ? 'no_payment' : getPaymentStatus(last.due_date)
            const stLabel = paymentStatusLabel[st]
            return (
              <div key={m.id} className="card flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 ${stLabel.bg || 'bg-gray-800'} flex items-center justify-center`}>
                    <span className="text-xs font-bold text-white">{m.profile?.full_name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.profile?.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {last ? `Vence ${formatDate(last.due_date)}` : `Sin pagos · Desde ${formatDate(m.start_date)}`}
                    </p>
                  </div>
                </div>
                <span className={stLabel.cls}>{stLabel.text}</span>
              </div>
            )
          })}
          {filteredMembers.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin miembros en esta categoría</p>}
        </div>
      </div>
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
  // Recopilar comentarios de progreso
  const comments = []
  if (previous) {
    measurementFields.forEach(f => {
      const diff = getMeasurementDiff(current, previous, f.key)
      if (diff !== null && diff !== 0) {
        const comment = getMeasurementComment(f, diff)
        if (comment) comments.push(comment)
      }
    })
  }

  const weightLbs = current.weight_kg ? (current.weight_kg * 2.20462).toFixed(1) : null

  return (
    <div className="card text-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-white">{formatDate(current.measured_at)}</p>
        {weightLbs && <span className="badge-gray">{weightLbs} lbs</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {measurementFields.filter(f => current[f.key]).map(f => {
          const rawDiff = previous ? getMeasurementDiff(current, previous, f.key) : null
          const dispVal = displayValue(f, current[f.key])
          // Para mostrar el diff en la unidad correcta
          const diffDisplay = rawDiff !== null
            ? (f.convert ? (rawDiff * 2.20462).toFixed(1) : rawDiff.toFixed(1))
            : null

          // Color: depende del campo
          const isGoodUp   = ['left_arm_cm','right_arm_cm','left_leg_cm','right_leg_cm','chest_cm'].includes(f.key)
          const isGoodDown  = ['weight_kg','body_fat_pct','waist_cm','hips_cm'].includes(f.key)
          const diffColor = rawDiff === null || rawDiff === 0 ? 'text-gray-500'
            : isGoodDown  ? (rawDiff < 0 ? 'text-emerald-400' : 'text-red-400')
            : isGoodUp    ? (rawDiff > 0 ? 'text-emerald-400' : 'text-red-400')
            : 'text-gray-400'

          return (
            <div key={f.key} className="bg-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="font-semibold text-white">{dispVal} <span className="text-xs text-gray-400">{f.unit}</span></p>
              {diffDisplay !== null && rawDiff !== 0 && (
                <p className={`text-xs flex items-center gap-0.5 mt-0.5 ${diffColor}`}>
                  {rawDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Number(diffDisplay) > 0 ? '+' : ''}{diffDisplay} {f.unit}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Comentarios de progreso */}
      {comments.length > 0 && (
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-3 py-2.5 space-y-1">
          {comments.map((c, i) => (
            <p key={i} className="text-xs text-brand-300">{c}</p>
          ))}
        </div>
      )}

      {current.notes && (
        <p className="text-xs text-gray-500 italic">Nota: {current.notes}</p>
      )}
    </div>
  )
}

function MeasurementForm({ memberId, onSave }) {
  // El form guarda en lbs para peso — se convierte a kg al guardar en BD
  const [form, setForm]   = useState({ measured_at: today() })
  const [lbsInput, setLbsInput] = useState({}) // valores en lbs que el usuario escribe
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Convertir peso de lbs a kg antes de guardar
    const toSave = { ...form }
    if (lbsInput.weight_kg) {
      toSave.weight_kg = (parseFloat(lbsInput.weight_kg) / 2.20462).toFixed(2)
    }
    await onSave(toSave)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Fecha de medición</label>
        <input type="date" className="input" value={form.measured_at}
          onChange={e => setForm({ ...form, measured_at: e.target.value })} />
      </div>
      <p className="text-xs text-gray-500">Llena solo los campos que mediste. Deja vacío lo que no midió.</p>
      <div className="grid grid-cols-2 gap-3">
        {measurementFields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label} ({f.unit})</label>
            <input
              type="number" step="0.1" className="input"
              placeholder={`0.0 ${f.unit}`}
              value={f.key === 'weight_kg' ? (lbsInput.weight_kg || '') : (form[f.key] || '')}
              onChange={e => {
                if (f.key === 'weight_kg') {
                  setLbsInput({ ...lbsInput, weight_kg: e.target.value })
                } else {
                  setForm({ ...form, [f.key]: e.target.value })
                }
              }}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="label">Notas del entrenador</label>
        <textarea className="input" rows={2} value={form.notes || ''}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Observaciones del mes, recomendaciones..." />
      </div>
      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
        ) : 'Guardar medidas'}
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
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')

    // 1) Crear usuario con el cliente admin (NO afecta la sesión del admin actual)
    const { data: authData, error: authErr } = await adminCreateUser(
      form.email,
      form.password,
      form.full_name
    )

    if (authErr) {
      setError(
        authErr.message?.includes('already been registered') || authErr.message?.includes('already registered')
          ? 'Este email ya está registrado. Usa otro email.'
          : authErr.message || 'Error al crear el usuario'
      )
      setLoading(false)
      return
    }

    const userId = authData?.user?.id
    if (!userId) {
      setError('No se pudo crear el usuario. Verifica que VITE_SUPABASE_SERVICE_KEY esté configurada en Vercel.')
      setLoading(false)
      return
    }

    // 2) El trigger crea el perfil automáticamente, pero lo actualizamos con datos extra
    await new Promise(r => setTimeout(r, 800))
    await supabase.from('profiles').upsert({
      id: userId,
      email: form.email,
      full_name: form.full_name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      role: 'user'
    })

    // 3) Crear el registro de miembro
    const { error: memErr } = await supabase.from('members').insert({
      profile_id: userId,
      plan_id: form.plan_id || null,
      start_date: form.start_date,
      emergency_contact: form.emergency_contact || null,
      notes: form.notes || null,
    })

    if (memErr) {
      setError(memErr.message.includes('duplicate')
        ? 'Este usuario ya tiene un perfil de miembro.'
        : memErr.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setSuccess(false)
      setStep(1)
      setForm({ full_name: '', email: '', phone: '', password: '', plan_id: '', start_date: today(), birth_date: '', emergency_contact: '', notes: '' })
      onClose()
    }, 2000)
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
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      getMembers().then(r => setMembers(r.data || []))
      setSuccess(false)
      setForm({ member_id: '', amount: '', payment_method: 'cash', payment_date: today(), due_date: addDays(today(), 30), notes: '' })
    }
  }, [open])

  const handleMemberChange = (memberId) => {
    const m = members.find(x => x.id === memberId)
    const days = m?.plan?.duration_days || 30
    const price = m?.plan?.price || ''
    setForm(f => ({ ...f, member_id: memberId, amount: price, due_date: addDays(today(), days) }))
  }

  const handleCreate = async () => {
    if (!form.member_id || !form.amount) return
    setLoading(true)
    await createPayment({ ...form, status: 'approved' })
    setLoading(false)
    setSuccess(true)
    setTimeout(() => { setSuccess(false); onClose() }, 1500)
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-white">Pago registrado correctamente</p>
        </div>
      ) : (
      <div className="space-y-3">
        <div>
          <label className="label">Miembro *</label>
          <select className="input" value={form.member_id} onChange={e => handleMemberChange(e.target.value)}>
            <option value="">Seleccionar miembro</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.profile?.full_name}{m.plan ? `  — ${m.plan.name}` : ''}</option>)}
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
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Registrando...
            </span>
          ) : 'Registrar pago'}
        </button>
      </div>
      )}
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
export function UserDashboard({ profile, onLogout, darkMode, onToggleDark, onProfileUpdate }) {
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
  const [showAccount, setShowAccount] = useState(false)
  
  // useRef se mantiene para las notificaciones
  const prevNotifsCount = useRef(0)

  // Sonido de notificación
  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.frequency.setValueAtTime(880, ctx.currentTime)
      o.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      g.gain.setValueAtTime(0.3, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      o.start(ctx.currentTime)
      o.stop(ctx.currentTime + 0.4)
    } catch {}
  }

  // ... (el resto del código loadData, useEffects y el return continúan igual)
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

  // Sonar cuando llegan nuevas notificaciones
  const unread = notifications.filter(n => !n.is_read).length
  useEffect(() => {
    if (unread > prevNotifsCount.current) playNotifSound()
    prevNotifsCount.current = unread
  }, [unread])

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
          <div className="flex items-center gap-1">
            {/* Modo claro/oscuro */}
            <button className="btn-ghost p-2" onClick={onToggleDark} title={darkMode ? "Modo claro" : "Modo oscuro"}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Notificaciones */}
            <button className="relative btn-ghost p-2" onClick={() => {
              setShowNotifs(!showNotifs)
              setShowAccount(false)
              if (!showNotifs) markAllNotificationsRead(profile.id)
            }}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {/* Avatar / cuenta */}
            <button className="btn-ghost p-1" onClick={() => { setShowAccount(!showAccount); setShowNotifs(false) }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-brand-500/40" />
                : <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                    <span className="text-brand-400 text-sm font-bold">{profile.full_name?.[0]?.toUpperCase()}</span>
                  </div>
              }
            </button>
          </div>
        </div>
        {showNotifs && (
          <div className="absolute right-4 top-14 w-72 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-80 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 mb-2">Notificaciones</p>
            {notifications.length === 0 ? <p className="text-gray-500 text-sm">Sin notificaciones</p> :
              notifications.slice(0, 15).map(n => (
                <div key={n.id} className={`py-2.5 border-b border-gray-800 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-50'}`}>
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.message}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{formatDate(n.created_at)}</p>
                </div>
              ))
            }
          </div>
        )}
        {showAccount && (
          <UserAccountPanel
            profile={profile}
            member={member}
            onClose={() => setShowAccount(false)}
            onLogout={onLogout}
            onRefresh={loadData}
          />
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
            {tab === 'streak'   && <UserStreak attendance={attendance} member={member} onRefresh={loadData} profile={profile} />}
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
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [uploading, setUploading] = useState(null)

  const handleUploadVoucher = async (paymentId, file) => {
    if (!file || !member) return
    setUploading(paymentId)
    const { url, error } = await uploadVoucher(file, member.id)
    if (error) {
      alert('Error al subir el comprobante. Verifica tu conexión e intenta de nuevo.')
      setUploading(null)
      return
    }
    await updatePayment(paymentId, { voucher_url: url, status: 'pending', payment_date: today() })
    await createNotification({
      profile_id: member.profile_id,
      type: 'custom',
      title: 'Comprobante enviado al administrador',
      message: 'Tu comprobante fue enviado. El administrador lo revisará pronto.',
    })
    setUploading(null)
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Mis pagos</h2>
        <button className="btn-primary text-sm" onClick={() => setShowNewPayment(true)}>
          <Plus className="w-4 h-4" /> Registrar pago
        </button>
      </div>

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
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.notes && <span className="text-gray-400">{p.notes} · </span>}
                    Vence: {formatDate(p.due_date)}
                  </p>
                </div>
                {p.payment_method === 'cash'
                  ? <div className="flex items-center gap-1 text-emerald-400 text-xs"><Banknote className="w-4 h-4" /> Efectivo</div>
                  : <div className="text-xs text-gray-400">{p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito'}</div>
                }
              </div>

              {/* Comprobante imagen */}
              {p.voucher_url && (
                <div className="rounded-xl overflow-hidden bg-gray-800 relative group">
                  <img src={p.voucher_url} alt="comprobante" className="w-full max-h-56 object-cover" />
                  <a
                    href={p.voucher_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Download className="w-3 h-3" /> Ver/Descargar
                  </a>
                </div>
              )}

              {/* Estado aprobado */}
              {p.status === 'approved' && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-xl px-3 py-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Pago aprobado por el administrador
                </div>
              )}

              {/* Estado rechazado */}
              {p.status === 'rejected' && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Pago rechazado. Contacta al administrador.
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap gap-2">
                {/* Subir voucher si es transferencia/depósito y no ha sido aprobado */}
                {p.status === 'pending' && !p.voucher_url && p.payment_method !== 'cash' && (
                  <label className={`btn-secondary text-sm cursor-pointer ${uploading === p.id ? 'opacity-60 pointer-events-none' : ''}`}>
                    {uploading === p.id ? (
                      <><span className="w-3.5 h-3.5 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin" />Subiendo...</>
                    ) : (
                      <><Camera className="w-3.5 h-3.5" /> Subir comprobante</>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!uploading}
                      onChange={e => e.target.files?.[0] && handleUploadVoucher(p.id, e.target.files[0])} />
                  </label>
                )}
                {/* Enviar por WhatsApp al admin */}
                {(p.voucher_url || p.payment_method === 'cash') && p.status !== 'approved' && (
                  <button className="btn-ghost text-sm" onClick={() => sendVoucherToAdmin(p, member)}>
                    <MessageCircle className="w-3.5 h-3.5" /> Enviar al admin
                  </button>
                )}
                {/* Descargar PDF */}
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
            <p>Sin historial de pagos</p>
            <p className="text-xs mt-1">Registra tu primer pago con el botón de arriba</p>
          </div>
        )}
      </div>

      <NewPaymentModal
        open={showNewPayment}
        onClose={() => setShowNewPayment(false)}
        member={member}
        existingPayments={payments}
        onRefresh={onRefresh}
      />
    </div>
  )
}

// ── MODAL NUEVO PAGO (usuario) ─────────────────────────────
function NewPaymentModal({ open, onClose, member, existingPayments, onRefresh }) {
  const [method, setMethod]       = useState('transfer')
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [selectedMonths, setSelectedMonths] = useState([])
  const [yearOffset, setYearOffset] = useState(0) // 0 = año actual, 1 = próximo año

  const planPrice = member?.plan?.price || 0
  const planName  = member?.plan?.name  || 'Sin plan'

  // Generar los 12 meses del año seleccionado
  const currentYear = new Date().getFullYear() + yearOffset
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const d    = new Date(currentYear, i, 1)
    const key  = `${currentYear}-${String(i + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
    const due  = new Date(currentYear, i + 1, 0).toISOString().slice(0, 10)
    const isPaid = existingPayments.some(p =>
      p.due_date?.slice(0, 7) === key && p.status !== 'rejected'
    )
    return { key, label, due, isPaid }
  })

  const toggleMonth = (key) => {
    const month = allMonths.find(m => m.key === key)
    if (month?.isPaid) return // no deseleccionar meses ya pagados
    setSelectedMonths(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const totalAmount = selectedMonths.length * planPrice

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!selectedMonths.length) { alert('Selecciona al menos una cuota'); return }
    if (!file) { alert('Debes subir el comprobante de pago (foto del depósito o transferencia)'); return }
    if (!member) return

    setUploading(true)

    const { url, error } = await uploadVoucher(file, member.id)
    if (error) { alert('Error al subir el comprobante. Intenta de nuevo.'); setUploading(false); return }

    // Crear un pago por cada cuota seleccionada
    const months = [...selectedMonths].sort()
    for (const key of months) {
      const month = allMonths.find(m => m.key === key)
      await createPayment({
        member_id:      member.id,
        amount:         planPrice,
        payment_method: method,
        payment_date:   today(),
        due_date:       month.due,
        status:         'pending',
        voucher_url:    url,
        notes:          `Cuota ${month.label}`,
      })
    }

    setUploading(false)
    setSuccess(true)
  }

  const handleClose = () => {
    setMethod('transfer')
    setFile(null)
    setPreview(null)
    setSelectedMonths([])
    setSuccess(false)
    setYearOffset(0)
    onClose()
    onRefresh()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Registrar pago">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-white text-lg">¡Pago registrado!</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">
            El administrador revisará tu comprobante y aprobará el pago.
          </p>
          <button className="btn-primary w-full" onClick={() => {
            // Enviar WhatsApp al admin automáticamente
            const msg = `🏋️ *${import.meta.env.VITE_GYM_NAME || 'GymApp'}*
📋 *Nuevo pago registrado*

👤 *${member?.profile?.full_name}*
💰 *${formatCurrency(totalAmount)}*
📅 Cuotas: ${selectedMonths.map(k => allMonths.find(m => m.key === k)?.label).join(', ')}

Por favor revisar y aprobar ✅`
            const num = (import.meta.env.VITE_GYM_WHATSAPP || '').replace(/[^0-9]/g,'')
            window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
            handleClose()
          }}>
            <MessageCircle className="w-4 h-4" /> Notificar al administrador por WhatsApp
          </button>
          <button className="btn-ghost w-full mt-2" onClick={handleClose}>
            Cerrar sin notificar
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Plan info */}
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400">Tu plan</p>
            <p className="font-semibold text-white">{planName} — {formatCurrency(planPrice)}/mes</p>
          </div>

          {/* Selector de año */}
          <div className="flex items-center justify-between">
            <label className="label mb-0">¿Qué cuotas deseas pagar?</label>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-1 py-0.5">
              <button
                onClick={() => { setYearOffset(0); setSelectedMonths([]) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${yearOffset === 0 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >{new Date().getFullYear()}</button>
              <button
                onClick={() => { setYearOffset(1); setSelectedMonths([]) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${yearOffset === 1 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >{new Date().getFullYear() + 1}</button>
            </div>
          </div>

          {/* Grid de 12 meses */}
          <div className="grid grid-cols-2 gap-2">
            {allMonths.map(m => {
              const isSelected = selectedMonths.includes(m.key)
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMonth(m.key)}
                  disabled={m.isPaid}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all
                    ${m.isPaid
                      ? 'bg-emerald-500/5 border-emerald-500/20 cursor-not-allowed opacity-60'
                      : isSelected
                        ? 'bg-brand-500/10 border-brand-500/40'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'}`}
                >
                  <div>
                    <p className={`text-xs font-semibold capitalize ${m.isPaid ? 'text-emerald-400' : isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {m.label.split(' ')[0]}
                    </p>
                    {m.isPaid
                      ? <p className="text-[10px] text-emerald-500">Pagado</p>
                      : <p className="text-[10px] text-brand-400">{formatCurrency(planPrice)}</p>
                    }
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${m.isPaid ? 'border-emerald-500 bg-emerald-500' : isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-600'}`}>
                    {(m.isPaid || isSelected) && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Total */}
          {selectedMonths.length > 0 && (
            <div className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">Total a pagar</p>
                <p className="text-xs text-gray-400">{selectedMonths.length} cuota{selectedMonths.length > 1 ? 's' : ''}</p>
              </div>
              <span className="text-2xl font-bold text-brand-400">{formatCurrency(totalAmount)}</span>
            </div>
          )}

          {/* Método */}
          <div>
            <label className="label">Método de pago</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'transfer', label: 'Transferencia', icon: '🏦' },
                { id: 'deposit',  label: 'Depósito',      icon: '🏧' },
              ].map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${method === m.id ? 'bg-brand-500/10 border-brand-500/40 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                  <span>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comprobante */}
          <div>
            <label className="label">Foto del comprobante *</label>
            {preview ? (
              <div className="relative rounded-xl overflow-hidden bg-gray-800">
                <img src={preview} alt="preview" className="w-full max-h-48 object-cover" />
                <button onClick={() => { setFile(null); setPreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-lg p-1.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 bg-gray-800/50 border-2 border-dashed border-gray-700 hover:border-brand-500/50 rounded-xl py-8 cursor-pointer transition-colors">
                <Camera className="w-8 h-8 text-gray-500" />
                <span className="text-sm text-gray-400">Foto del depósito o transferencia</span>
                <span className="text-xs text-gray-600">Toca para abrir la cámara o galería</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <button className="btn-primary w-full" onClick={handleSubmit}
            disabled={uploading || !selectedMonths.length || !file}>
            {uploading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Subiendo comprobante...</>
              : <><CreditCard className="w-4 h-4" />Enviar pago al administrador</>
            }
          </button>
        </div>
      )}
    </Modal>
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
              <div className="card space-y-3">
                <p className="text-xs text-gray-500">Última medición: {formatDate(latest.measured_at)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {measurementFields.filter(f => latest[f.key]).map(f => {
                    const rawDiff = prev ? getMeasurementDiff(latest, prev, f.key) : null
                    const dispVal = displayValue(f, latest[f.key])
                    const diffDisplay = rawDiff !== null
                      ? (f.convert ? (rawDiff * 2.20462).toFixed(1) : rawDiff.toFixed(1))
                      : null
                    const isGoodUp  = ['left_arm_cm','right_arm_cm','left_leg_cm','right_leg_cm','chest_cm'].includes(f.key)
                    const isGoodDown = ['weight_kg','body_fat_pct','waist_cm','hips_cm'].includes(f.key)
                    const diffColor = rawDiff === null || rawDiff === 0 ? 'text-gray-500'
                      : isGoodDown ? (rawDiff < 0 ? 'text-emerald-400' : 'text-red-400')
                      : isGoodUp   ? (rawDiff > 0 ? 'text-emerald-400' : 'text-red-400')
                      : 'text-gray-400'
                    return (
                      <div key={f.key} className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">{f.label}</p>
                        <p className="text-lg font-bold text-white">
                          {dispVal} <span className="text-xs text-gray-400">{f.unit}</span>
                        </p>
                        {diffDisplay !== null && rawDiff !== 0 && (
                          <p className={`text-xs flex items-center gap-0.5 mt-0.5 ${diffColor}`}>
                            {rawDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Number(diffDisplay) > 0 ? '+' : ''}{diffDisplay} {f.unit}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Comentarios de progreso para el usuario */}
                {prev && (() => {
                  const comments = []
                  measurementFields.forEach(f => {
                    const diff = getMeasurementDiff(latest, prev, f.key)
                    if (diff !== null && diff !== 0) {
                      const c = getMeasurementComment(f, diff)
                      if (c) comments.push(c)
                    }
                  })
                  return comments.length > 0 ? (
                    <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-3 py-2.5 space-y-1">
                      {comments.map((c, i) => <p key={i} className="text-xs text-brand-300">{c}</p>)}
                    </div>
                  ) : null
                })()}
              </div>
              {measurements.slice(1).map(m => (
                <div key={m.id} className="card opacity-60">
                  <p className="text-xs text-gray-500 mb-1">{formatDate(m.measured_at)}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    {measurementFields.filter(f => m[f.key]).map(f => (
                      <span key={f.key}>{f.label}: {displayValue(f, m[f.key])} {f.unit}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Sin medidas registradas</p>
              <p className="text-xs mt-1">El administrador las registrará en tu próxima visita</p>
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

// ── LOGROS / ACHIEVEMENTS ─────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'week1',    days: 5,   icon: '⚡', title: 'Chispa',      subtitle: '¡Primera semana completada!',    color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30' },
  { id: 'week2',    days: 10,  icon: '🔥', title: 'En llamas',   subtitle: '¡Dos semanas sin parar!',        color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  { id: 'week3',    days: 15,  icon: '💪', title: 'Guerrero',    subtitle: '¡Tres semanas de hierro!',       color: 'text-brand-400',   bg: 'bg-brand-500/10',   border: 'border-brand-500/30' },
  { id: 'month1',   days: 21,  icon: '🏆', title: 'Iron Man',    subtitle: '¡Un mes entero de racha!',       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  { id: 'month2',   days: 42,  icon: '👑', title: 'Leyenda',     subtitle: '¡Dos meses sin rendirse!',       color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
  { id: 'month3',   days: 63,  icon: '🌟', title: 'Élite',       subtitle: '¡Tres meses de dedicación!',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30' },
  { id: 'month6',   days: 126, icon: '💎', title: 'Diamante',    subtitle: '¡Seis meses de superación!',     color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30' },
]

const MOTIVATIONAL = [
  { min: 0,   text: '¡Inicia tu racha hoy! Cada campeón empezó desde cero.', emoji: '🚀' },
  { min: 1,   text: '¡Buen comienzo! El primer paso es el más importante.', emoji: '👣' },
  { min: 3,   text: '¡Buen ritmo! Ya estás formando el hábito.', emoji: '💫' },
  { min: 5,   text: '¡Una semana! Estás en fuego. ¡No pares!', emoji: '🔥' },
  { min: 10,  text: '¡Imparable! Dos semanas de consistencia pura.', emoji: '⚡' },
  { min: 15,  text: '¡Tres semanas! Ya eres un guerrero del gimnasio.', emoji: '💪' },
  { min: 21,  text: '¡UN MES! ¡Eres una leyenda viviente!', emoji: '🏆' },
  { min: 42,  text: '¡DOS MESES! Pocos llegan hasta aquí. ¡Eres élite!', emoji: '👑' },
  { min: 63,  text: '¡TRES MESES! Eres la inspiración del gimnasio.', emoji: '🌟' },
]

function getMotivational(streak) {
  const msgs = [...MOTIVATIONAL].reverse()
  return msgs.find(m => streak >= m.min) || MOTIVATIONAL[0]
}

// ── USER STREAK ────────────────────────────────────────────
function UserStreak({ attendance, member, onRefresh, profile }) {
  const [marking, setMarking] = useState(false)
  const [celebrated, setCelebrated] = useState(false)

  const streak = calculateStreak(attendance)
  const bestStreak = member?.best_streak || 0
  const attended = new Set(attendance.map(a => a.attended_date))
  const todayStr = today()
  const markedToday = attended.has(todayStr)
  const motivational = getMotivational(streak)

  // Logros desbloqueados
  const unlocked = ACHIEVEMENTS.filter(a => streak >= a.days)
  const nextAchievement = ACHIEVEMENTS.find(a => streak < a.days)

  const handleToggleToday = async () => {
    if (!member) return
    setMarking(true)

    if (markedToday) {
      await removeAttendance(member.id, todayStr)
    } else {
      await markAttendance(member.id, todayStr)
      const newStreak = streak + 1

      // Actualizar best_streak si se superó
      if (newStreak > bestStreak) {
        await supabase.from('members').update({ best_streak: newStreak }).eq('id', member.id)
      }

      // Verificar si se desbloqueó un logro
      const newAchievement = ACHIEVEMENTS.find(a => newStreak === a.days)
      if (newAchievement) {
        setCelebrated(true)
        playAchievementSound()
        setTimeout(() => setCelebrated(false), 4000)
        await createNotification({
          profile_id: profile.id,
          type: 'custom',
          title: `Logro desbloqueado: ${newAchievement.icon} ${newAchievement.title}`,
          message: `${newAchievement.subtitle} Llevas ${newAchievement.days} días de racha activa.`,
        })
      }
    }

    onRefresh()
    setMarking(false)
  }

  // Calendario 35 días con código de colores
  const calDays = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const str = d.toISOString().split('T')[0]
    const dow = d.getDay() // 0=dom, 6=sab
    const isSunday   = dow === 0
    const isSaturday = dow === 6
    const isToday    = str === todayStr
    const isFuture   = str > todayStr
    const didAttend  = attended.has(str)
    // Día fallado: semana, pasado, no asistió, no domingo
    const isMissed   = !isSunday && !isSaturday && !isToday && !isFuture && !didAttend

    calDays.push({ date: str, dow, didAttend, isSunday, isSaturday, isToday, isMissed })
  }

  // Alinear el primer día al lunes
  const firstDow = calDays[0].dow // 0=dom
  const offset = firstDow === 0 ? 6 : firstDow - 1 // L=0,M=1,...,D=6
  const emptyBefore = Array(offset).fill(null)

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Mi racha</h2>

      {/* Celebración logro */}
      {celebrated && (
        <div className="card border-amber-500/40 bg-amber-500/5 text-center py-4 animate-slide-up">
          <div className="text-3xl mb-1">{unlocked[unlocked.length-1]?.icon}</div>
          <p className="font-bold text-amber-400">¡Logro desbloqueado!</p>
          <p className="text-sm text-gray-400 mt-1">{unlocked[unlocked.length-1]?.subtitle}</p>
        </div>
      )}

      {/* Contador principal */}
      <div className="card text-center py-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5">
          <Flame className="w-48 h-48 text-brand-500" />
        </div>
        <div className="relative">
          <div className="text-7xl font-display tracking-wider text-brand-400 leading-none">{streak}</div>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Flame className="w-4 h-4 text-brand-500" />
            <p className="text-gray-300 font-medium">días de racha</p>
          </div>
          <p className="text-sm mt-2">{motivational.emoji} <span className="text-gray-400">{motivational.text}</span></p>
          {bestStreak > 0 && (
            <p className="text-xs text-gray-600 mt-2 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3" /> Mejor racha histórica: <span className="text-gray-400 font-semibold">{bestStreak} días</span>
            </p>
          )}
          {nextAchievement && (
            <p className="text-xs text-gray-600 mt-1">
              Próximo logro: <span className="text-brand-400">{nextAchievement.icon} {nextAchievement.title}</span> en {nextAchievement.days - streak} días
            </p>
          )}
        </div>
      </div>

      {/* Botón marcar */}
      <button
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition-all active:scale-95
          ${markedToday ? 'bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400' : 'btn-primary'}`}
        onClick={handleToggleToday}
        disabled={marking}
      >
        {marking
          ? <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          : markedToday
            ? <><CheckCircle className="w-5 h-5" /> ✅ Entrenamiento completado hoy</>
            : <><Dumbbell className="w-5 h-5" /> Marcar entrenamiento de hoy</>
        }
      </button>

      {/* Calendario visual */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 font-medium">Últimos 35 días</p>
          <div className="flex items-center gap-3 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-brand-500 inline-block" /> Asistí</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-900/60 inline-block" /> Fallé</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-800/50 inline-block" /> Libre</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="text-center text-[10px] text-gray-600 font-medium py-1">{d}</div>
          ))}
          {emptyBefore.map((_, i) => <div key={`e${i}`} />)}
          {calDays.map(d => {
            let cls = 'bg-gray-800/20 text-gray-700'
            if (d.isSunday)      cls = 'bg-gray-800/10 text-gray-800 opacity-50'
            else if (d.isSaturday && !d.didAttend) cls = 'bg-gray-800/20 text-gray-700 border border-dashed border-gray-700'
            else if (d.didAttend) cls = 'bg-brand-500 text-white shadow shadow-brand-500/40 font-bold'
            else if (d.isMissed)  cls = 'bg-red-950/60 text-red-700'
            else if (d.isToday)   cls = 'border-2 border-brand-500 text-brand-400 font-bold animate-pulse-slow'

            return (
              <div key={d.date} title={d.date}
                className={`aspect-square rounded-md flex items-center justify-center text-[10px] transition-all ${cls}`}>
                {new Date(d.date + 'T12:00:00').getDate()}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-700 mt-2 text-center">Domingos no cuentan · Sábados son opcionales</p>
      </div>

      {/* Logros */}
      <div>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Logros
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a => {
            const done = streak >= a.days
            return (
              <div key={a.id} className={`rounded-xl border px-3 py-3 transition-all ${done ? `${a.bg} ${a.border}` : 'bg-gray-800/20 border-gray-800 opacity-40'}`}>
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className={`text-sm font-bold ${done ? a.color : 'text-gray-500'}`}>{a.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{a.subtitle}</p>
                <p className={`text-[10px] mt-1 font-medium ${done ? a.color : 'text-gray-600'}`}>
                  {done ? '✓ Desbloqueado' : `${a.days} días`}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ── USER ACCOUNT PANEL ─────────────────────────────────────
function UserAccountPanel({ profile, member, onClose, onLogout, onRefresh }) {
  const [tab, setTab]           = useState('profile')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [uploading, setUploading] = useState(false)

  const age = profile.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date)) / (365.25 * 24 * 3600 * 1000))
    : null

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { setMsg('Mínimo 6 caracteres'); return }
    if (newPassword !== confirmPass) { setMsg('Las contraseñas no coinciden'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✅ Contraseña actualizada'); setNewPassword(''); setConfirmPass('') }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      onRefresh()
    }
    setUploading(false)
  }

  return (
    <div className="absolute right-4 top-14 w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up">
      {/* Header cuenta */}
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-800">
        <div className="relative">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-brand-500/40" />
            : <div className="w-12 h-12 rounded-full bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center">
                <span className="text-brand-400 text-lg font-bold">{profile.full_name?.[0]?.toUpperCase()}</span>
              </div>
          }
          <label className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors">
            <Camera className="w-2.5 h-2.5 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
          </label>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{profile.full_name}</p>
          <p className="text-xs text-gray-500 truncate">{profile.email}</p>
          {age && <p className="text-xs text-gray-600">{age} años</p>}
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3">
        {[{id:'profile',label:'Mi ficha'},{id:'password',label:'Contraseña'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all
              ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-500 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-2 text-sm">
          {[
            { label: 'Nombre',       value: profile.full_name },
            { label: 'Email',        value: profile.email },
            { label: 'Teléfono',     value: profile.phone || '—' },
            { label: 'Edad',         value: age ? `${age} años` : '—' },
            { label: 'Plan',         value: member?.plan?.name || '—' },
            { label: 'Miembro desde',value: formatDate(member?.start_date) },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-gray-800/50">
              <span className="text-gray-500">{r.label}</span>
              <span className="text-white font-medium">{r.value}</span>
            </div>
          ))}
          <button onClick={() => { onClose(); onLogout() }} className="btn-danger w-full mt-3 text-sm">
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      )}

      {tab === 'password' && (
        <div className="space-y-3">
          <div>
            <label className="label">Nueva contraseña</label>
            <input type="password" className="input text-sm" placeholder="Mínimo 6 caracteres"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirmar contraseña</label>
            <input type="password" className="input text-sm" placeholder="Repite la contraseña"
              value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
          </div>
          {msg && <p className={`text-xs ${msg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
          <button className="btn-primary w-full text-sm" onClick={handleChangePassword} disabled={saving}>
            {saving ? 'Guardando...' : <><Lock className="w-3.5 h-3.5" /> Cambiar contraseña</>}
          </button>
        </div>
      )}
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

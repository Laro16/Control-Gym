import { useState } from 'react'
import {
  Users, CreditCard, Check, X, Download,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle,
  TrendingUp, TrendingDown, MessageCircle,
  ChevronDown, ChevronUp, Phone, Calendar, Layers
} from 'lucide-react'
import {
  supabase, adminCreateUser,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement,
  updateMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, getMemberPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  displayValue, getMeasurementComment, daysBetween,
  generatePaymentPDF, generatePaymentHistoryPDF, generatePaymentHistoryExcel,
  generateMasterExcel, today, addDays, calculateStreak
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner } from './shared'

// ── OVERVIEW ───────────────────────────────────────────────
export function AdminOverview({ members, payments, profile, onNavigate }) {
  const [filter, setFilter] = useState(null) // null | 'active' | 'pending' | 'overdue'

  const active = members.filter(m => m.status === 'active').length
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const overdueMembers = members.filter(m => getMemberPaymentStatus(m, payments) === 'overdue')
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

      {/* Lista de miembros filtrada — expandible */}
      <MemberStatusList members={filteredMembers} payments={payments} filter={filter} setFilter={setFilter} />
    </div>
  )
}

// ── LISTA EXPANDIBLE DE MIEMBROS ───────────────────────────
function MemberStatusList({ members, payments, filter, setFilter }) {
  const [expanded, setExpanded] = useState(null)

  const toggle = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div>
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-brand-500" />
        {filter === 'active' ? 'Miembros activos'
          : filter === 'overdue' ? 'Con cuota vencida'
          : filter === 'pending' ? 'Pendientes'
          : 'Estado de cuotas'}
        <span className="text-xs text-gray-600 font-normal">({members.length})</span>
        {filter && (
          <button onClick={() => setFilter(null)} className="ml-auto text-xs text-gray-500 hover:text-white">
            Ver todos
          </button>
        )}
      </h3>

      <div className="space-y-2">
        {members.map(m => {
          const memberPayments = payments.filter(p => p.member_id === m.id && p.status !== 'rejected')
          const lastPayment    = memberPayments[0]
          const approvedPays  = memberPayments.filter(p => p.status === 'approved')
          const st             = getMemberPaymentStatus(m, payments)
          const stLabel        = paymentStatusLabel[st]
          const isOpen         = expanded === m.id

          return (
            <div key={m.id} className={`card transition-all duration-200 ${isOpen ? 'border-gray-700' : ''}`}>

              {/* ── FILA PRINCIPAL (siempre visible) ── */}
              <button
                className="w-full flex items-center gap-3"
                onClick={() => toggle(m.id)}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex-shrink-0 ${stLabel?.bg || 'bg-gray-800'} flex items-center justify-center`}>
                  {m.profile?.avatar_url
                    ? <img src={m.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <span className="text-xs font-bold text-white">{m.profile?.full_name?.[0]?.toUpperCase()}</span>
                  }
                </div>

                {/* Nombre y subtítulo */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white truncate">{m.profile?.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {lastPayment
                      ? `Vence ${formatDate(lastPayment.due_date)}`
                      : `Sin pagos · Desde ${formatDate(m.start_date)}`
                    }
                  </p>
                </div>

                {/* Badge estado */}
                <span className={`${stLabel?.cls} flex-shrink-0`}>{stLabel?.text}</span>

                {/* Chevron */}
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                }
              </button>

              {/* ── DETALLE EXPANDIDO ── */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-fade-in">

                  {/* Datos personales */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Calendar, label: 'Miembro desde', value: formatDate(m.start_date) },
                      { icon: Layers,   label: 'Plan',          value: m.plan?.name || '—' },
                      { icon: Phone,    label: 'Teléfono',      value: m.profile?.phone || '—' },
                      { icon: Calendar, label: 'Vencimiento',   value: lastPayment ? formatDate(lastPayment.due_date) : '—' },
                    ].map(r => (
                      <div key={r.label} className="bg-gray-800/40 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <r.icon className="w-3 h-3 text-gray-500" />
                          <p className="text-[10px] text-gray-500">{r.label}</p>
                        </div>
                        <p className="text-xs font-semibold text-white truncate">{r.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Historial de pagos */}
                  {memberPayments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Últimos pagos
                      </p>
                      <div className="space-y-1.5">
                        {memberPayments.slice(0, 4).map(p => {
                          const pStatus = approvalStatusLabel?.[p.status]
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  p.status === 'approved' ? 'bg-emerald-400'
                                  : p.status === 'pending' ? 'bg-yellow-400'
                                  : 'bg-red-400'
                                }`} />
                                <span className="text-gray-400">{p.notes || formatDate(p.due_date)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300 font-medium">{formatCurrency(p.amount)}</span>
                                <span className={pStatus?.cls || 'badge-gray'}>{pStatus?.text}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Acciones rápidas */}
                  <div className="flex gap-2 pt-1">
                    {m.profile?.phone && (
                      <a
                        href={`https://wa.me/${m.profile.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {(st === 'overdue' || st === 'due_soon') && (
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-500/10 text-brand-400 text-xs font-medium hover:bg-brand-500/20 transition-all"
                        onClick={() => {
                          const msg = `Hola ${m.profile?.full_name?.split(' ')[0]}, te recordamos que tu cuota ${st === 'overdue' ? 'está vencida' : 'vence pronto'}. Por favor realiza tu pago. ¡Gracias! 🏋️`
                          const num = (m.profile?.phone || '').replace(/[^0-9]/g, '')
                          if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
                          else alert('Este miembro no tiene teléfono registrado')
                        }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Recordatorio
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          )
        })}

        {members.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-6">Sin miembros en esta categoría</p>
        )}
      </div>
    </div>
  )
}

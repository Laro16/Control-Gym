import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, CreditCard, Bell, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet,
  Dumbbell, TrendingUp, TrendingDown, Minus, Camera, Calendar,
  LogOut, Home, ClipboardList, MessageCircle, Eye,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle, Layers,
  Sun, Moon, Lock, Flame, Trophy, Star
} from 'lucide-react'
import { playNotifSound, playAchievementSound } from '../App'
import {
  supabase, adminCreateUser,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement,
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
import { Modal, ConfirmModal, Spinner } from './shared'

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

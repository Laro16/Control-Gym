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
  reviewPayment, registerAdminPayment, createMeasurement,
  updateMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  displayValue, getMeasurementComment, daysBetween,
  today, addDays, calculateStreak, generateReceiptImage,
  getLastRegisteredDueDate
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner, EmptyState, toast } from './shared'

// ── ADMIN PAYMENTS ─────────────────────────────────────────
export function AdminPayments({ payments, onRefresh, gym }) {
  const [filter, setFilter] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [processing, setProcessing] = useState(null)

  const filters = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'approved', label: 'Aprobados' },
    { id: 'rejected', label: 'Rechazados' },
  ]

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter)

  const handleReview = async (payment, status) => {
    if (processing) return
    setProcessing(payment.id)
    try {
      const { error } = await reviewPayment(payment.id, status)
      if (error) throw error
      toast.success(status === 'approved' ? 'Pago aprobado correctamente' : 'Pago rechazado')
      await onRefresh()
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el pago')
    } finally {
      setProcessing(null)
    }
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
                <div className="flex items-center justify-end gap-1.5 flex-wrap flex-shrink-0">
                  {p.voucher_url && (
                    <a href={p.voucher_url} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="Ver voucher">
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  {p.status === 'pending' && (
                    <>
                      <button disabled={processing === p.id} className="w-8 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center transition-all disabled:opacity-50" onClick={() => handleReview(p, 'approved')} title="Aprobar">
                        <Check className="w-4 h-4" />
                      </button>
                      <button disabled={processing === p.id} className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition-all disabled:opacity-50" onClick={() => handleReview(p, 'rejected')} title="Rechazar">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {p.status === 'approved' && (
                    <button
                      className="w-8 h-8 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg flex items-center justify-center transition-all"
                      onClick={() => generateReceiptImage(p, p.member, gym?.name || import.meta.env.VITE_GYM_NAME || 'GYM')}
                      title="Descargar recibo"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button className="btn-ghost p-1.5" onClick={() => sendPaymentReminder(p, p.member, gym)} title="Recordatorio WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="No hay pagos en esta categoría"
            subtitle="Cuando tus miembros registren pagos o tú los agregues, aparecerán aquí para su revisión"
          />
        )}
      </div>

      <CreatePaymentModal
        open={showCreateForm}
        payments={payments}
        onClose={() => { setShowCreateForm(false); onRefresh() }}
      />
    </div>
  )
}

function CreatePaymentModal({ open, onClose, payments }) {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member_id: '', amount: '', payment_method: 'cash', payment_date: today(), due_date: addDays(today(), 30), notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      getMembers().then(r => {
        setMembers(r.data || [])
        if (r.error) toast.error(r.error.message || 'No se pudieron cargar los miembros')
      })
      setSuccess(false)
      setForm({ member_id: '', amount: '', payment_method: 'cash', payment_date: today(), due_date: addDays(today(), 30), notes: '' })
    }
  }, [open])

  const handleMemberChange = (memberId) => {
    const m = members.find(x => x.id === memberId)
    const days = m?.plan?.duration_days || 30
    const price = m?.plan?.price || ''
    const lastDue = getLastRegisteredDueDate(memberId, payments)
    const anchor = lastDue || m?.start_date || today()
    setForm(f => ({ ...f, member_id: memberId, amount: price, due_date: addDays(anchor, days) }))
  }

  const handleCreate = async () => {
    if (!form.member_id || !form.amount || Number(form.amount) <= 0) {
      toast.info('Selecciona un miembro y escribe un monto válido')
      return
    }
    setLoading(true)
    try {
      const { error } = await registerAdminPayment(form)
      if (error) throw error
      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose() }, 1200)
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar el pago')
    } finally {
      setLoading(false)
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha de pago</label>
            <input type="date" className="input" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Próximo vencimiento</label>
            <input type="date" className="input opacity-75" value={form.due_date} readOnly />
            <p className="text-[10px] text-gray-600 mt-1">Se calcula según el último ciclo y el plan.</p>
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

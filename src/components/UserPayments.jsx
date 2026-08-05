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
  createMeasurement,
  updateMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto,
  attachPaymentVoucher, submitMemberPayments
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  displayValue, getMeasurementComment, daysBetween,
  generatePaymentPDF, generatePaymentHistoryPDF, generatePaymentHistoryExcel,
  generateMasterExcel, today, addDays, calculateStreak, generateReceiptImage,
  toLocalDateStr, getLastRegisteredDueDate, buildPaymentCycleDates,
  selectConsecutiveCycleDates,
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner, toast, EmptyState } from './shared'

// ── USER PAYMENTS ──────────────────────────────────────────
export function UserPayments({ payments, member, gym, onRefresh }) {
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [uploading, setUploading] = useState(null)

  const handleUploadVoucher = async (paymentId, file) => {
    if (!file || !member) return
    setUploading(paymentId)
    const { path, error } = await uploadVoucher(file, member.id)
    if (error) {
      toast.error('Error al subir el comprobante. Verifica tu conexión e intenta de nuevo.')
      setUploading(null)
      return
    }
    const { error: attachError } = await attachPaymentVoucher(paymentId, path)
    if (attachError) {
      await supabase.storage.from('vouchers').remove([path])
      toast.error(attachError.message || 'No se pudo asociar el comprobante al pago')
      setUploading(null)
      return
    }
    setUploading(null)
    toast.success('Comprobante enviado. El administrador lo revisará pronto.')
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-3">
        <h2 className="section-title">Mis pagos</h2>
        <button className="btn-primary text-sm" disabled={!member?.plan} onClick={() => setShowNewPayment(true)}>
          <Plus className="w-4 h-4" /> Registrar pago
        </button>
      </div>

      {!member?.plan && (
        <div className="card border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-300">
          Aún no tienes un plan asignado. Contacta a recepción antes de registrar un pago.
        </div>
      )}

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
                    className="absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                    <input type="file" accept="image/*" className="hidden" disabled={!!uploading}
                      onChange={e => e.target.files?.[0] && handleUploadVoucher(p.id, e.target.files[0])} />
                  </label>
                )}
                {/* Enviar por WhatsApp al admin */}
                {(p.voucher_url || p.payment_method === 'cash') && p.status !== 'approved' && (
                  <button className="btn-ghost text-sm" onClick={() => sendVoucherToAdmin(p, member, gym)}>
                    <MessageCircle className="w-3.5 h-3.5" /> Enviar al admin
                  </button>
                )}
                {/* Descargar PDF */}
                <button className="btn-ghost text-sm" onClick={() => generatePaymentPDF(p, member)}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                {/* Recibo imagen (solo aprobados) */}
                {p.status === 'approved' && (
                  <button className="btn-ghost text-sm" onClick={() => generateReceiptImage(p, member, import.meta.env.VITE_GYM_NAME || 'GYM')}>
                    <Download className="w-3.5 h-3.5" /> Recibo
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {payments.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="Aún no tienes pagos registrados"
            subtitle="Registra tu primer pago con el botón de arriba — tu historial y comprobantes vivirán aquí"
          />
        )}
      </div>

      <NewPaymentModal
        open={showNewPayment}
        onClose={() => setShowNewPayment(false)}
        member={member}
        gym={gym}
        existingPayments={payments}
        onRefresh={onRefresh}
      />
    </div>
  )
}

// ── MODAL NUEVO PAGO (usuario) ─────────────────────────────
function NewPaymentModal({ open, onClose, member, gym, existingPayments, onRefresh }) {
  const [method, setMethod]       = useState('transfer')
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [selectedCycles, setSelectedCycles] = useState([])

  const planPrice = member?.plan?.price || 0
  const planName  = member?.plan?.name  || 'Sin plan'

  // Los cobros siguen la duracion real del plan, no el fin del mes calendario.
  // Para datos antiguos se continua desde el ultimo vencimiento registrado.
  const durationDays = Math.max(1, Number(member?.plan?.duration_days || 30))
  const lastRegisteredDue = getLastRegisteredDueDate(member?.id, existingPayments)
  const cycleAnchor = lastRegisteredDue || member?.start_date || today()
  const cycles = buildPaymentCycleDates(cycleAnchor, durationDays, 12).map(due => {
    const begins = addDays(due, -durationDays + 1)
    return {
      key: due,
      due,
      label: `Vence ${formatDate(due)}`,
      range: `${formatDate(begins)} – ${formatDate(due)}`,
    }
  })

  const toggleCycle = (key) => {
    setSelectedCycles(prev => selectConsecutiveCycleDates(
      cycles.map(cycle => cycle.key), key, prev
    ))
  }

  const totalAmount = selectedCycles.length * planPrice

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!selectedCycles.length) { toast.info('Selecciona al menos un ciclo'); return }
    if (!file) { toast.info('Debes subir el comprobante de pago (foto del depósito o transferencia)'); return }
    if (!member) return

    setUploading(true)

    const { path, error } = await uploadVoucher(file, member.id)
    if (error) {
      toast.error(error.message || 'Error al subir el comprobante. Intenta de nuevo.')
      setUploading(false)
      return
    }

    const { error: submitError } = await submitMemberPayments(
      [...selectedCycles].sort(),
      method,
      path
    )
    if (submitError) {
      await supabase.storage.from('vouchers').remove([path])
      toast.error(submitError.message || 'No se pudo registrar el pago')
      setUploading(false)
      return
    }

    setUploading(false)
    setSuccess(true)
  }

  const handleClose = () => {
    setMethod('transfer')
    setFile(null)
    setPreview(null)
    setSelectedCycles([])
    setSuccess(false)
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
          {gym?.whatsapp_number && <button className="btn-primary w-full" onClick={() => {
            // Enviar WhatsApp al admin automáticamente
            const msg = `🏋️ *${gym?.name || import.meta.env.VITE_GYM_NAME || 'GymApp'}*
📋 *Nuevo pago registrado*

👤 *${member?.profile?.full_name}*
💰 *${formatCurrency(totalAmount)}*
📅 Ciclos: ${selectedCycles.map(k => cycles.find(c => c.key === k)?.label).join(', ')}

Por favor revisar y aprobar ✅`
            const digits = String(gym.whatsapp_number).replace(/[^0-9]/g,'')
            const num = digits.length === 8 ? `502${digits}` : digits
            window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
            handleClose()
          }}>
            <MessageCircle className="w-4 h-4" /> Notificar al administrador por WhatsApp
          </button>}
          <button className="btn-ghost w-full mt-2" onClick={handleClose}>
            Cerrar
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Plan info */}
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400">Tu plan</p>
            <p className="font-semibold text-white">{planName} — {formatCurrency(planPrice)} cada {durationDays} días</p>
          </div>

          <div>
            <label className="label mb-0">¿Qué ciclos deseas pagar?</label>
            <p className="text-[11px] text-gray-500 mt-1">Se calculan desde tu último vencimiento registrado.</p>
          </div>

          {/* Proximos 12 ciclos del plan */}
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2">
            {cycles.map(cycle => {
              const isSelected = selectedCycles.includes(cycle.key)
              return (
                <button
                  key={cycle.key}
                  onClick={() => toggleCycle(cycle.key)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all
                    ${isSelected
                        ? 'bg-brand-500/10 border-brand-500/40'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'}`}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {cycle.label}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{cycle.range}</p>
                    <p className="text-[10px] text-brand-400">{formatCurrency(planPrice)}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-600'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Total */}
          {selectedCycles.length > 0 && (
            <div className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs text-gray-500">Total a pagar</p>
                <p className="text-xs text-gray-400">{selectedCycles.length} ciclo{selectedCycles.length > 1 ? 's' : ''}</p>
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
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <button className="btn-primary w-full" onClick={handleSubmit}
            disabled={uploading || !selectedCycles.length || !file}>
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

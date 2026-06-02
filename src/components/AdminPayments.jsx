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
  generateMasterExcel, today, addDays, calculateStreak, generateReceiptImage
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner } from './shared'

// ── USER PAYMENTS ──────────────────────────────────────────
export function UserPayments({ payments, member, onRefresh }) {
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
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" disabled={!!uploading}
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

  // Mes de inicio del miembro — no puede pagar meses anteriores a su inscripcion
  const startKey  = member?.start_date?.slice(0, 7) || '2000-01'
  const startYear = parseInt(startKey.slice(0, 4))
  const thisYear  = new Date().getFullYear()

  // El año offset solo puede ser desde el año de inicio en adelante
  // y máximo el año siguiente al actual
  const baseYear   = Math.max(startYear, thisYear)
  const currentYear = baseYear + yearOffset

  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const d     = new Date(currentYear, i, 1)
    const key   = `${currentYear}-${String(i + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })
    const due   = new Date(currentYear, i + 1, 0).toISOString().slice(0, 10)
    const isPaid = existingPayments.some(p =>
      p.due_date?.slice(0, 7) === key && p.status !== 'rejected'
    )
    const isBeforeStart = key < startKey
    return { key, label, due, isPaid, isBeforeStart }
  }).filter(m => !m.isBeforeStart)

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

          {/* Selector de año — solo mostrar año de inicio en adelante */}
          <div className="flex items-center justify-between">
            <label className="label mb-0">¿Qué cuotas deseas pagar?</label>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-1 py-0.5">
              <button
                onClick={() => { setYearOffset(0); setSelectedMonths([]) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${yearOffset === 0 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >{baseYear}</button>
              <button
                onClick={() => { setYearOffset(1); setSelectedMonths([]) }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${yearOffset === 1 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >{baseYear + 1}</button>
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
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={handleFileChange} />
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

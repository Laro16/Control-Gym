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

// ── USER BODY (medidas + fotos) ───────────────────────────
export function UserBody({ measurements, photos, member, onRefresh }) {
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

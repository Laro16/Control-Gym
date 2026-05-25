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

// ── USER ACCOUNT PANEL ─────────────────────────────────────
export function UserAccountPanel({ profile, member, onClose, onLogout, onRefresh }) {
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

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
export function UserStreak({ attendance, member, onRefresh, profile }) {
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

import { useMemo } from 'react'
import { Flame, CreditCard, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import {
  formatDate, formatCurrency, getPaymentStatus,
  paymentStatusLabel, calculateStreak, today
} from '../utils/helpers'

// Saludo según hora del día
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '¡Buenos días'
  if (h < 19) return '¡Buenas tardes'
  return '¡Buenas noches'
}

// Emoji de bienvenida según género
function getWelcomeEmoji(gender) {
  if (gender === 'female') return '🧘‍♀️'
  return '💪'
}

// Mensaje motivacional del día
function getDayMessage(streak, markedToday) {
  if (markedToday) return { text: '¡Ya entrenaste hoy! Sigue así 🔥', color: 'text-emerald-400' }
  if (streak === 0)  return { text: '¡Hoy es un buen día para empezar!', color: 'text-gray-400' }
  if (streak < 3)    return { text: `Llevas ${streak} días. ¡No pares ahora!`, color: 'text-brand-400' }
  if (streak < 7)    return { text: `${streak} días seguidos. ¡Buen ritmo!`, color: 'text-brand-400' }
  if (streak < 14)   return { text: `¡${streak} días imparable! Sigue quemando 🔥`, color: 'text-orange-400' }
  return { text: `¡${streak} días! Eres una máquina 🏆`, color: 'text-yellow-400' }
}

// Advertencia de racha según la hora
function getStreakWarning(markedToday, streak) {
  if (markedToday || streak === 0) return null
  const h = new Date().getHours()
  const remaining = 23 - h
  if (h >= 21) return { urgent: true,  text: `⚠️ ¡Solo quedan ${remaining}h para salvar tu racha de ${streak} días!` }
  if (h >= 18) return { urgent: false, text: `🕐 Aún tienes tiempo. No olvides registrar tu asistencia hoy.` }
  return null
}

export function UserHome({ member, payments, profile, attendance, onNavigate }) {
  const lastPayment = payments.filter(p => p.status !== 'rejected')[0]
  const payStatus   = lastPayment ? getPaymentStatus(lastPayment.due_date) : null
  const stLabel     = payStatus ? paymentStatusLabel[payStatus] : null

  const streak      = useMemo(() => calculateStreak(attendance || []), [attendance])
  const todayStr    = today()
  const markedToday = (attendance || []).some(a => a.attended_date === todayStr)
  const greeting    = getGreeting()
  const firstName   = profile.full_name.split(' ')[0]
  const gender      = profile.gender || 'male'
  const dayMsg      = getDayMessage(streak, markedToday)
  const warning     = getStreakWarning(markedToday, streak)

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">

      {/* ── BIENVENIDA ──────────────────────────────────── */}
      <div className="card bg-gradient-to-br from-brand-500/10 to-brand-700/5 border-brand-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{greeting},</p>
            <h2 className="text-2xl font-bold text-white mt-0.5">
              {firstName} {getWelcomeEmoji(gender)}
            </h2>
            <p className={`text-sm mt-1 ${dayMsg.color}`}>{dayMsg.text}</p>
          </div>
          {/* Llama de racha — encendida si entrenó hoy */}
          <button
            onClick={() => onNavigate?.('streak')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-all active:scale-95"
            title="Ver tu racha"
          >
            <Flame
              className={`w-10 h-10 transition-all duration-300 ${
                markedToday
                  ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]'
                  : 'text-gray-600'
              }`}
              fill={markedToday ? 'currentColor' : 'none'}
            />
            <span className={`text-xs font-bold ${markedToday ? 'text-orange-400' : 'text-gray-600'}`}>
              {streak} días
            </span>
          </button>
        </div>

        {/* Advertencia de racha */}
        {warning && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-sm flex items-center gap-2
            ${warning.urgent
              ? 'bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse-slow'
              : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
            {warning.text}
          </div>
        )}
      </div>

      {/* ── ACCESO RÁPIDO ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Botón de check-in rápido */}
        <button
          onClick={() => onNavigate?.('streak')}
          className={`card flex flex-col items-center gap-2 py-5 transition-all active:scale-95 border-2
            ${markedToday
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-dashed border-brand-500/40 hover:border-brand-500/70 hover:bg-brand-500/5'}`}
        >
          <Flame className={`w-8 h-8 ${markedToday ? 'text-emerald-400' : 'text-brand-500'}`}
            fill={markedToday ? 'currentColor' : 'none'} />
          <span className={`text-xs font-semibold ${markedToday ? 'text-emerald-400' : 'text-white'}`}>
            {markedToday ? '✓ Entrenaste hoy' : 'Marcar asistencia'}
          </span>
        </button>

        {/* Estado de cuota */}
        <button
          onClick={() => onNavigate?.('payments')}
          className="card flex flex-col items-center gap-2 py-5 transition-all active:scale-95 hover:border-gray-600"
        >
          {payStatus === 'approved' || payStatus === 'current' ? (
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          ) : payStatus === 'overdue' ? (
            <AlertTriangle className="w-8 h-8 text-red-400" />
          ) : (
            <CreditCard className="w-8 h-8 text-brand-500" />
          )}
          <span className="text-xs font-semibold text-white">
            {lastPayment ? stLabel?.text : 'Ver pagos'}
          </span>
          {lastPayment && (
            <span className="text-[10px] text-gray-500">
              {formatCurrency(lastPayment.amount)} · {formatDate(lastPayment.due_date)}
            </span>
          )}
        </button>
      </div>

      {/* ── TARJETAS INFO ────────────────────────────────── */}
      {member && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Miembro desde</p>
            <p className="font-semibold text-white text-sm">{formatDate(member.start_date)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Plan actual</p>
            <p className="font-semibold text-white text-sm">{member.plan?.name || 'Sin plan'}</p>
          </div>
        </div>
      )}

      {/* ── RACHA MINI ───────────────────────────────────── */}
      {streak > 0 && (
        <button
          onClick={() => onNavigate?.('streak')}
          className="card w-full flex items-center gap-4 py-4 hover:border-orange-500/30 transition-all active:scale-95"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
            <Flame className="w-6 h-6 text-orange-400" fill="currentColor" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs text-gray-500">Racha actual</p>
            <p className="text-xl font-bold text-white">{streak} <span className="text-sm font-normal text-gray-400">días seguidos</span></p>
          </div>
          <Zap className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Sin miembro */}
      {!member && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Tu perfil aún no está configurado. Contacta al administrador.</p>
        </div>
      )}

    </div>
  )
}

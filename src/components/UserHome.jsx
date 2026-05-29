import { useMemo } from 'react'
import {
  Flame, CreditCard, AlertTriangle, CheckCircle,
  Zap, Clock, AlertCircle
} from 'lucide-react'
import {
  formatDate, formatCurrency, getMemberPaymentStatus,
  paymentStatusLabel, calculateStreak, today, daysBetween
} from '../utils/helpers'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '¡Buenos días'
  if (h < 19) return '¡Buenas tardes'
  return '¡Buenas noches'
}

function getWelcomeEmoji(gender) {
  if (gender === 'female') return '🧘‍♀️'
  return '💪'
}

function getDayMessage(streak, markedToday) {
  if (markedToday) return { text: '¡Ya entrenaste hoy! Sigue así 🔥', color: 'text-emerald-400' }
  if (streak === 0)  return { text: '¡Hoy es un buen día para empezar!', color: 'text-gray-400' }
  if (streak < 3)    return { text: `Llevas ${streak} días. ¡No pares ahora!`, color: 'text-brand-400' }
  if (streak < 7)    return { text: `${streak} días seguidos. ¡Buen ritmo!`, color: 'text-brand-400' }
  if (streak < 14)   return { text: `¡${streak} días imparable! Sigue quemando 🔥`, color: 'text-orange-400' }
  return { text: `¡${streak} días! Eres una máquina 🏆`, color: 'text-yellow-400' }
}

function getStreakWarning(markedToday, streak) {
  if (markedToday || streak === 0) return null
  const h = new Date().getHours()
  const remaining = 23 - h
  if (h >= 21) return { urgent: true,  text: `⚠️ ¡Solo quedan ~${remaining}h para salvar tu racha de ${streak} días!` }
  if (h >= 18) return { urgent: false, text: `🕐 Aún tienes tiempo. No olvides registrar tu asistencia hoy.` }
  return null
}

// Ícono y color según estado de pago
function PaymentStatusIcon({ status }) {
  if (status === 'current')          return <CheckCircle className="w-8 h-8 text-emerald-400" />
  if (status === 'overdue')          return <AlertTriangle className="w-8 h-8 text-red-400" />
  if (status === 'due_soon')         return <AlertCircle className="w-8 h-8 text-yellow-400" />
  if (status === 'pending_approval') return <Clock className="w-8 h-8 text-yellow-400" />
  if (status === 'new_member')       return <CreditCard className="w-8 h-8 text-brand-500" />
  return <CreditCard className="w-8 h-8 text-gray-500" />
}

export function UserHome({ member, payments, profile, attendance, onNavigate }) {
  const streak      = useMemo(() => calculateStreak(attendance || []), [attendance])
  const todayStr    = today()
  const markedToday = (attendance || []).some(a => a.attended_date === todayStr)
  const greeting    = getGreeting()
  const firstName   = profile.full_name.split(' ')[0]
  const gender      = profile.gender || 'male'
  const dayMsg      = getDayMessage(streak, markedToday)
  const warning     = getStreakWarning(markedToday, streak)

  // Estado de pago con lógica completa
  const payStatus = member
    ? getMemberPaymentStatus(member, payments)
    : 'no_payment'
  const stLabel = paymentStatusLabel[payStatus]

  // Último pago aprobado para mostrar datos
  const lastApproved = payments.find(p => p.status === 'approved')
  const lastPending  = payments.find(p => p.status === 'pending')

  // Texto informativo según estado
  const paymentSubtext = () => {
    if (payStatus === 'new_member') {
      const days = member?.start_date ? daysBetween(member.start_date, today()) : 0
      return `Día ${days + 1} como miembro · Primer pago pendiente`
    }
    if (payStatus === 'pending_approval') {
      return `Comprobante enviado · En revisión`
    }
    if (payStatus === 'no_payment') {
      return member?.start_date
        ? `Sin pagos desde ${formatDate(member.start_date)}`
        : 'Sin pagos registrados'
    }
    if (lastApproved) {
      return `${formatCurrency(lastApproved.amount)} · Vence ${formatDate(lastApproved.due_date)}`
    }
    return ''
  }

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
          {/* Llama de racha */}
          <button
            onClick={() => onNavigate?.('streak')}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-all active:scale-95"
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

        {/* Check-in rápido */}
        <button
          onClick={() => onNavigate?.('streak')}
          className={`card flex flex-col items-center gap-2 py-5 transition-all active:scale-95 border-2
            ${markedToday
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-dashed border-brand-500/40 hover:border-brand-500/70 hover:bg-brand-500/5'}`}
        >
          <Flame
            className={`w-8 h-8 ${markedToday ? 'text-emerald-400' : 'text-brand-500'}`}
            fill={markedToday ? 'currentColor' : 'none'}
          />
          <span className={`text-xs font-semibold ${markedToday ? 'text-emerald-400' : 'text-white'}`}>
            {markedToday ? '✓ Entrenaste hoy' : 'Marcar asistencia'}
          </span>
        </button>

        {/* Estado de cuota */}
        <button
          onClick={() => onNavigate?.('payments')}
          className="card flex flex-col items-center gap-2 py-4 transition-all active:scale-95 hover:border-gray-600"
        >
          <PaymentStatusIcon status={payStatus} />
          <span className={`text-xs font-semibold text-center leading-tight ${stLabel?.cls?.includes('red') ? 'text-red-400' : stLabel?.cls?.includes('yellow') ? 'text-yellow-400' : stLabel?.cls?.includes('green') ? 'text-emerald-400' : 'text-white'}`}>
            {stLabel?.text || 'Ver pagos'}
          </span>
          <span className="text-[10px] text-gray-600 text-center leading-tight px-1">
            {paymentSubtext()}
          </span>
        </button>
      </div>

      {/* ── ALERTA SI CUOTA VENCIDA ───────────────────────── */}
      {(payStatus === 'overdue' || payStatus === 'due_soon') && (
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 border
          ${payStatus === 'overdue'
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-yellow-500/10 border-yellow-500/20'}`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${payStatus === 'overdue' ? 'text-red-400' : 'text-yellow-400'}`} />
          <div>
            <p className={`text-sm font-semibold ${payStatus === 'overdue' ? 'text-red-400' : 'text-yellow-400'}`}>
              {payStatus === 'overdue' ? 'Tu cuota está vencida' : 'Tu cuota vence pronto'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {lastApproved
                ? `Venció el ${formatDate(lastApproved.due_date)}`
                : 'Registra tu pago para estar al día'
              }
              {' · '}
              <button onClick={() => onNavigate?.('payments')} className="text-brand-400 underline">
                Pagar ahora
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── ALERTA NUEVO MIEMBRO ──────────────────────────── */}
      {payStatus === 'new_member' && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 border bg-brand-500/5 border-brand-500/20">
          <CreditCard className="w-5 h-5 text-brand-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-brand-400">¡Bienvenido al gimnasio!</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuando realices tu primer pago, regístralo en la pestaña de{' '}
              <button onClick={() => onNavigate?.('payments')} className="text-brand-400 underline">
                Pagos
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── INFO MIEMBRO ──────────────────────────────────── */}
      {member && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Miembro desde</p>
            <p className="font-semibold text-white text-sm">{formatDate(member.start_date)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Plan actual</p>
            <p className="font-semibold text-white text-sm">{member.plan?.name || 'Sin plan'}</p>
            {member.plan?.price && (
              <p className="text-xs text-gray-600">{formatCurrency(member.plan.price)}/mes</p>
            )}
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
            <p className="text-xl font-bold text-white">
              {streak} <span className="text-sm font-normal text-gray-400">días seguidos</span>
            </p>
          </div>
          <Zap className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {!member && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Tu perfil aún no está configurado. Contacta al administrador.</p>
        </div>
      )}

    </div>
  )
}

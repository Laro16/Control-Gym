import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, CalendarDays, CheckCircle,
  ChevronRight, Clock, CreditCard, Dumbbell, Flame, Sparkles, TrendingUp
} from 'lucide-react'
import {
  addDays, calculateStreak, daysBetween, formatCurrency, formatDate,
  getMemberPaymentStatus, paymentStatusLabel, today
} from '../utils/helpers'
import { useCountUp } from './shared'
import { getAnnouncements } from '../supabase'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function getDayMessage(streak, markedToday) {
  if (markedToday) return 'Tu entrenamiento de hoy ya quedó registrado.'
  if (streak === 0) return 'Hoy puede ser el inicio de una gran racha.'
  if (streak < 7) return `Llevas ${streak} días. Hoy toca mantener el ritmo.`
  return `¡${streak} días de constancia! Sigue construyendo el hábito.`
}

function getStreakWarning(markedToday, streak) {
  if (markedToday || streak === 0) return null
  const hour = new Date().getHours()
  if (hour >= 21) return `Queda poco tiempo para conservar tu racha de ${streak} días.`
  if (hour >= 18) return 'Aún tienes tiempo para registrar tu asistencia de hoy.'
  return null
}

function PaymentStatusIcon({ status, className = 'w-7 h-7' }) {
  if (status === 'current') return <CheckCircle className={`${className} text-emerald-400`} />
  if (status === 'overdue') return <AlertTriangle className={`${className} text-red-400`} />
  if (status === 'due_soon') return <AlertCircle className={`${className} text-yellow-400`} />
  if (status === 'pending_approval') return <Clock className={`${className} text-yellow-400`} />
  if (status === 'new_member') return <CreditCard className={`${className} text-brand-400`} />
  return <CreditCard className={`${className} text-gray-500`} />
}

const holidayDate = holiday => typeof holiday === 'string' ? holiday : holiday?.date

export function UserHome({ member, payments, profile, attendance, streakOptions, onNavigate }) {
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    getAnnouncements().then(({ data }) => {
      const current = today()
      const valid = (data || []).filter(a => !a.expires_at || a.expires_at >= current)
      setAnnouncements(valid.slice(0, 3))
    })
  }, [])

  const streak = calculateStreak(attendance || [], streakOptions)
  const displayStreak = useCountUp(streak, 700)
  const todayStr = today()
  const attendanceDates = useMemo(
    () => new Set((attendance || []).map(item => item.attended_date)),
    [attendance]
  )
  const markedToday = attendanceDates.has(todayStr)
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || 'Atleta'
  const warning = getStreakWarning(markedToday, streak)

  const payStatus = member ? getMemberPaymentStatus(member, payments) : 'no_payment'
  const statusLabel = paymentStatusLabel[payStatus]
  const lastApproved = payments.find(payment => payment.status === 'approved')
  const weeklyCount = Array.from(attendanceDates).filter(date => {
    const difference = daysBetween(date, todayStr)
    return difference >= 0 && difference <= 6
  }).length

  const weekDays = useMemo(() => {
    const closed = streakOptions?.closedWeekdays || []
    const holidays = (streakOptions?.holidays || []).map(holidayDate)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(todayStr, index - 6)
      const parsed = new Date(`${date}T12:00:00`)
      return {
        date,
        label: parsed.toLocaleDateString('es-GT', { weekday: 'short' }).slice(0, 1).toUpperCase(),
        number: parsed.getDate(),
        attended: attendanceDates.has(date),
        rest: closed.includes(parsed.getDay()) || holidays.includes(date),
        isToday: date === todayStr,
      }
    })
  }, [attendanceDates, streakOptions, todayStr])

  const paymentSubtext = () => {
    if (payStatus === 'new_member') {
      const membershipDay = member?.start_date ? daysBetween(member.start_date, todayStr) + 1 : 1
      return `Día ${membershipDay} como miembro`
    }
    if (payStatus === 'pending_approval') return 'Comprobante en revisión'
    if (payStatus === 'no_payment') return 'Aún no hay pagos registrados'
    if (lastApproved) return `Vence ${formatDate(lastApproved.due_date)}`
    return 'Consulta tu historial'
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      <section className="member-hero relative overflow-hidden rounded-[28px] p-5 sm:p-6">
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-brand-500/15 blur-2xl" />
        <div className="absolute right-5 bottom-3 opacity-[0.07] rotate-[-12deg]">
          <Dumbbell className="w-28 h-28 text-white" strokeWidth={1.5} />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="member-hero-muted text-xs font-semibold uppercase tracking-[0.18em]">
                {getGreeting()}
              </p>
              <h1 className="member-hero-title text-3xl font-bold tracking-tight mt-1 truncate">
                Hola, {firstName}
              </h1>
              <p className="member-hero-copy text-sm mt-2 max-w-[270px] leading-relaxed">
                {getDayMessage(streak, markedToday)}
              </p>
            </div>

            <button
              onClick={() => onNavigate?.('streak')}
              className="member-streak-pill flex flex-col items-center min-w-[66px] rounded-2xl px-3 py-2.5 active:scale-95 transition-transform"
              aria-label="Ver mi racha"
            >
              <Flame
                className={`w-6 h-6 ${markedToday ? 'text-brand-400 animate-flicker' : 'text-gray-500'}`}
                fill={markedToday ? 'currentColor' : 'none'}
              />
              <strong className="member-hero-title text-lg tabular-nums leading-none mt-1">{displayStreak}</strong>
              <span className="member-hero-muted text-[9px] uppercase tracking-wide">días</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6 max-w-xs">
            <div className="member-hero-stat rounded-xl px-3 py-2.5">
              <p className="member-hero-muted text-[10px] uppercase tracking-wide">Esta semana</p>
              <p className="member-hero-title font-semibold mt-0.5">{weeklyCount} entrenamientos</p>
            </div>
            <div className="member-hero-stat rounded-xl px-3 py-2.5">
              <p className="member-hero-muted text-[10px] uppercase tracking-wide">Plan actual</p>
              <p className="member-hero-title font-semibold mt-0.5 truncate">{member?.plan?.name || 'Sin plan'}</p>
            </div>
          </div>
        </div>
      </section>

      {warning && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{warning}</p>
        </div>
      )}

      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-[0.2em]">Tu gimnasio</p>
            <h2 className="text-xl font-bold text-white mt-0.5">Accesos rápidos</h2>
          </div>
          <Sparkles className="w-5 h-5 text-brand-400/70" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate?.('streak')}
            className="member-action-card member-action-brand relative overflow-hidden rounded-3xl p-4 min-h-[154px] text-left active:scale-[0.98] transition-transform"
          >
            <Flame className="absolute -right-3 -bottom-4 w-24 h-24 text-white/10" fill="currentColor" />
            <div className="relative h-full flex flex-col">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                {markedToday
                  ? <CheckCircle className="w-5 h-5 text-white" />
                  : <Activity className="w-5 h-5 text-white" />}
              </div>
              <div className="mt-auto pt-5">
                <p className="text-white font-bold text-lg">{markedToday ? '¡Listo por hoy!' : 'Check-in'}</p>
                <p className="text-white/70 text-xs mt-0.5">
                  {markedToday ? 'Asistencia registrada' : 'Escanea el QR del gym'}
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('payments')}
            className="member-action-card card relative overflow-hidden rounded-3xl p-4 min-h-[154px] text-left active:scale-[0.98] transition-transform"
          >
            <CreditCard className="absolute -right-4 -bottom-5 w-24 h-24 text-gray-700/20" />
            <div className="relative h-full flex flex-col">
              <div className="w-10 h-10 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                <PaymentStatusIcon status={payStatus} className="w-5 h-5" />
              </div>
              <div className="mt-auto pt-5">
                <p className="text-white font-bold text-lg">Mis pagos</p>
                <p className={`text-xs font-semibold mt-0.5 ${
                  payStatus === 'overdue' ? 'text-red-400' :
                  payStatus === 'current' ? 'text-emerald-400' :
                  payStatus === 'due_soon' || payStatus === 'pending_approval' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {statusLabel?.text || 'Ver historial'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 truncate">{paymentSubtext()}</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {(payStatus === 'overdue' || payStatus === 'due_soon' || payStatus === 'new_member') && (
        <button
          onClick={() => onNavigate?.('payments')}
          className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 border text-left active:scale-[0.99] transition-transform ${
            payStatus === 'overdue'
              ? 'bg-red-500/10 border-red-500/20'
              : payStatus === 'due_soon'
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-brand-500/10 border-brand-500/20'
          }`}
        >
          <PaymentStatusIcon status={payStatus} className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">
              {payStatus === 'overdue' ? 'Tu cuota está vencida' : payStatus === 'due_soon' ? 'Tu cuota vence pronto' : 'Registra tu primer pago'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Toca para ver los detalles</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      )}

      <section className="card rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">Actividad reciente</p>
            <h2 className="text-lg font-bold text-white">Tus últimos 7 días</h2>
          </div>
          <button onClick={() => onNavigate?.('streak')} className="text-xs text-brand-400 font-semibold flex items-center gap-1">
            Ver racha <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map(day => (
            <div key={day.date} className="flex flex-col items-center gap-1.5">
              <span className={`text-[10px] font-semibold ${day.isToday ? 'text-brand-400' : 'text-gray-600'}`}>{day.label}</span>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                day.attended
                  ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : day.rest
                    ? 'bg-gray-800/50 border-dashed border-gray-700 text-gray-600'
                    : day.isToday
                      ? 'bg-brand-500/10 border-brand-500/40 text-brand-400'
                      : 'bg-gray-800/40 border-gray-800 text-gray-500'
              }`}>
                {day.attended ? <CheckCircle className="w-4 h-4" /> : day.number}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-white mb-3">Tu espacio</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onNavigate?.('body')} className="card rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm text-white">Mi progreso</strong>
              <small className="block text-[10px] text-gray-500 truncate">Medidas y fotos</small>
            </span>
          </button>

          <button onClick={() => onNavigate?.('plans')} className="card rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
            <span className="w-10 h-10 rounded-2xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-brand-400" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm text-white">Mi plan</strong>
              <small className="block text-[10px] text-gray-500 truncate">
                {member?.plan?.price ? `${formatCurrency(member.plan.price)} · ${member.plan.duration_days || 30} días` : 'Ver opciones'}
              </small>
            </span>
          </button>
        </div>
      </section>

      {announcements.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-3">Novedades</h2>
          <div className="space-y-2">
            {announcements.map(announcement => (
              <div
                key={announcement.id}
                className={`card w-full rounded-2xl p-4 text-left flex items-center gap-3 ${announcement.pinned ? 'border-brand-500/30' : ''}`}
              >
                <span className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">{announcement.emoji}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm text-white truncate">{announcement.title}</strong>
                  <small className="block text-xs text-gray-500 truncate mt-0.5">{announcement.body}</small>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!member && (
        <div className="card border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Tu perfil aún no está configurado. Contacta al administrador.</p>
        </div>
      )}
    </div>
  )
}

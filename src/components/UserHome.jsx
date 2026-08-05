import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, CalendarDays, CheckCircle,
  ChevronRight, Clock, CreditCard, Flame, TrendingUp
} from 'lucide-react'
import {
  addDays, calculateStreak, daysBetween, formatCurrency, formatDate,
  getMemberPaymentStatus, paymentStatusLabel, today
} from '../utils/helpers'
import { useCountUp, toast } from './shared'
import { getAnnouncements } from '../supabase'
import memberHeroImage from '../assets/member-hero-v2.webp'

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
    getAnnouncements().then(({ data, error }) => {
      const current = today()
      const valid = (data || []).filter(a => !a.expires_at || a.expires_at >= current)
      setAnnouncements(valid.slice(0, 3))
      if (error) toast.error(error.message || 'No se pudieron cargar los anuncios')
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
    if (payStatus === 'no_plan') return 'Solicita un plan en recepción'
    if (payStatus === 'no_payment') return 'Aún no hay pagos registrados'
    if (lastApproved) return `Vence ${formatDate(lastApproved.due_date)}`
    return 'Consulta tu historial'
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      <div className="relative -mx-4 -mt-5 sm:mx-0 sm:mt-0">
        <section className="member-hero-v2 relative min-h-[370px] sm:min-h-[350px] overflow-hidden rounded-b-[38px] sm:rounded-[34px] p-5 sm:p-7 flex flex-col">
          <img
            src={memberHeroImage}
            alt=""
            aria-hidden="true"
            className="member-hero-image absolute inset-0 w-full h-full object-cover"
          />
          <div className="member-hero-v2-overlay absolute inset-0" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <span className="member-hero-glass rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              Hoy · {new Date(`${todayStr}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
            </span>
            <button
              onClick={() => onNavigate?.('streak')}
              className="member-hero-glass flex items-center gap-1.5 rounded-full px-3 py-2 active:scale-95 transition-transform"
              aria-label="Ver mi racha"
            >
              <Flame
                className={`w-4 h-4 ${markedToday ? 'text-brand-400 animate-flicker' : 'text-white/70'}`}
                fill={markedToday ? 'currentColor' : 'none'}
              />
              <strong className="text-sm text-white tabular-nums">{displayStreak}</strong>
              <span className="text-[10px] text-white/70">días</span>
            </button>
          </div>

          <div className="relative z-10 mt-auto max-w-[340px]">
            <p className="text-sm font-medium text-white/70">{getGreeting()}</p>
            <h1 className="text-4xl sm:text-[42px] leading-none font-black tracking-[-0.035em] text-white mt-1">
              Hola, {firstName}
            </h1>
            <p className="text-sm sm:text-base text-white/80 mt-3 leading-relaxed max-w-[310px]">
              {getDayMessage(streak, markedToday)}
            </p>
            <button
              onClick={() => onNavigate?.('streak')}
              className="member-checkin-cta mt-5 w-full sm:w-auto rounded-2xl px-4 py-3.5 flex items-center justify-center gap-3 text-white font-bold active:scale-[0.98] transition-transform"
            >
              {markedToday
                ? <CheckCircle className="w-5 h-5" />
                : <Activity className="w-5 h-5" />}
              <span>{markedToday ? 'Asistencia registrada' : 'Registrar asistencia'}</span>
              <ChevronRight className="w-4 h-4 ml-auto sm:ml-3" />
            </button>
          </div>
        </section>

        <div className="member-floating-summary relative z-20 grid grid-cols-3 gap-2 -mt-8 mx-4 sm:mx-5">
          <button onClick={() => onNavigate?.('streak')} className="member-floating-stat rounded-2xl px-2 py-3 text-center active:scale-95 transition-transform">
            <Flame className="w-4 h-4 text-brand-400 mx-auto" />
            <strong className="block text-base text-white mt-1 tabular-nums">{displayStreak}</strong>
            <span className="block text-[9px] text-gray-500 uppercase tracking-wide">Racha</span>
          </button>
          <button onClick={() => onNavigate?.('streak')} className="member-floating-stat rounded-2xl px-2 py-3 text-center active:scale-95 transition-transform">
            <Activity className="w-4 h-4 text-emerald-400 mx-auto" />
            <strong className="block text-base text-white mt-1 tabular-nums">{weeklyCount}</strong>
            <span className="block text-[9px] text-gray-500 uppercase tracking-wide">Semana</span>
          </button>
          <button onClick={() => onNavigate?.('plans')} className="member-floating-stat rounded-2xl px-2 py-3 text-center active:scale-95 transition-transform">
            <CalendarDays className="w-4 h-4 text-sky-400 mx-auto" />
            <strong className="block text-sm text-white mt-1 truncate">{member?.plan?.name || 'Sin plan'}</strong>
            <span className="block text-[9px] text-gray-500 uppercase tracking-wide">Plan</span>
          </button>
        </div>
      </div>

      {warning && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          <Clock className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{warning}</p>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-[0.2em]">Todo en un lugar</p>
            <h2 className="text-2xl font-bold text-white mt-0.5">Explora</h2>
          </div>
          <span className="text-xs text-gray-500">Accesos rápidos</span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <button onClick={() => onNavigate?.('payments')} className="member-explore-button group text-center active:scale-95 transition-transform">
            <span className="member-explore-icon member-explore-payments">
              <CreditCard className="w-6 h-6" />
            </span>
            <strong className="block text-xs text-white mt-2">Pagos</strong>
          </button>
          <button onClick={() => onNavigate?.('body')} className="member-explore-button group text-center active:scale-95 transition-transform">
            <span className="member-explore-icon member-explore-progress">
              <TrendingUp className="w-6 h-6" />
            </span>
            <strong className="block text-xs text-white mt-2">Progreso</strong>
          </button>
          <button onClick={() => onNavigate?.('streak')} className="member-explore-button group text-center active:scale-95 transition-transform">
            <span className="member-explore-icon member-explore-streak">
              <Flame className="w-6 h-6" />
            </span>
            <strong className="block text-xs text-white mt-2">Racha</strong>
          </button>
          <button onClick={() => onNavigate?.('plans')} className="member-explore-button group text-center active:scale-95 transition-transform">
            <span className="member-explore-icon member-explore-plan">
              <CalendarDays className="w-6 h-6" />
            </span>
            <strong className="block text-xs text-white mt-2">Mi plan</strong>
          </button>
        </div>
      </section>

      <button
        onClick={() => onNavigate?.('payments')}
        className={`member-payment-panel w-full rounded-3xl p-4 flex items-center gap-3 border text-left active:scale-[0.99] transition-transform ${
          payStatus === 'overdue'
            ? 'border-red-500/25'
            : payStatus === 'due_soon' || payStatus === 'pending_approval'
              ? 'border-yellow-500/25'
              : 'border-gray-800'
        }`}
      >
        <span className="member-payment-icon w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
          <PaymentStatusIcon status={payStatus} className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] text-gray-500 uppercase tracking-[0.16em]">Membresía</span>
          <strong className="block text-base text-white mt-0.5 truncate">{statusLabel?.text || 'Mis pagos'}</strong>
          <small className="block text-xs text-gray-500 mt-0.5 truncate">{paymentSubtext()}</small>
        </span>
        <span className="text-right flex-shrink-0">
          {lastApproved?.amount && <strong className="block text-sm text-white">{formatCurrency(lastApproved.amount)}</strong>}
          <ChevronRight className="w-4 h-4 text-gray-500 ml-auto mt-1" />
        </span>
      </button>

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

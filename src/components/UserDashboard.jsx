import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dumbbell, Bell, Sun, Moon, LogOut, Home, CreditCard,
  TrendingUp, Calendar, ClipboardList, X, Camera
} from 'lucide-react'
import { playNotifSound } from '../App'
import {
  supabase,
  getMemberByProfile, getPayments, getMeasurements,
  getProgressPhotos, getAttendance, getNotifications,
  markAllNotificationsRead, getPlans
} from '../supabase'
import { formatDate, today } from '../utils/helpers'
import { PageSkeleton, PullToRefresh } from './shared'
import { applyGymTheme } from '../utils/theme'
import { UserHome } from './UserHome'
import { UserPayments } from './UserPayments'
import { UserBody } from './UserBody'
import { UserStreak } from './UserStreak'
import { UserPlans } from './UserPlans'
import { UserAccountPanel } from './UserAccount'

export function UserDashboard({ profile, onLogout, darkMode, onToggleDark, onProfileUpdate }) {
  const [tab, setTab] = useState('home')
  const [member, setMember] = useState(null)
  const [payments, setPayments] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [attendance, setAttendance] = useState([])
  const [notifications, setNotifications] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const [gymLogo, setGymLogo]         = useState(null)
  const [streakOptions, setStreakOptions] = useState({ closedWeekdays: [0, 6], holidays: [] })
  const [showAccount, setShowAccount] = useState(false)
  const prevNotifsCount = useRef(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [mem, pl, notifs] = await Promise.all([
      getMemberByProfile(profile.id),
      getPlans(),
      getNotifications(profile.id)
    ])
    const m = mem.data
    setMember(m)
    setPlans(pl.data || [])
    setNotifications(notifs.data || [])

    if (m?.id) {
      const [pay, meas, ph, att] = await Promise.all([
        getPayments(m.id),
        getMeasurements(m.id),
        getProgressPhotos(m.id),
        getAttendance(m.id)
      ])
      setPayments(pay.data || [])
      setMeasurements(meas.data || [])
      setPhotos(ph.data || [])
      setAttendance(att.data || [])
    }
    setLoading(false)

    // Datos del gimnasio del miembro: logo + config de racha
    const { data: gymData } = await supabase
      .from('gyms').select('logo_url, closed_weekdays, holidays, primary_color').eq('id', profile.gym_id).single()
    if (gymData?.logo_url) setGymLogo(gymData.logo_url)
    applyGymTheme(gymData?.primary_color)
    if (gymData) setStreakOptions({
      closedWeekdays: gymData.closed_weekdays || [0, 6],
      holidays: Array.isArray(gymData.holidays) ? gymData.holidays : [],
    })
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  // Sonar cuando llegan nuevas notificaciones
  const unread = notifications.filter(n => !n.is_read).length
  useEffect(() => {
    if (unread > prevNotifsCount.current) playNotifSound()
    prevNotifsCount.current = unread
  }, [unread])

  const switchTab = (id) => {
    setTab(id)
    window.scrollTo({ top: 0 })
    if (navigator.vibrate) navigator.vibrate(8) // feedback táctil sutil en Android
  }

  const tabs = [
    { id: 'home',       label: 'Inicio',    icon: Home },
    { id: 'payments',   label: 'Pagos',     icon: CreditCard },
    { id: 'body',       label: 'Cuerpo',    icon: TrendingUp },
    { id: 'streak',     label: 'Racha',     icon: Calendar },
    { id: 'plans',      label: 'Planes',    icon: ClipboardList },
  ]

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {gymLogo ? (
              <img src={gymLogo} alt="logo" className="h-8 w-auto object-contain max-w-[120px]" />
            ) : (
              <>
                <Dumbbell className="w-5 h-5 text-brand-500" />
                <span className="font-display text-xl tracking-wide text-white">
                  {import.meta.env.VITE_GYM_NAME || 'GymApp'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Modo claro/oscuro */}
            <button className="btn-ghost p-2" onClick={onToggleDark} title={darkMode ? "Modo claro" : "Modo oscuro"}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Notificaciones */}
            <button className="relative btn-ghost p-2" onClick={() => {
              setShowNotifs(!showNotifs)
              setShowAccount(false)
              if (!showNotifs) markAllNotificationsRead(profile.id)
            }}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {/* Avatar / cuenta */}
            <button className="btn-ghost p-1" onClick={() => { setShowAccount(!showAccount); setShowNotifs(false) }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border-2 border-brand-500/40" />
                : <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                    <span className="text-brand-400 text-sm font-bold">{profile.full_name?.[0]?.toUpperCase()}</span>
                  </div>
              }
            </button>
          </div>
        </div>
        {showNotifs && (
          <div className="absolute right-4 top-14 w-72 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-80 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 mb-2">Notificaciones</p>
            {notifications.length === 0 ? <p className="text-gray-500 text-sm">Sin notificaciones</p> :
              notifications.slice(0, 15).map(n => (
                <div key={n.id} className={`py-2.5 border-b border-gray-800 last:border-0 ${!n.is_read ? 'opacity-100' : 'opacity-50'}`}>
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.message}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{formatDate(n.created_at)}</p>
                </div>
              ))
            }
          </div>
        )}
        {showAccount && (
          <UserAccountPanel
            profile={profile}
            member={member}
            onClose={() => setShowAccount(false)}
            onLogout={onLogout}
            onRefresh={loadData}
          />
        )}
      </header>

      {/* TOP NAV — solo desktop */}
      <nav className="hidden md:block lm-nav border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 py-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800 lm-tab-inactive'}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <PullToRefresh onRefresh={loadData}>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        {loading ? <PageSkeleton /> : (
          <>
            {tab === 'home'     && <UserHome member={member} payments={payments} profile={profile} attendance={attendance} streakOptions={streakOptions} onNavigate={setTab} />}
            {tab === 'payments' && <UserPayments payments={payments} member={member} onRefresh={loadData} />}
            {tab === 'body'     && <UserBody measurements={measurements} photos={photos} member={member} onRefresh={loadData} />}
            {tab === 'streak'   && <UserStreak attendance={attendance} member={member} payments={payments} onRefresh={loadData} profile={profile} streakOptions={streakOptions} />}
            {tab === 'plans'    && <UserPlans plans={plans} currentPlanId={member?.plan_id} />}
          </>
        )}
      </main>
      </PullToRefresh>

      {/* BOTTOM NAV — solo móvil, estilo app nativa */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 lm-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 max-w-2xl mx-auto">
          {tabs.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 active:scale-90 transition-transform"
              >
                <span className={`absolute top-0 h-0.5 w-8 rounded-full transition-all ${active ? 'bg-brand-500' : 'bg-transparent'}`} />
                <t.icon
                  className={`w-5 h-5 transition-colors ${active ? 'text-brand-400' : 'text-gray-500'}`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-brand-400' : 'text-gray-600'}`}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

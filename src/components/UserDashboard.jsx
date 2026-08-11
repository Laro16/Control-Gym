import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bell, Sun, Moon, LogOut, Home, CreditCard,
  TrendingUp, Calendar, ClipboardList, X
} from 'lucide-react'
import { playNotifSound } from '../App'
import {
  supabase,
  getMemberByProfile, getPayments, getMeasurements,
  getProgressPhotos, getAttendance, getNotifications,
  markAllNotificationsRead, getPlans
} from '../supabase'
import { formatDate, setGymTimeZone, today } from '../utils/helpers'
import { PageSkeleton, PullToRefresh, toast } from './shared'
import { applyGymTheme } from '../utils/theme'
import { UserHome } from './UserHome'
import { UserPayments } from './UserPayments'
import { UserBody } from './UserBody'
import { UserStreak } from './UserStreak'
import { UserPlans } from './UserPlans'
import { UserAccountPanel } from './UserAccount'
import { GymBrand } from './GymBrand'

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
  const [gym, setGym]                 = useState(null)
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
    const firstError = mem.error || pl.error || notifs.error
    if (firstError) toast.error(firstError.message || 'No se pudieron cargar todos tus datos')

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
      const detailError = pay.error || meas.error || ph.error || att.error
      if (detailError) toast.error(detailError.message || 'Parte de tu información no pudo cargarse')
    } else {
      setPayments([])
      setMeasurements([])
      setPhotos([])
      setAttendance([])
    }
    setLoading(false)

    // Datos del gimnasio del miembro: logo + config de racha
    const { data: gymData, error: gymError } = await supabase
      .from('gyms').select('name, logo_url, whatsapp_number, closed_weekdays, holidays, primary_color, timezone').eq('id', profile.gym_id).single()
    setGym(gymData || null)
    setGymLogo(gymData?.logo_url || null)
    applyGymTheme(gymData?.primary_color)
    if (gymData?.timezone) setGymTimeZone(gymData.timezone)
    if (gymError) toast.error(gymError.message || 'No se pudo cargar la configuración del gimnasio')
    if (gymData) setStreakOptions({
      closedWeekdays: gymData.closed_weekdays || [0, 6],
      holidays: Array.isArray(gymData.holidays) ? gymData.holidays : [],
    })
  }, [profile.id, profile.gym_id])

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

  const toggleNotifications = async () => {
    const opening = !showNotifs
    setShowNotifs(opening)
    setShowAccount(false)
    if (!opening || unread === 0) return
    const { error } = await markAllNotificationsRead(profile.id)
    if (error) {
      toast.error(error.message || 'No se pudieron marcar las notificaciones')
      return
    }
    setNotifications(current => current.map(notification => ({ ...notification, is_read: true })))
  }

  const tabs = [
    { id: 'home',       label: 'Inicio',    icon: Home },
    { id: 'payments',   label: 'Pagos',     icon: CreditCard },
    { id: 'body',       label: 'Cuerpo',    icon: TrendingUp },
    { id: 'streak',     label: 'Racha',     icon: Calendar },
    { id: 'plans',      label: 'Planes',    icon: ClipboardList },
  ]
  const mobileTabs = [tabs[1], tabs[2], tabs[0], tabs[3], tabs[4]]

  if (!loading && member && member.status !== 'active') {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-5">
        <div className="card w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Membresía inactiva</h1>
          <p className="text-sm text-gray-500 mt-2 mb-5">
            Tu acceso fue desactivado. Contacta a la recepción del gimnasio para solicitar la reactivación.
          </p>
          <button className="btn-secondary w-full" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      <header className="member-header bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/70 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-2 min-h-[65px]">
          <GymBrand
            logoUrl={gymLogo}
            gymName={gym?.name}
            areaLabel="Área de miembros"
            onLogoError={() => setGymLogo(null)}
          />
          <div className="flex items-center gap-1">
            {/* Modo claro/oscuro */}
            <button className="btn-ghost p-2" onClick={onToggleDark} title={darkMode ? "Modo claro" : "Modo oscuro"}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {/* Notificaciones */}
            <button className="relative btn-ghost p-2" onClick={toggleNotifications}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {/* Avatar / cuenta */}
            <button className="btn-ghost p-0.5 rounded-full" onClick={() => { setShowAccount(!showAccount); setShowNotifs(false) }} aria-label="Abrir mi cuenta">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-9 h-9 rounded-full object-cover border-2 border-brand-500/50" />
                : <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
                    <span className="text-brand-400 text-sm font-bold">{profile.full_name?.[0]?.toUpperCase()}</span>
                  </div>
              }
            </button>
          </div>
        </div>
        {showNotifs && (
          <div className="fixed left-2 right-2 top-[4.5rem] sm:absolute sm:left-auto sm:right-4 sm:top-16 sm:w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-[calc(100dvh-5rem)] overflow-y-auto">
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
      </header>

      {/* Fuera del header: backdrop-filter del encabezado convierte a sus hijos
          fixed en elementos relativos al propio header en algunos Android. */}
      {showAccount && (
        <UserAccountPanel
          profile={profile}
          member={member}
          onClose={() => setShowAccount(false)}
          onLogout={onLogout}
          onRefresh={loadData}
        />
      )}

      {/* TOP NAV — solo desktop */}
      <nav className="hidden md:block lm-nav border-b border-gray-800 sticky top-[65px] z-30">
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
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-32 md:pt-6 md:pb-6">
        {loading ? <PageSkeleton /> : (
          <>
            {tab === 'home'     && <UserHome member={member} payments={payments} profile={profile} attendance={attendance} streakOptions={streakOptions} onNavigate={switchTab} />}
            {tab === 'payments' && <UserPayments payments={payments} member={member} gym={gym} onRefresh={loadData} />}
            {tab === 'body'     && <UserBody measurements={measurements} photos={photos} member={member} onRefresh={loadData} />}
            {tab === 'streak'   && <UserStreak attendance={attendance} member={member} payments={payments} onRefresh={loadData} profile={profile} streakOptions={streakOptions} />}
            {tab === 'plans'    && <UserPlans plans={plans} currentPlanId={member?.plan_id} />}
          </>
        )}
      </main>
      </PullToRefresh>

      {/* BOTTOM NAV — solo móvil, estilo app nativa */}
      <nav
        className="md:hidden fixed left-3 right-3 z-40 bg-gray-900/95 backdrop-blur-xl border border-gray-700/80 rounded-[24px] shadow-2xl shadow-black/40 lm-nav"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 max-w-2xl mx-auto h-16 px-1">
          {mobileTabs.map(t => {
            const active = tab === t.id
            const primary = t.id === 'home'
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-transform"
              >
                {primary ? (
                  <>
                    <span className={`member-nav-primary w-14 h-14 -mt-7 rounded-[20px] flex items-center justify-center border-4 border-gray-950 shadow-xl transition-all ${
                      active ? 'bg-brand-500 text-white shadow-brand-500/30' : 'bg-gray-800 text-gray-400'
                    }`}>
                      <t.icon className="w-6 h-6" strokeWidth={2.4} />
                    </span>
                    <span className={`text-[10px] font-semibold -mt-0.5 ${active ? 'text-brand-400' : 'text-gray-500'}`}>{t.label}</span>
                  </>
                ) : (
                  <>
                    <t.icon
                      className={`w-5 h-5 transition-colors ${active ? 'text-brand-400' : 'text-gray-500'}`}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    <span className={`text-[10px] font-medium transition-colors ${active ? 'text-brand-400' : 'text-gray-600'}`}>
                      {t.label}
                    </span>
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${active ? 'bg-brand-500' : 'bg-transparent'}`} />
                  </>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

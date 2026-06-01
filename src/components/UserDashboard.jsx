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
import { Spinner } from './shared'
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

    // Logo del gimnasio
    const { data: gymData } = await supabase.from('gyms').select('logo_url').limit(1).single()
    if (gymData?.logo_url) setGymLogo(gymData.logo_url)
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  // Sonar cuando llegan nuevas notificaciones
  const unread = notifications.filter(n => !n.is_read).length
  useEffect(() => {
    if (unread > prevNotifsCount.current) playNotifSound()
    prevNotifsCount.current = unread
  }, [unread])

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

      {/* BOTTOM NAV (mobile) / TOP NAV (desktop) */}
      <nav className="lm-nav border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 py-1 overflow-x-auto no-scrollbar">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800 lm-tab-inactive'}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {loading ? <Spinner /> : (
          <>
            {tab === 'home'     && <UserHome member={member} payments={payments} profile={profile} attendance={attendance} onNavigate={setTab} />}
            {tab === 'payments' && <UserPayments payments={payments} member={member} onRefresh={loadData} />}
            {tab === 'body'     && <UserBody measurements={measurements} photos={photos} member={member} onRefresh={loadData} />}
            {tab === 'streak'   && <UserStreak attendance={attendance} member={member} payments={payments} onRefresh={loadData} profile={profile} />}
            {tab === 'plans'    && <UserPlans plans={plans} currentPlanId={member?.plan_id} />}
          </>
        )}
      </main>
    </div>
  )
}

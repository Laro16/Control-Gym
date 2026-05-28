import { useState, useEffect, useCallback } from 'react'
import {
  Dumbbell, Bell, Sun, Moon, LogOut, Home, Users,
  CreditCard, Layers, FileText, X
} from 'lucide-react'
import { playNotifSound } from '../App'
import {
  getMembers, getPayments, getPlans, getNotifications,
  markAllNotificationsRead
} from '../supabase'
import { formatDate, today } from '../utils/helpers'
import { Spinner } from './shared'
import { AdminOverview } from './AdminOverview'
import { AdminMembers } from './AdminMembers'
import { AdminPayments } from './AdminPayments'
import { AdminPlans } from './AdminPlans'
import { AdminReports } from './AdminReports'

export function AdminDashboard({ profile, onLogout, darkMode, onToggleDark }) {
  const [tab, setTab]             = useState('overview')
  const [members, setMembers]     = useState([])
  const [payments, setPayments]   = useState([])
  const [plans, setPlans]         = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [m, p, pl, n] = await Promise.all([
      getMembers(), getPayments(), getPlans(),
      getNotifications(profile.id)
    ])
    setMembers(m.data || [])
    setPayments(p.data || [])
    setPlans(pl.data || [])
    setNotifications(n.data || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => { loadData() }, [loadData])

  const unread = notifications.filter(n => !n.is_read).length

  const tabs = [
    { id: 'overview', label: 'Inicio',   icon: Home },
    { id: 'members',  label: 'Miembros', icon: Users },
    { id: 'payments', label: 'Pagos',    icon: CreditCard },
    { id: 'plans',    label: 'Planes',   icon: Layers },
    { id: 'reports',  label: 'Reportes', icon: FileText },
  ]

  const handleBell = () => {
    setShowNotifs(p => !p)
    setShowProfile(false)
    if (!showNotifs && unread > 0) {
      markAllNotificationsRead(profile.id)
      playNotifSound()
    }
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">

      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand-500" />
            <span className="font-display text-xl tracking-wide text-white">
              {import.meta.env.VITE_GYM_NAME || 'GymApp'}
            </span>
            <span className="hidden sm:inline text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>

          {/* Botones header */}
          <div className="flex items-center gap-1">

            {/* Modo claro/oscuro */}
            <button
              className="btn-ghost p-2"
              onClick={onToggleDark}
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {darkMode
                ? <Sun className="w-4 h-4 text-yellow-400" />
                : <Moon className="w-4 h-4" />
              }
            </button>

            {/* Notificaciones */}
            <button className="relative btn-ghost p-2" onClick={handleBell}>
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Avatar admin */}
            <button
              className="btn-ghost p-1"
              onClick={() => { setShowProfile(p => !p); setShowNotifs(false) }}
              title="Mi perfil"
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover ring-2 ring-brand-500/30" />
                : <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-brand-400">{profile.full_name?.[0]?.toUpperCase()}</span>
                  </div>
              }
            </button>
          </div>
        </div>

        {/* Dropdown notificaciones */}
        {showNotifs && (
          <div
            className="absolute right-4 top-14 w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-96 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-300">Notificaciones</h4>
              <button
                onClick={() => { markAllNotificationsRead(profile.id); setShowNotifs(false); loadData() }}
                className="text-xs text-gray-500 hover:text-white"
              >
                Marcar leídas
              </button>
            </div>
            {notifications.length === 0
              ? <p className="text-gray-500 text-sm py-2">Sin notificaciones</p>
              : notifications.slice(0, 20).map(n => (
                <div key={n.id} className={`py-2.5 border-b border-gray-800 last:border-0 ${!n.is_read ? '' : 'opacity-40'}`}>
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.message}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{formatDate(n.created_at)}</p>
                </div>
              ))
            }
          </div>
        )}

        {/* Dropdown perfil admin */}
        {showProfile && (
          <div
            className="absolute right-4 top-14 w-64 card border border-gray-700 shadow-2xl z-50 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-800">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <span className="font-bold text-brand-400">{profile.full_name?.[0]?.toUpperCase()}</span>
                  </div>
              }
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{profile.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                <span className="text-[10px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full">Admin</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 text-sm py-2 px-1 rounded-lg hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* ── NAV TABS ─────────────────────────────────────── */}
      <nav className="bg-gray-900/50 border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── CONTENIDO ────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {loading ? <Spinner /> : (
          <>
            {tab === 'overview' && (
              <AdminOverview
                members={members}
                payments={payments}
                onRefresh={loadData}
                profile={profile}
                onNavigate={a => { if (a === 'refresh') loadData(); else setTab(a) }}
              />
            )}
            {tab === 'members'  && <AdminMembers  members={members} plans={plans} onRefresh={loadData} />}
            {tab === 'payments' && <AdminPayments payments={payments} onRefresh={loadData} profile={profile} />}
            {tab === 'plans'    && <AdminPlans    plans={plans} onRefresh={loadData} />}
            {tab === 'reports'  && <AdminReports  members={members} payments={payments} />}
          </>
        )}
      </main>

    </div>
  )
}

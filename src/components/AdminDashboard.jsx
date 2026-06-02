import { useState, useEffect, useCallback } from 'react'
import {
  Dumbbell, Bell, Sun, Moon, LogOut, Home, Users,
  CreditCard, Layers, FileText, X, Megaphone
} from 'lucide-react'
import { playNotifSound } from '../App'
import {
  supabase,
  getMembers, getPayments, getPlans, getNotifications,
  markAllNotificationsRead, createNotification
} from '../supabase'
import { formatDate, today, getMemberPaymentStatus, daysBetween } from '../utils/helpers'
import { Spinner } from './shared'
import { AdminOverview } from './AdminOverview'
import { AdminMembers } from './AdminMembers'
import { AdminPayments } from './AdminPayments'
import { AdminPlans } from './AdminPlans'
import { AdminReports } from './AdminReports'
import { AdminAnnouncements } from './AdminAnnouncements'
import { AdminAnnouncements } from './AdminAnnouncements'

export function AdminDashboard({ profile, onLogout, darkMode, onToggleDark }) {
  const [tab, setTab]             = useState('overview')
  const [members, setMembers]     = useState([])
  const [payments, setPayments]   = useState([])
  const [plans, setPlans]         = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [gymLogo, setGymLogo]         = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [m, p, pl, n] = await Promise.all([
      getMembers(), getPayments(), getPlans(),
      getNotifications(profile.id)
    ])
    const members  = m.data || []
    const payments  = p.data || []
    setMembers(members)
    setPayments(payments)
    setPlans(pl.data || [])
    setNotifications(n.data || [])
    setLoading(false)

    // ── NOTIFICACIONES AUTOMÁTICAS ─────────────────────────
    // Genera notificaciones para miembros con cuota vencida o próxima a vencer
    // Solo crea una si no existe ya una del mismo tipo en los últimos 3 días
    await generateAutoNotifications(members, payments)

    // Cargar logo del gimnasio
    const { data: gymData } = await supabase.from('gyms').select('logo_url').limit(1).single()
    if (gymData?.logo_url) setGymLogo(gymData.logo_url)
  }, [profile.id])

  // Genera notificaciones automáticas para usuarios
  async function generateAutoNotifications(members, payments) {
    const existingNotifs = await getNotifications(null) // obtenemos todas para verificar duplicados
    const recentNotifKeys = new Set(
      (existingNotifs.data || [])
        .filter(n => daysBetween(n.created_at?.slice(0,10), today()) < 3)
        .map(n => `${n.profile_id}-${n.type}`)
    )

    for (const member of members) {
      const profileId = member.profile_id
      if (!profileId) continue

      const st = getMemberPaymentStatus(member, payments)

      // Cuota vencida
      if (st === 'overdue') {
        const key = `${profileId}-payment_overdue`
        if (!recentNotifKeys.has(key)) {
          await createNotification({
            profile_id: profileId,
            type: 'payment_overdue',
            title: '⚠️ Tu cuota está vencida',
            message: 'Tu mensualidad está vencida. Por favor realiza tu pago para continuar disfrutando del gimnasio.',
          })
          recentNotifKeys.add(key)
        }
      }

      // Cuota próxima a vencer (menos de 5 días)
      if (st === 'due_soon') {
        const key = `${profileId}-payment_due`
        if (!recentNotifKeys.has(key)) {
          const memberPayments = payments.filter(p => p.member_id === member.id && p.status === 'approved')
          const last = memberPayments[0]
          const daysLeft = last ? daysBetween(today(), last.due_date) : 0
          await createNotification({
            profile_id: profileId,
            type: 'payment_due',
            title: '🔔 Tu cuota vence pronto',
            message: `Tu mensualidad vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}. Recuerda realizar tu pago a tiempo.`,
          })
          recentNotifKeys.add(key)
        }
      }
    }
  }

  useEffect(() => { loadData() }, [loadData])

  const unread = notifications.filter(n => !n.is_read).length

  const tabs = [
    { id: 'overview',       label: 'Inicio',    icon: Home },
    { id: 'members',        label: 'Miembros',  icon: Users },
    { id: 'payments',       label: 'Pagos',     icon: CreditCard },
    { id: 'plans',          label: 'Planes',    icon: Layers },
    { id: 'announcements',  label: 'Anuncios',  icon: Megaphone },
    { id: 'reports',        label: 'Reportes',  icon: FileText },
  ]

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop() || 'png'
    const path = `gym-logo.${ext}`
    await supabase.storage.from('logos').remove([path])
    const { error } = await supabase.storage.from('logos').upload(path, file, {
      upsert: true, cacheControl: '1', contentType: file.type
    })
    if (!error) {
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = `${urlData.publicUrl}?v=${Date.now()}`
      await supabase.from('gyms').update({ logo_url: url }).neq('id', '00000000-0000-0000-0000-000000000000')
      setGymLogo(url)
    }
    setUploadingLogo(false)
  }

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
            {/* Subir logo del gimnasio */}
            <label className={`w-full flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm py-2 px-1 rounded-lg hover:bg-brand-500/10 cursor-pointer transition-all mb-1 ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
              <Dumbbell className="w-4 h-4" />
              {uploadingLogo ? 'Subiendo logo...' : 'Cambiar logo del gimnasio'}
              <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
            </label>
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
      <nav className="lm-nav border-b border-gray-800 sticky top-[57px] z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 lm-tab-inactive'}`}
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
            {tab === 'reports'       && <AdminReports       members={members} payments={payments} />}
            {tab === 'announcements' && <AdminAnnouncements profile={profile} />}
          </>
        )}
      </main>

    </div>
  )
}

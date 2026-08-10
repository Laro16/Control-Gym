import { useState, useEffect, useCallback } from 'react'
import {
  Dumbbell, Bell, Sun, Moon, LogOut, Home, Users,
  CreditCard, Layers, FileText, X, Megaphone, BarChart3, Camera, QrCode, CalendarDays, History
} from 'lucide-react'
import { playNotifSound } from '../App'
import {
  supabase,
  getMembers, getPayments, getPlans, getNotifications,
  markAllNotificationsRead, validateImageFile
} from '../supabase'
import { formatDate, setGymTimeZone } from '../utils/helpers'
import { toast, PageSkeleton, PullToRefresh } from './shared'
import { applyGymTheme } from '../utils/theme'
import { AdminOverview } from './AdminOverview'
import { AdminMembers } from './AdminMembers'
import { AdminPayments } from './AdminPayments'
import { AdminPlans } from './AdminPlans'
import { AdminReports } from './AdminReports'
import { AdminAnnouncements } from './AdminAnnouncements'
import { AdminStats } from './AdminStats'
import { CheckInQR } from './CheckInQR'
import { GymSchedule } from './GymSchedule'
import { GymBrand } from './GymBrand'
import { AdminAudit } from './AdminAudit'

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
  const [gym, setGym]                 = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview]     = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [memberListFilter, setMemberListFilter] = useState('all')

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

    const firstError = m.error || p.error || pl.error || n.error
    if (firstError) toast.error(firstError.message || 'No se pudieron cargar todos los datos')

    // Las notificaciones automáticas las genera la función versionada
    // generate_payment_notifications mediante pg_cron.

    // Cargar logo del gimnasio (el propio del admin)
    const { data: gymData, error: gymError } = await supabase
      .from('gyms').select('name, logo_url, whatsapp_number, primary_color, timezone').eq('id', profile.gym_id).single()
    setGym(gymData || null)
    setGymLogo(gymData?.logo_url || null)
    applyGymTheme(gymData?.primary_color)
    if (gymData?.timezone) setGymTimeZone(gymData.timezone)
    if (gymError) toast.error(gymError.message || 'No se pudo cargar la configuración del gimnasio')
  }, [profile.id, profile.gym_id])

  useEffect(() => { loadData() }, [loadData])

  const unread = notifications.filter(n => !n.is_read).length

  const tabs = [
    { id: 'overview',       label: 'Inicio',    icon: Home },
    { id: 'members',        label: 'Miembros',  icon: Users },
    { id: 'payments',       label: 'Pagos',     icon: CreditCard },
    { id: 'plans',          label: 'Planes',    icon: Layers },
    { id: 'stats',          label: 'Estadísticas', icon: BarChart3 },
    { id: 'announcements',  label: 'Anuncios',  icon: Megaphone },
    { id: 'checkin',        label: 'Check-in',  icon: QrCode },
    { id: 'calendar',       label: 'Calendario', icon: CalendarDays },
    { id: 'reports',        label: 'Reportes',  icon: FileText },
    { id: 'audit',          label: 'Bitácora',  icon: History },
  ]

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) { toast.error(validationError); return }
    setAvatarPreview(URL.createObjectURL(file))
    setUploadingAvatar(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${profile.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true, cacheControl: '1', contentType: file.type || 'image/jpeg'
      })
      if (upErr) {
        toast.error('Error al subir: ' + upErr.message)
        setAvatarPreview(null)
      } else {
        await supabase.storage.from('avatars').remove(
          [`${profile.id}/avatar.jpg`, `${profile.id}/avatar.png`, `${profile.id}/avatar.webp`]
            .filter(candidate => candidate !== path)
        )
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        const finalUrl = `${urlData.publicUrl}?v=${Date.now()}`
        const { error: profileError } = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', profile.id)
        if (profileError) throw profileError
        profile.avatar_url = finalUrl
        toast.success('Foto de perfil actualizada')
        loadData()
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
      setAvatarPreview(null)
    }
    setUploadingAvatar(false)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validationError = validateImageFile(file)
    if (validationError) { toast.error(validationError); return }
    setUploadingLogo(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      // Ruta por gimnasio: evita que un gimnasio sobrescriba el logo de otro
      const path = `${profile.gym_id}/logo.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, {
        upsert: true, cacheControl: '1', contentType: file.type
      })
      if (error) throw error

      await supabase.storage.from('logos').remove(
        [`${profile.gym_id}/logo.jpg`, `${profile.gym_id}/logo.png`, `${profile.gym_id}/logo.webp`]
          .filter(candidate => candidate !== path)
      )
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = `${urlData.publicUrl}?v=${Date.now()}`
      const { error: updateError } = await supabase.from('gyms').update({ logo_url: url }).eq('id', profile.gym_id)
      if (updateError) throw updateError
      setGymLogo(url)
      toast.success('Logo del gimnasio actualizado')
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const markNotificationsRead = async () => {
    if (unread === 0) return true
    const { error } = await markAllNotificationsRead(profile.id)
    if (error) {
      toast.error(error.message || 'No se pudieron marcar las notificaciones')
      return false
    }
    setNotifications(current => current.map(notification => ({ ...notification, is_read: true })))
    return true
  }

  const handleBell = async () => {
    setShowNotifs(p => !p)
    setShowProfile(false)
    if (!showNotifs && unread > 0) {
      await markNotificationsRead()
      playNotifSound()
    }
  }

  const handleNavigate = target => {
    if (target === 'refresh') {
      loadData()
      return
    }

    const destination = typeof target === 'string' ? { tab: target } : target
    if (!destination?.tab) return

    if (destination.tab === 'members') {
      setMemberListFilter(destination.memberFilter || 'all')
    }
    setTab(destination.tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (navigator.vibrate) navigator.vibrate(8)
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">

      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="admin-header bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-2 min-h-[65px]">

          {/* Logo */}
          <GymBrand
            logoUrl={gymLogo}
            gymName={gym?.name}
            areaLabel="Administración"
            onLogoError={() => setGymLogo(null)}
          />

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
            className="fixed left-2 right-2 top-[4.5rem] sm:absolute sm:left-auto sm:right-4 sm:top-16 sm:w-80 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-[calc(100dvh-5rem)] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-300">Notificaciones</h4>
              <button
                onClick={async () => { await markNotificationsRead(); setShowNotifs(false) }}
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
            className="fixed left-2 right-2 top-[4.5rem] sm:absolute sm:left-auto sm:right-4 sm:top-16 sm:w-72 card border border-gray-700 shadow-2xl z-50 animate-slide-up max-h-[calc(100dvh-5rem)] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-800">
              {/* Avatar con botón de cámara */}
              <div className="relative flex-shrink-0">
                {(avatarPreview || profile.avatar_url)
                  ? <img
                      src={avatarPreview || profile.avatar_url}
                      alt="avatar"
                      className={`w-12 h-12 rounded-full object-cover transition-opacity ${uploadingAvatar ? 'opacity-40' : ''}`}
                    />
                  : <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center">
                      <span className="font-bold text-brand-400">{profile.full_name?.[0]?.toUpperCase()}</span>
                    </div>
                }
                <label className={`absolute -bottom-1 -right-1 w-6 h-6 bg-brand-500 hover:bg-brand-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-90 transition-all ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingAvatar
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Camera className="w-3 h-3 text-white" />
                  }
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{profile.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                <span className="text-[10px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full">Admin</span>
              </div>
            </div>
            {/* Subir logo del gimnasio */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Logo del gimnasio</p>
                <span className="text-[10px] text-gray-600">Vista previa</span>
              </div>
              <div className="h-32 w-full rounded-2xl bg-white border-2 border-gray-700/80 px-4 py-3 flex items-center justify-center overflow-hidden shadow-inner">
                {gymLogo ? (
                  <img
                    src={gymLogo}
                    alt={`Logo de ${gym?.name || 'gimnasio'}`}
                    className="block max-w-full max-h-full w-auto h-auto object-contain"
                    onError={() => setGymLogo(null)}
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <Dumbbell className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-xs">Sin logo</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-gray-600 mt-2">
                Se mostrará completo y sin recortes. Para un mejor resultado utiliza PNG o WebP con poco espacio alrededor del diseño.
              </p>
            </div>
            <label className={`w-full flex items-center justify-center gap-2 text-brand-400 hover:text-brand-300 text-sm py-2.5 px-3 rounded-xl bg-brand-500/10 hover:bg-brand-500/15 cursor-pointer transition-all mb-2 ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploadingLogo
                ? <span className="w-4 h-4 border-2 border-brand-300/30 border-t-brand-300 rounded-full animate-spin" />
                : <Camera className="w-4 h-4" />
              }
              {uploadingLogo ? 'Subiendo logo...' : 'Cambiar logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
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
      <nav className="admin-nav lm-nav border-b border-gray-800 sticky top-[65px] z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => handleNavigate(t.id)}
                className={`admin-nav-item flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                  ${tab === t.id
                    ? 'admin-nav-active bg-brand-500/10 text-brand-400 border border-brand-500/20'
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
      <PullToRefresh onRefresh={loadData}>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-5 sm:py-7">
        {loading ? <PageSkeleton /> : (
          <>
            {tab === 'overview' && (
              <AdminOverview
                members={members}
                payments={payments}
                onRefresh={loadData}
                profile={profile}
                onNavigate={handleNavigate}
              />
            )}
            {tab === 'members'  && (
              <AdminMembers
                members={members}
                payments={payments}
                plans={plans}
                onRefresh={loadData}
                gymId={profile.gym_id}
                initialFilter={memberListFilter}
              />
            )}
            {tab === 'payments' && <AdminPayments payments={payments} onRefresh={loadData} gym={gym} />}
            {tab === 'plans'    && <AdminPlans plans={plans} members={members} gymId={profile.gym_id} onRefresh={loadData} />}
            {tab === 'stats'         && <AdminStats         members={members} payments={payments} />}
            {tab === 'reports'       && <AdminReports       members={members} payments={payments} />}
            {tab === 'audit'         && <AdminAudit />}
            {tab === 'announcements' && <AdminAnnouncements profileId={profile.id} gymId={profile.gym_id} onRefresh={loadData} />}
            {tab === 'checkin'       && (
              <div className="space-y-8">
                <CheckInQR profile={profile} />
                <GymSchedule profile={profile} />
              </div>
            )}
            {tab === 'calendar'      && <GymSchedule profile={profile} />}
          </>
        )}
      </main>
      </PullToRefresh>

    </div>
  )
}

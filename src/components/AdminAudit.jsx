import { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck, Camera, CreditCard, Dumbbell, History, LogIn,
  Download, Loader2, Megaphone, RefreshCw, Ruler, Search, Settings, ShieldCheck, Users,
} from 'lucide-react'
import { getAuditEvents } from '../audit'
import { generateAuditReportExcel } from '../utils/excelExports'
import { EmptyState, Spinner, toast } from './shared'

const labels = {
  'session.login': 'Inicio de sesión',
  'session.logout': 'Cierre de sesión',
  'account.password_changed': 'Contraseña actualizada',
  'profile.updated': 'Perfil actualizado',
  'profile.avatar_updated': 'Fotografía de perfil actualizada',
  'profile.preferences_updated': 'Preferencias actualizadas',
  'gym.updated': 'Configuración del gimnasio actualizada',
  'member.created': 'Miembro creado',
  'member.updated': 'Miembro actualizado',
  'member.deactivated': 'Miembro desactivado',
  'member.archived': 'Miembro archivado',
  'member.restored': 'Miembro restaurado',
  'plan.created': 'Plan creado',
  'plan.updated': 'Plan actualizado',
  'plan.archived': 'Plan archivado',
  'payment.submitted': 'Pago enviado para revisión',
  'payment.voucher_attached': 'Comprobante adjuntado',
  'payment.approved': 'Pago aprobado',
  'payment.rejected': 'Pago rechazado',
  'payment.cash_registered': 'Pago registrado en recepción',
  'attendance.checked_in': 'Check-in registrado',
  'attendance.manually_added': 'Asistencia agregada manualmente',
  'attendance.manually_removed': 'Asistencia eliminada manualmente',
  'measurement.created': 'Medidas registradas',
  'measurement.updated': 'Medidas actualizadas',
  'measurement.deleted': 'Registro de medidas eliminado',
  'progress_photo.created': 'Foto de progreso agregada',
  'progress_photo.updated': 'Foto de progreso actualizada',
  'progress_photo.deleted': 'Foto de progreso eliminada',
  'announcement.created': 'Anuncio publicado',
  'announcement.updated': 'Anuncio actualizado',
  'announcement.deleted': 'Anuncio eliminado',
}

const fieldLabels = {
  full_name: 'nombre', phone: 'teléfono', dpi: 'DPI', birth_date: 'nacimiento',
  avatar_url: 'fotografía', gender: 'preferencias', name: 'nombre',
  logo_url: 'logotipo', primary_color: 'color', whatsapp_number: 'WhatsApp',
  address: 'dirección', closed_weekdays: 'días de cierre', holidays: 'feriados',
  timezone: 'zona horaria', allow_overdue_checkin: 'regla de cuotas vencidas',
  title: 'título', body: 'contenido', pinned: 'destacado', visible: 'visibilidad',
  expires_at: 'vencimiento', measured_at: 'fecha de medición', photo_date: 'fecha',
}

const categoryFor = action => {
  if (action.startsWith('payment.')) return 'payments'
  if (action.startsWith('attendance.')) return 'attendance'
  if (action.startsWith('measurement.') || action.startsWith('progress_photo.')) return 'progress'
  if (action.startsWith('announcement.')) return 'communications'
  if (action.startsWith('plan.') || action.startsWith('gym.')) return 'settings'
  if (action.startsWith('session.') || action.startsWith('account.')) return 'security'
  return 'members'
}

const categoryMeta = {
  members: { label: 'Miembros', icon: Users, cls: 'text-sky-400 bg-sky-500/10' },
  payments: { label: 'Pagos', icon: CreditCard, cls: 'text-emerald-400 bg-emerald-500/10' },
  attendance: { label: 'Asistencia', icon: CalendarCheck, cls: 'text-orange-400 bg-orange-500/10' },
  progress: { label: 'Progreso', icon: Ruler, cls: 'text-violet-400 bg-violet-500/10' },
  communications: { label: 'Anuncios', icon: Megaphone, cls: 'text-amber-400 bg-amber-500/10' },
  settings: { label: 'Configuración', icon: Settings, cls: 'text-gray-300 bg-gray-500/10' },
  security: { label: 'Acceso', icon: ShieldCheck, cls: 'text-brand-400 bg-brand-500/10' },
}

const filters = [
  { id: 'all', label: 'Todas' },
  ...Object.entries(categoryMeta).map(([id, value]) => ({ id, label: value.label })),
]

const formatEventDate = value => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida'
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

const currency = value => `Q ${Number(value || 0).toFixed(2)}`

const detailText = event => {
  const details = event.details || {}
  const parts = []
  if (details.cycles) parts.push(`${details.cycles} cuota${Number(details.cycles) === 1 ? '' : 's'}`)
  if (details.total != null) parts.push(`Total ${currency(details.total)}`)
  else if (details.amount != null) parts.push(currency(details.amount))
  if (details.method) {
    const method = { cash: 'efectivo', transfer: 'transferencia', deposit: 'depósito' }[details.method] || details.method
    parts.push(`Método: ${method}`)
  }
  if (details.date) parts.push(`Fecha: ${String(details.date)}`)
  if (Array.isArray(details.changed_fields) && details.changed_fields.length) {
    const changed = details.changed_fields
      .filter(field => !['updated_at'].includes(field))
      .map(field => fieldLabels[field] || field.replaceAll('_', ' '))
    if (changed.length) parts.push(`Cambios: ${changed.join(', ')}`)
  }
  return parts.join(' · ')
}

const actorName = event => event.actor_name
  || (event.actor_profile_id ? `Usuario ${event.actor_profile_id.slice(0, 8)}` : 'Sistema')

export function AdminAudit({ gym }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await getAuditEvents()
    setLoading(false)
    if (error) toast.error(error.message || 'No se pudo cargar la bitácora')
    else setEvents(data || [])
  }

  useEffect(() => { load() }, [])

  const visibleEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es')
    return events.filter(event => {
      if (filter !== 'all' && categoryFor(event.action) !== filter) return false
      if (!needle) return true
      const haystack = [
        labels[event.action] || event.action,
        actorName(event), event.actor_email,
        event.details?.target_name, detailText(event),
      ].filter(Boolean).join(' ').toLocaleLowerCase('es')
      return haystack.includes(needle)
    })
  }, [events, filter, query])

  const exportReport = async () => {
    if (exporting || !visibleEvents.length) return
    setExporting(true)
    try {
      await generateAuditReportExcel(visibleEvents, gym)
      toast.success('Reporte de Bitácora descargado')
    } catch (error) {
      console.error('Error al generar reporte de bitácora:', error)
      toast.error(error?.message || 'No se pudo generar el reporte')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <Spinner />
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" /> Bitácora
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Quién realizó cada acción importante y cuándo ocurrió.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={exportReport}
            disabled={exporting || !visibleEvents.length}
          >
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            {exporting ? 'Generando...' : 'Reporte Excel'}
          </button>
          <button className="btn-secondary" onClick={load} disabled={exporting}>
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9"
            placeholder="Buscar por usuario, acción o miembro..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filter === item.id
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          Mostrando {visibleEvents.length} de {events.length} acciones recientes
        </p>
      </div>

      {!visibleEvents.length ? (
        <EmptyState
          icon={History}
          title={events.length ? 'No hay coincidencias' : 'Sin eventos todavía'}
          subtitle={events.length
            ? 'Prueba otro texto o selecciona Todas.'
            : 'Las acciones de usuarios y administradores aparecerán aquí.'}
        />
      ) : (
        <div className="space-y-2">
          {visibleEvents.map(event => {
            const category = categoryMeta[categoryFor(event.action)] || categoryMeta.members
            const Icon = event.action === 'session.login' || event.action === 'session.logout'
              ? LogIn
              : event.action.startsWith('progress_photo.') ? Camera
                : event.action.startsWith('plan.') ? Dumbbell
                  : category.icon
            const target = event.details?.target_name
            const details = detailText(event)
            return (
              <article key={event.id} className="card-hover p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${category.cls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {labels[event.action] || event.action}
                        </p>
                        {target && <p className="text-xs text-brand-300 mt-0.5">Sobre: {target}</p>}
                      </div>
                      <time className="text-[11px] text-gray-600 whitespace-nowrap">
                        {formatEventDate(event.created_at)}
                      </time>
                    </div>
                    {details && <p className="text-xs text-gray-500 mt-1.5">{details}</p>}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 pt-2 border-t border-gray-800/70">
                      <span className="text-xs text-gray-300 font-medium">{actorName(event)}</span>
                      {event.actor_email && <span className="text-[11px] text-gray-600">{event.actor_email}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        event.actor_role === 'admin'
                          ? 'bg-brand-500/10 text-brand-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {event.actor_role === 'admin' ? 'Administrador' : event.actor_role === 'user' ? 'Miembro' : 'Sistema'}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

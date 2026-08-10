import { useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { getAuditEvents } from '../supabase'
import { formatDate } from '../utils/helpers'
import { EmptyState, Spinner, toast } from './shared'

const labels = {
  'member.created': 'Miembro creado',
  'member.updated': 'Miembro actualizado',
  'member.deactivated': 'Miembro desactivado',
  'member.archived': 'Miembro archivado',
  'member.restored': 'Miembro restaurado',
  'plan.created': 'Plan creado',
  'plan.updated': 'Plan actualizado',
  'plan.archived': 'Plan archivado',
  'payment.submitted': 'Pago enviado',
  'payment.voucher_attached': 'Comprobante adjuntado',
  'payment.approved': 'Pago aprobado',
  'payment.rejected': 'Pago rechazado',
  'payment.cash_registered': 'Pago registrado en recepción',
  'attendance.checked_in': 'Check-in registrado',
}

export function AdminAudit() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data, error } = await getAuditEvents()
    setLoading(false)
    if (error) toast.error(error.message || 'No se pudo cargar la bitácora')
    else setEvents(data || [])
  }

  useEffect(() => { load() }, [])

  if (loading) return <Spinner />
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2"><History className="w-5 h-5 text-brand-400" /> Bitácora</h2>
          <p className="text-sm text-gray-500 mt-1">Últimas 200 acciones sensibles registradas por el servidor.</p>
        </div>
        <button className="btn-secondary" onClick={load}><RefreshCw className="w-4 h-4" /> Actualizar</button>
      </div>

      {!events.length ? (
        <EmptyState icon={History} title="Sin eventos todavía" subtitle="Las altas, pagos, planes y check-ins aparecerán aquí." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Acción</th>
                <th className="py-2 pr-4">Entidad</th>
                <th className="py-2">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} className="border-b border-gray-800/70 last:border-0">
                  <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{formatDate(event.created_at)}</td>
                  <td className="py-3 pr-4 text-white font-medium">{labels[event.action] || event.action}</td>
                  <td className="py-3 pr-4 text-gray-400">{event.entity_type}</td>
                  <td className="py-3 text-gray-500 font-mono text-xs break-all">{JSON.stringify(event.details || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

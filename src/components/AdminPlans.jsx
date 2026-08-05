import { useState } from 'react'
import { Plus, Edit2, Trash2, Check, Layers } from 'lucide-react'
import { createPlan, updatePlan, deletePlan } from '../supabase'
import { formatCurrency } from '../utils/helpers'
import { Modal, ConfirmModal, toast } from './shared'

// ── ADMIN PLANES ───────────────────────────────────────────
export function AdminPlans({ plans, members, gymId, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_days: 30, features: '' })
  const [saving, setSaving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(null)

  const openEdit = (plan) => {
    setEditing(plan)
    setForm({
      name: plan.name, description: plan.description || '',
      price: plan.price, duration_days: plan.duration_days,
      features: (plan.features || []).join(', ')
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    const price = Number(form.price)
    const duration = Number(form.duration_days)
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.info('Escribe un nombre y un precio válido')
      return
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 730) {
      toast.info('La duración debe estar entre 1 y 730 días')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(), description: form.description.trim() || null,
      price, duration_days: duration,
      features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : []
    }
    try {
      const { error } = editing
        ? await updatePlan(editing.id, payload)
        : await createPlan(payload, gymId)
      if (error) throw error
      toast.success(editing ? 'Plan actualizado' : 'Plan creado')
      setShowForm(false)
      setEditing(null)
      setForm({ name: '', description: '', price: '', duration_days: 30, features: '' })
      await onRefresh()
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el plan')
    } finally {
      setSaving(false)
    }
  }

  const assignedTo = planId => (members || []).filter(
    member => member.plan_id === planId && member.status !== 'inactive'
  ).length

  const requestArchive = plan => {
    const assigned = assignedTo(plan.id)
    if (assigned > 0) {
      toast.info(`No puedes archivar este plan: tiene ${assigned} miembro${assigned === 1 ? '' : 's'} asignado${assigned === 1 ? '' : 's'}`)
      return
    }
    setConfirmArchive(plan)
  }

  const handleArchive = async () => {
    if (!confirmArchive) return
    const plan = confirmArchive
    setConfirmArchive(null)
    const { error } = await deletePlan(plan.id)
    if (error) {
      toast.error(error.message || 'No se pudo archivar el plan')
      return
    }
    toast.success('Plan archivado')
    await onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Planes</h2>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', duration_days: 30, features: '' }); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo plan
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.id} className="card-hover">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-white">{p.name}</h3>
              <div className="flex gap-1">
                <button className="btn-ghost p-1.5" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5" /></button>
                <button className="btn-danger p-1.5" onClick={() => requestArchive(p)} title="Archivar plan"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <p className="text-2xl font-bold text-brand-400">{formatCurrency(p.price)}</p>
            <p className="text-xs text-gray-500">{p.duration_days} días</p>
            {assignedTo(p.id) > 0 && (
              <p className="text-xs text-gray-400 mt-1">{assignedTo(p.id)} miembro{assignedTo(p.id) === 1 ? '' : 's'} asignado{assignedTo(p.id) === 1 ? '' : 's'}</p>
            )}
            {p.description && <p className="text-sm text-gray-400 mt-2">{p.description}</p>}
            {p.features?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {p.features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Sin planes creados
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Editar plan' : 'Nuevo plan'}>
        <div className="space-y-3">
          <div><label className="label">Nombre *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Descripción</label>
            <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Precio (Q) *</label>
              <input type="number" step="0.01" className="input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><label className="label">Duración (días)</label>
              <input type="number" className="input" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} /></div>
          </div>
          <div><label className="label">Beneficios (separados por coma)</label>
            <input className="input" placeholder="Acceso 24h, Clases grupales, Nutrición" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} /></div>
          <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Actualizar plan' : 'Crear plan'}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={handleArchive}
        message={`¿Archivar el plan ${confirmArchive?.name || ''}? Ya no aparecerá para nuevas asignaciones.`}
      />
    </div>
  )
}

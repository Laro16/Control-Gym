import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Pin, Eye, EyeOff, Check, X } from 'lucide-react'
import {
  getAdminAnnouncements, createAnnouncement,
  updateAnnouncement, deleteAnnouncement
} from '../supabase'
import { formatDate, today } from '../utils/helpers'
import { Modal, toast } from './shared'

const EMOJIS = ['📢','🏋️','💪','🔥','⚡','🏆','🎉','⚠️','✅','🆕','📅','🎯']

function AnnouncementForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title:      initial?.title      || '',
    body:       initial?.body       || '',
    emoji:      initial?.emoji      || '📢',
    pinned:     initial?.pinned     || false,
    expires_at: initial?.expires_at || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        expires_at: form.expires_at || null,
      })
      onClose()
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el anuncio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Selector de emoji */}
      <div>
        <label className="label">Ícono</label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setForm(f => ({ ...f, emoji: e }))}
              className={`text-xl w-10 h-10 rounded-xl flex items-center justify-center transition-all
                ${form.emoji === e
                  ? 'bg-brand-500/20 ring-2 ring-brand-500/50 scale-110'
                  : 'bg-gray-800/50 hover:bg-gray-700'}`}
            >{e}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Título *</label>
        <input
          className="input"
          placeholder="Ej: Cierre por feriado"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div>
        <label className="label">Mensaje *</label>
        <textarea
          className="input"
          rows={3}
          placeholder="Escribe el detalle del anuncio..."
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Expira el (opcional)</label>
          <input
            type="date"
            className="input"
            min={today()}
            value={form.expires_at}
            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
          />
          <p className="text-[10px] text-gray-600 mt-1">Dejar vacío = sin expiración</p>
        </div>
        <div className="flex flex-col justify-center">
          <label className="label">Opciones</label>
          <button
            onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all
              ${form.pinned
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'}`}
          >
            <Pin className="w-4 h-4" />
            {form.pinned ? 'Fijado arriba' : 'Fijar arriba'}
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button
          className="btn-primary flex-1"
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.body.trim()}
        >
          {saving
            ? <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </span>
            : <><Check className="w-4 h-4" /> {initial ? 'Actualizar' : 'Publicar'}</>
          }
        </button>
      </div>
    </div>
  )
}

export function AdminAnnouncements({ profileId, gymId, onRefresh }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  // Admin ve TODOS los anuncios (incluso ocultos y expirados)
  const load = async () => {
    setLoading(true)
    const { data, error } = await getAdminAnnouncements()
    setAnnouncements(data || [])
    setLoading(false)
    if (error) toast.error(error.message || 'No se pudieron cargar los anuncios')
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (form) => {
    const { error } = await createAnnouncement({ ...form, created_by: profileId }, gymId)
    if (error) throw error
    toast.success('Anuncio publicado')
    await load()
    if (onRefresh) await onRefresh()
  }

  const handleUpdate = async (form) => {
    const { error } = await updateAnnouncement(editing.id, form)
    if (error) throw error
    toast.success('Anuncio actualizado')
    await load()
  }

  const handleToggleVisible = async (ann) => {
    const { error } = await updateAnnouncement(ann.id, { visible: !ann.visible })
    if (error) { toast.error(error.message || 'No se pudo cambiar la visibilidad'); return }
    await load()
  }

  const handleTogglePin = async (ann) => {
    const { error } = await updateAnnouncement(ann.id, { pinned: !ann.pinned })
    if (error) { toast.error(error.message || 'No se pudo fijar el anuncio'); return }
    await load()
  }

  const handleDelete = async (id) => {
    const { error } = await deleteAnnouncement(id)
    if (error) { toast.error(error.message || 'No se pudo eliminar el anuncio'); return }
    setConfirmDel(null)
    toast.success('Anuncio eliminado')
    await load()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Anuncios</h2>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo anuncio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="w-6 h-6 border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <span className="text-5xl block mb-3">📢</span>
          <p className="font-medium">Sin anuncios publicados</p>
          <p className="text-xs mt-1 text-gray-600">Crea el primero para que tus clientes lo vean</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div
              key={a.id}
              className={`card transition-all ${!a.visible ? 'opacity-50' : ''} ${a.pinned ? 'border-brand-500/30' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{a.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{a.title}</p>
                    {a.pinned && (
                      <span className="text-[10px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Pin className="w-2.5 h-2.5" /> Fijado
                      </span>
                    )}
                    {!a.visible && (
                      <span className="text-[10px] bg-gray-700/50 text-gray-500 px-1.5 py-0.5 rounded-full">Oculto</span>
                    )}
                    {a.expires_at && (
                      <span className="text-[10px] text-gray-500">Expira: {formatDate(a.expires_at)}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{a.body}</p>
                  <p className="text-[10px] text-gray-600 mt-1.5">{formatDate(a.created_at)}</p>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-auto">
                  <button
                    className="btn-ghost p-1.5"
                    title={a.pinned ? 'Desfijar' : 'Fijar arriba'}
                    onClick={() => handleTogglePin(a)}
                  >
                    <Pin className={`w-4 h-4 ${a.pinned ? 'text-brand-400' : ''}`} />
                  </button>
                  <button
                    className="btn-ghost p-1.5"
                    title={a.visible ? 'Ocultar' : 'Mostrar'}
                    onClick={() => handleToggleVisible(a)}
                  >
                    {a.visible
                      ? <Eye className="w-4 h-4" />
                      : <EyeOff className="w-4 h-4" />
                    }
                  </button>
                  <button
                    className="btn-ghost p-1.5"
                    onClick={() => { setEditing(a); setShowForm(true) }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="btn-danger p-1.5"
                    onClick={() => setConfirmDel(a.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing ? 'Editar anuncio' : 'Nuevo anuncio'}
      >
        <AnnouncementForm
          initial={editing}
          onSave={editing ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      </Modal>

      {/* Confirmar eliminar */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal-box p-5" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold mb-2">¿Eliminar anuncio?</p>
            <p className="text-gray-400 text-sm mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn-danger flex-1" onClick={() => handleDelete(confirmDel)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Plus, MessageCircle, Calendar, Check, Copy,
  AlertCircle, Mail, Lock, User, MapPin, Palette, CheckCircle
} from 'lucide-react'
import { provisionGymWithAdmin, listAllGyms } from '../supabase'
import { formatDate } from '../utils/helpers'
import { Modal, Spinner } from './shared'

const COLOR_PRESETS = [
  { name: 'Naranja', value: '#F97316' },
  { name: 'Azul',    value: '#2563EB' },
  { name: 'Verde',   value: '#16A34A' },
  { name: 'Rojo',    value: '#DC2626' },
  { name: 'Morado',  value: '#7C3AED' },
  { name: 'Rosa',    value: '#DB2777' },
  { name: 'Cian',    value: '#0891B2' },
  { name: 'Ámbar',   value: '#D97706' },
]

const EMPTY_FORM = {
  gymName: '', whatsapp: '', color: '#F97316', address: '',
  adminName: '', adminEmail: '', adminPassword: '',
}

export function GymOnboarding() {
  const [gyms, setGyms]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const loadGyms = useCallback(async () => {
    setLoading(true)
    const { data } = await listAllGyms()
    setGyms(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadGyms() }, [loadGyms])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-500" />
            Plataforma
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona los gimnasios que rentan la app · {gyms.length} {gyms.length === 1 ? 'gimnasio' : 'gimnasios'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nuevo gimnasio
        </button>
      </div>

      {loading ? <Spinner /> : (
        gyms.length === 0 ? (
          <div className="card text-center py-10">
            <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Aún no hay gimnasios. Crea el primero.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {gyms.map(g => (
              <div key={g.id} className="card">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${g.primary_color || '#F97316'}22` }}
                  >
                    {g.logo_url
                      ? <img src={g.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain" />
                      : <Building2 className="w-5 h-5" style={{ color: g.primary_color || '#F97316' }} />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{g.name}</p>
                    <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                      {g.whatsapp_number && (
                        <p className="flex items-center gap-1.5">
                          <MessageCircle className="w-3 h-3" /> {g.whatsapp_number}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Desde {formatDate(g.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <NewGymModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={loadGyms}
      />
    </div>
  )
}

// ── MODAL: CREAR GIMNASIO + ADMIN ──────────────────────────
function NewGymModal({ open, onClose, onCreated }) {
  const [form, setForm]       = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [created, setCreated] = useState(null) // {gym, credentials}
  const [copied, setCopied]   = useState(false)

  const reset = () => {
    setForm(EMPTY_FORM); setError(''); setCreated(null); setCopied(false)
  }

  const close = () => { reset(); onClose() }

  const handleCreate = async () => {
    if (!form.gymName || !form.adminName || !form.adminEmail || !form.adminPassword) {
      setError('Nombre del gimnasio, y nombre/email/contraseña del admin son obligatorios')
      return
    }
    if (form.adminPassword.length < 6) {
      setError('La contraseña del admin debe tener al menos 6 caracteres')
      return
    }
    setLoading(true); setError('')

    const { data, error: err } = await provisionGymWithAdmin({
      gymName: form.gymName.trim(),
      whatsapp: form.whatsapp.trim() || null,
      color: form.color,
      address: form.address.trim() || null,
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim().toLowerCase(),
      adminPassword: form.adminPassword,
    })

    if (err) {
      setError(
        err.message?.toLowerCase().includes('already')
          ? 'Ese email de admin ya está registrado. Usa otro.'
          : err.message || 'No se pudo crear el gimnasio'
      )
      setLoading(false)
      return
    }

    setCreated({
      gym: data.gym,
      email: form.adminEmail.trim().toLowerCase(),
      password: form.adminPassword,
    })
    setLoading(false)
    onCreated()
  }

  const copyCreds = async () => {
    if (!created) return
    const text =
      `Gimnasio: ${created.gym.name}\n` +
      `Acceso de administrador\n` +
      `Email: ${created.email}\n` +
      `Contraseña: ${created.password}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard no disponible */ }
  }

  return (
    <Modal open={open} onClose={close} title={created ? 'Gimnasio creado' : 'Nuevo gimnasio'}>
      {created ? (
        // ── ÉXITO: mostrar credenciales para entregar al cliente ──
        <div className="space-y-4">
          <div className="text-center py-2">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-white">¡{created.gym.name} está listo!</p>
            <p className="text-sm text-gray-400 mt-1">
              Entrega estas credenciales al dueño del gimnasio
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Email</span>
              <span className="text-white font-medium">{created.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Contraseña</span>
              <span className="text-white font-medium font-mono">{created.password}</span>
            </div>
          </div>

          <button className="btn-secondary w-full" onClick={copyCreds}>
            {copied
              ? <><Check className="w-4 h-4" /> Copiado</>
              : <><Copy className="w-4 h-4" /> Copiar credenciales</>
            }
          </button>

          <div className="flex items-center gap-2 text-yellow-400/90 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            La contraseña no se vuelve a mostrar. Cópiala ahora.
          </div>

          <div className="flex gap-3 pt-1">
            <button className="btn-secondary flex-1" onClick={close}>Cerrar</button>
            <button className="btn-primary flex-1" onClick={reset}>Crear otro</button>
          </div>
        </div>
      ) : (
        // ── FORMULARIO ──
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos del gimnasio</p>
            <div className="space-y-3">
              <div>
                <label className="label">Nombre del gimnasio *</label>
                <input className="input" placeholder="Gimnasio Olimpo"
                  value={form.gymName} onChange={e => setForm({ ...form, gymName: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp del gimnasio</label>
                <input className="input" placeholder="50212345678"
                  value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Dirección (opcional)</label>
                <input className="input" placeholder="Zona 10, Ciudad de Guatemala"
                  value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Color principal</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COLOR_PRESETS.map(c => (
                    <button key={c.value} title={c.name}
                      onClick={() => setForm({ ...form, color: c.value })}
                      className={`w-7 h-7 rounded-lg transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c.value }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Administrador del gimnasio</p>
            <div className="space-y-3">
              <div>
                <label className="label flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Nombre del admin *</label>
                <input className="input" placeholder="Carlos Pérez"
                  value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email del admin *</label>
                <input type="email" className="input" placeholder="admin@gimnasio.com"
                  value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Contraseña inicial *</label>
                <input type="text" className="input" placeholder="Mínimo 6 caracteres"
                  value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} />
                <p className="text-[11px] text-gray-600 mt-1">El admin podrá cambiarla después.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn-secondary flex-1" onClick={close} disabled={loading}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando...</span>
                : <><Building2 className="w-4 h-4" /> Crear gimnasio</>
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

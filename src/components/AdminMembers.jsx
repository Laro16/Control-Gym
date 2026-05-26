import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, CreditCard, Bell, ChevronRight,
  Plus, Edit2, Trash2, Check, X, Download, FileText, FileSpreadsheet,
  Dumbbell, TrendingUp, TrendingDown, Minus, Camera, Calendar,
  LogOut, Home, ClipboardList, MessageCircle, Eye,
  AlertCircle, CheckCircle, Clock, Banknote, AlertTriangle, Layers,
  Sun, Moon, Lock, Flame, Trophy, Star
} from 'lucide-react'
import { playNotifSound, playAchievementSound } from '../App'
import {
  supabase, adminCreateUser,
  getMembers, getPayments, getMeasurements, getProgressPhotos,
  createPayment, updatePayment, createMeasurement,
  updateMember, deleteMember, getPlans, createPlan, updatePlan,
  deletePlan, uploadVoucher, getNotifications, markAllNotificationsRead,
  createNotification, getMemberByProfile, getAttendance,
  markAttendance, removeAttendance, uploadProgressPhoto, createProgressPhoto
} from '../supabase'
import {
  formatDate, formatCurrency, getPaymentStatus, paymentStatusLabel,
  approvalStatusLabel, measurementFields, getMeasurementDiff,
  displayValue, getMeasurementComment, daysBetween,
  generatePaymentPDF, generatePaymentHistoryPDF, generatePaymentHistoryExcel,
  generateMasterExcel, today, addDays, calculateStreak
} from '../utils/helpers'
import { sendVoucherToAdmin, sendPaymentReminder } from '../utils/whatsapp'
import { Modal, ConfirmModal, Spinner } from './shared'

// ── ADMIN MEMBERS ──────────────────────────────────────────
export function AdminMembers({ members, plans, onRefresh }) {
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = members.filter(m =>
    m.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.profile?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (memberId) => {
    await deleteMember(memberId)
    onRefresh()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="section-title">Miembros</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Nuevo miembro
        </button>
      </div>

      <input
        className="input"
        placeholder="Buscar por nombre o email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="space-y-3">
        {filtered.map(m => (
          <div key={m.id} className="card-hover">
            <div className="flex items-center justify-between gap-3">
              <button
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => setSelected(selected?.id === m.id ? null : m)}
              >
                <div className="w-10 h-10 bg-brand-500/10 border border-brand-500/20 rounded-xl flex-shrink-0 flex items-center justify-center">
                  <span className="font-bold text-brand-400">{m.profile?.full_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{m.profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{m.profile?.email} · {m.plan?.name || 'Sin plan'}</p>
                </div>
              </button>
              <div className="flex items-center gap-1">
                <span className={m.status === 'active' ? 'badge-green' : 'badge-gray'}>
                  {m.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
                <button className="btn-ghost p-1.5" onClick={() => setSelected(m)}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="btn-danger p-1.5" onClick={() => setConfirmDelete(m.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selected?.id === m.id && (
              <MemberDetail member={m} plans={plans} onRefresh={onRefresh} onClose={() => setSelected(null)} />
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No se encontraron miembros
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        message="¿Eliminar este miembro? Esta acción no se puede deshacer."
      />

      <CreateMemberModal open={showCreate} onClose={() => { setShowCreate(false); onRefresh() }} plans={plans} />
    </div>
  )
}

// ── MEMBER DETAIL (dentro del admin) ──────────────────────
function MemberDetail({ member, plans, onRefresh, onClose }) {
  const [tab, setTab] = useState('info')
  const [measurements, setMeasurements] = useState([])
  const [photos, setPhotos] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [showMeasForm, setShowMeasForm] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoadingData(true)
      const [m, p] = await Promise.all([
        getMeasurements(member.id),
        getProgressPhotos(member.id)
      ])
      setMeasurements(m.data || [])
      setPhotos(p.data || [])
      setLoadingData(false)
    }
    load()
  }, [member.id])

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'measures', label: 'Medidas' },
    { id: 'photos', label: 'Fotos' },
  ]

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${tab === t.id ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-500 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingData && <div className="py-4 text-center text-gray-500 text-sm">Cargando...</div>}

      {!loadingData && tab === 'info' && (
        <EditMemberForm member={member} plans={plans} onSave={async (updates) => {
          await updateMember(member.id, updates)
          onRefresh()
        }} />
      )}

      {!loadingData && tab === 'measures' && (
        <div className="space-y-3">
          <button className="btn-primary text-sm" onClick={() => setShowMeasForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Agregar medidas
          </button>
          {measurements.slice(0, 6).map((m, i) => (
            <MeasurementCard key={m.id} current={m} previous={measurements[i + 1]} />
          ))}
          {measurements.length === 0 && <p className="text-gray-500 text-sm">Sin medidas registradas</p>}
          <Modal open={showMeasForm} onClose={() => setShowMeasForm(false)} title="Nueva medición">
            <MeasurementForm memberId={member.id} onSave={async (data) => {
              await createMeasurement({ ...data, member_id: member.id })
              const m = await getMeasurements(member.id)
              setMeasurements(m.data || [])
              setShowMeasForm(false)
            }} />
          </Modal>
        </div>
      )}

      {!loadingData && tab === 'photos' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(p => (
              <div key={p.id} className="relative rounded-xl overflow-hidden aspect-square bg-gray-800">
                <img src={p.photo_url} alt="progreso" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-[10px] text-white">{formatDate(p.photo_date)}</p>
                  <p className="text-[10px] text-gray-300">{p.angle}</p>
                </div>
              </div>
            ))}
          </div>
          {photos.length === 0 && <p className="text-gray-500 text-sm">Sin fotos de progreso</p>}
        </div>
      )}
    </div>
  )
}

function EditMemberForm({ member, plans, onSave }) {
  const [form, setForm] = useState({
    status: member.status || 'active',
    plan_id: member.plan_id || '',
    start_date: member.start_date || today(),
    emergency_contact: member.emergency_contact || '',
    notes: member.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Estado</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
        <div>
          <label className="label">Plan</label>
          <select className="input" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">Sin plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Fecha de inicio</label>
        <input type="date" className="input" value={form.start_date}
          onChange={e => setForm({ ...form, start_date: e.target.value })} />
      </div>
      <div>
        <label className="label">Contacto de emergencia</label>
        <input className="input" value={form.emergency_contact}
          placeholder="Nombre y teléfono"
          onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
      </div>
      <div>
        <label className="label">Notas internas</label>
        <textarea className="input" rows={2} value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : saved ? <><Check className="w-4 h-4" /> Guardado</> : 'Guardar cambios'}
      </button>
    </div>
  )
}

function MeasurementCard({ current, previous }) {
  // Recopilar comentarios de progreso
  const comments = []
  if (previous) {
    measurementFields.forEach(f => {
      const diff = getMeasurementDiff(current, previous, f.key)
      if (diff !== null && diff !== 0) {
        const comment = getMeasurementComment(f, diff)
        if (comment) comments.push(comment)
      }
    })
  }

  const weightLbs = current.weight_kg ? (current.weight_kg * 2.20462).toFixed(1) : null

  return (
    <div className="card text-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-white">{formatDate(current.measured_at)}</p>
        {weightLbs && <span className="badge-gray">{weightLbs} lbs</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {measurementFields.filter(f => current[f.key]).map(f => {
          const rawDiff = previous ? getMeasurementDiff(current, previous, f.key) : null
          const dispVal = displayValue(f, current[f.key])
          // Para mostrar el diff en la unidad correcta
          const diffDisplay = rawDiff !== null
            ? (f.convert ? (rawDiff * 2.20462).toFixed(1) : rawDiff.toFixed(1))
            : null

          // Color: depende del campo
          const isGoodUp   = ['left_arm_cm','right_arm_cm','left_leg_cm','right_leg_cm','chest_cm'].includes(f.key)
          const isGoodDown  = ['weight_kg','body_fat_pct','waist_cm','hips_cm'].includes(f.key)
          const diffColor = rawDiff === null || rawDiff === 0 ? 'text-gray-500'
            : isGoodDown  ? (rawDiff < 0 ? 'text-emerald-400' : 'text-red-400')
            : isGoodUp    ? (rawDiff > 0 ? 'text-emerald-400' : 'text-red-400')
            : 'text-gray-400'

          return (
            <div key={f.key} className="bg-gray-800/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="font-semibold text-white">{dispVal} <span className="text-xs text-gray-400">{f.unit}</span></p>
              {diffDisplay !== null && rawDiff !== 0 && (
                <p className={`text-xs flex items-center gap-0.5 mt-0.5 ${diffColor}`}>
                  {rawDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Number(diffDisplay) > 0 ? '+' : ''}{diffDisplay} {f.unit}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Comentarios de progreso */}
      {comments.length > 0 && (
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-3 py-2.5 space-y-1">
          {comments.map((c, i) => (
            <p key={i} className="text-xs text-brand-300">{c}</p>
          ))}
        </div>
      )}

      {current.notes && (
        <p className="text-xs text-gray-500 italic">Nota: {current.notes}</p>
      )}
    </div>
  )
}

function MeasurementForm({ memberId, onSave }) {
  // El form guarda en lbs para peso — se convierte a kg al guardar en BD
  const [form, setForm]   = useState({ measured_at: today() })
  const [lbsInput, setLbsInput] = useState({}) // valores en lbs que el usuario escribe
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Convertir peso de lbs a kg antes de guardar
    const toSave = { ...form }
    if (lbsInput.weight_kg) {
      toSave.weight_kg = (parseFloat(lbsInput.weight_kg) / 2.20462).toFixed(2)
    }
    await onSave(toSave)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Fecha de medición</label>
        <input type="date" className="input" value={form.measured_at}
          onChange={e => setForm({ ...form, measured_at: e.target.value })} />
      </div>
      <p className="text-xs text-gray-500">Llena solo los campos que mediste. Deja vacío lo que no midió.</p>
      <div className="grid grid-cols-2 gap-3">
        {measurementFields.map(f => (
          <div key={f.key}>
            <label className="label">{f.label} ({f.unit})</label>
            <input
              type="number" step="0.1" className="input"
              placeholder={`0.0 ${f.unit}`}
              value={f.key === 'weight_kg' ? (lbsInput.weight_kg || '') : (form[f.key] || '')}
              onChange={e => {
                if (f.key === 'weight_kg') {
                  setLbsInput({ ...lbsInput, weight_kg: e.target.value })
                } else {
                  setForm({ ...form, [f.key]: e.target.value })
                }
              }}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="label">Notas del entrenador</label>
        <textarea className="input" rows={2} value={form.notes || ''}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          placeholder="Observaciones del mes, recomendaciones..." />
      </div>
      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saving ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
        ) : 'Guardar medidas'}
      </button>
    </div>
  )
}

function CreateMemberModal({ open, onClose, plans }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
    plan_id: '', start_date: today(), birth_date: '',
    emergency_contact: '', notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name) {
      setError('Nombre, email y contraseña son obligatorios')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')

    // 1) Crear usuario con el cliente admin (NO afecta la sesión del admin actual)
    const { data: authData, error: authErr } = await adminCreateUser(
      form.email,
      form.password,
      form.full_name
    )

    if (authErr) {
      setError(
        authErr.message?.includes('already been registered') || authErr.message?.includes('already registered')
          ? 'Este email ya está registrado. Usa otro email.'
          : authErr.message || 'Error al crear el usuario'
      )
      setLoading(false)
      return
    }

    const userId = authData?.user?.id
    if (!userId) {
      setError('No se pudo crear el usuario. Verifica que VITE_SUPABASE_SERVICE_KEY esté configurada en Vercel.')
      setLoading(false)
      return
    }

    // 2) El trigger crea el perfil automáticamente, pero lo actualizamos con datos extra
    await new Promise(r => setTimeout(r, 800))
    await supabase.from('profiles').upsert({
      id: userId,
      email: form.email,
      full_name: form.full_name,
      phone: form.phone || null,
      birth_date: form.birth_date || null,
      role: 'user'
    })

    // 3) Crear el registro de miembro
    const { error: memErr } = await supabase.from('members').insert({
      profile_id: userId,
      plan_id: form.plan_id || null,
      start_date: form.start_date,
      emergency_contact: form.emergency_contact || null,
      notes: form.notes || null,
    })

    if (memErr) {
      setError(memErr.message.includes('duplicate')
        ? 'Este usuario ya tiene un perfil de miembro.'
        : memErr.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setSuccess(false)
      setStep(1)
      setForm({ full_name: '', email: '', phone: '', password: '', plan_id: '', start_date: today(), birth_date: '', emergency_contact: '', notes: '' })
      onClose()
    }, 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo miembro">
      {success ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-white">¡Miembro creado con éxito!</p>
          <p className="text-sm text-gray-400 mt-1">Ya puede iniciar sesión con su correo y contraseña</p>
        </div>
      ) : (
        <div className="space-y-3">
          {step === 1 && (
            <>
              <div><label className="label">Nombre completo *</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Contraseña temporal *</label>
                <input type="text" className="input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              <div><label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Fecha de nacimiento</label>
                <input type="date" className="input" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
              <button className="btn-primary w-full" onClick={() => { if (!form.email || !form.full_name || !form.password) { setError('Campos obligatorios incompletos'); return } setError(''); setStep(2) }}>
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div><label className="label">Plan</label>
                <select className="input" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
                  <option value="">Sin plan</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>)}
                </select></div>
              <div><label className="label">Fecha de inicio</label>
                <input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">Contacto de emergencia</label>
                <input className="input" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} /></div>
              <div><label className="label">Notas internas</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Atrás</button>
                <button className="btn-primary flex-1" onClick={handleCreate} disabled={loading}>
                  {loading ? 'Creando...' : 'Crear miembro'}
                </button>
              </div>
            </>
          )}
          {step === 1 && error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

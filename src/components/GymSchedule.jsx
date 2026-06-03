import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Plus, Trash2, Check, Save } from 'lucide-react'
import { getMyGym, updateGym } from '../supabase'
import { Spinner } from './shared'
import { formatDate } from '../utils/helpers'

const WEEKDAYS = [
  { i: 1, label: 'Lun' }, { i: 2, label: 'Mar' }, { i: 3, label: 'Mié' },
  { i: 4, label: 'Jue' }, { i: 5, label: 'Vie' }, { i: 6, label: 'Sáb' },
  { i: 0, label: 'Dom' },
]

export function GymSchedule({ profile }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [closed, setClosed]   = useState([])
  const [holidays, setHolidays] = useState([])
  const [newDate, setNewDate]   = useState('')
  const [newLabel, setNewLabel] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getMyGym(profile.gym_id)
    setClosed(data?.closed_weekdays || [])
    setHolidays(Array.isArray(data?.holidays) ? data.holidays : [])
    setLoading(false)
  }, [profile.gym_id])

  useEffect(() => { load() }, [load])

  const toggleDay = (i) => {
    setSaved(false)
    setClosed(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])
  }

  const addHoliday = () => {
    if (!newDate) return
    if (holidays.some(h => h.date === newDate)) return
    setSaved(false)
    setHolidays(prev => [...prev, { date: newDate, label: newLabel.trim() || 'Cerrado' }]
      .sort((a, b) => a.date.localeCompare(b.date)))
    setNewDate(''); setNewLabel('')
  }

  const removeHoliday = (date) => {
    setSaved(false)
    setHolidays(prev => prev.filter(h => h.date !== date))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateGym(profile.gym_id, {
      closed_weekdays: closed,
      holidays,
    })
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5 animate-fade-in max-w-xl">
      <div>
        <h2 className="section-title flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-brand-500" />
          Días cerrados y festivos
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          En estos días la racha de tus miembros nunca se rompe, aunque no asistan.
        </p>
      </div>

      <div className="card space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Días que cierra el gimnasio</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(d => {
            const active = closed.includes(d.i)
            return (
              <button key={d.i} onClick={() => toggleDay(d.i)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  active
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}>
                {d.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-600">Marca los días en que normalmente no abres.</p>
      </div>

      <div className="card space-y-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Festivos / cierres puntuales</p>

        {holidays.length === 0 ? (
          <p className="text-sm text-gray-500 py-1">Aún no agregas festivos.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map(h => (
              <div key={h.date} className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{h.label}</p>
                  <p className="text-xs text-gray-500">{formatDate(h.date)}</p>
                </div>
                <button className="btn-ghost p-2 rounded-lg text-red-400" onClick={() => removeHoliday(h.date)} title="Quitar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input type="date" className="input sm:w-40" value={newDate}
            onChange={e => setNewDate(e.target.value)} />
          <input className="input flex-1" placeholder="Nombre (ej. Independencia)" value={newLabel}
            onChange={e => setNewLabel(e.target.value)} />
          <button className="btn-secondary" onClick={addHoliday} disabled={!newDate}>
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
        {saved
          ? <><Check className="w-4 h-4" /> Guardado</>
          : saving
            ? 'Guardando...'
            : <><Save className="w-4 h-4" /> Guardar cambios</>}
      </button>
    </div>
  )
}

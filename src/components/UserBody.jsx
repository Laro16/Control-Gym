import { useState } from 'react'
import { toast, EmptyState } from './shared'
import { TrendingUp, TrendingDown, Camera, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { uploadProgressPhoto, createProgressPhoto } from '../supabase'
import {
  measurementFields, getMeasurementDiff, displayValue,
  getMeasurementComment, formatDate, formatDateShort, today
} from '../utils/helpers'

// Campos que suben = bueno (músculo)
const GOOD_UP   = ['left_arm_cm','right_arm_cm','left_leg_cm','right_leg_cm','chest_cm']
// Campos que bajan = bueno (grasa, cintura)
const GOOD_DOWN = ['weight_kg','body_fat_pct','waist_cm','hips_cm']

// Color del diff según si subir/bajar es positivo para ese campo
function diffColor(key, rawDiff) {
  if (rawDiff === null || rawDiff === 0) return 'text-gray-500'
  if (GOOD_DOWN.includes(key)) return rawDiff < 0 ? 'text-emerald-400' : 'text-red-400'
  if (GOOD_UP.includes(key))   return rawDiff > 0 ? 'text-emerald-400' : 'text-red-400'
  return 'text-gray-400'
}

// Resumen en lenguaje natural de todos los cambios
function buildSummary(latest, prev) {
  if (!prev || !latest) return []
  const lines = []
  measurementFields.forEach(f => {
    const diff = getMeasurementDiff(latest, prev, f.key)
    if (diff === null || diff === 0) return
    const comment = getMeasurementComment(f, diff)
    if (comment) lines.push({ text: comment, good: isGoodChange(f.key, diff) })
  })
  return lines
}

function isGoodChange(key, diff) {
  if (GOOD_DOWN.includes(key)) return diff < 0
  if (GOOD_UP.includes(key))   return diff > 0
  return true
}

// Tarjeta de una medición individual (para el historial)
function MeasurementHistoryCard({ measurement, prev, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false)

  const summary = buildSummary(measurement, prev)
  const goodCount = summary.filter(s => s.good).length
  const badCount  = summary.filter(s => !s.good).length

  return (
    <div className="card">
      {/* Header siempre visible */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="text-left">
          <p className="font-semibold text-white text-sm">{formatDate(measurement.measured_at)}</p>
          {measurement.weight_kg && (
            <p className="text-xs text-gray-500 mt-0.5">
              Peso: {(measurement.weight_kg * 2.20462).toFixed(1)} lbs
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Badges de resumen */}
          {prev && goodCount > 0 && (
            <span className="badge-green text-[10px]">+{goodCount} mejoras</span>
          )}
          {prev && badCount > 0 && (
            <span className="badge-red text-[10px]">{badCount} revisar</span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-500" />
            : <ChevronDown className="w-4 h-4 text-gray-500" />
          }
        </div>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div className="mt-4 space-y-3">
          {/* Grid de medidas */}
          <div className="grid grid-cols-2 gap-2">
            {measurementFields.filter(f => measurement[f.key]).map(f => {
              const rawDiff    = prev ? getMeasurementDiff(measurement, prev, f.key) : null
              const dispVal    = displayValue(f, measurement[f.key])
              const diffVal    = rawDiff !== null
                ? (f.convert ? (rawDiff * 2.20462) : rawDiff)
                : null
              const color = diffColor(f.key, rawDiff)

              return (
                <div key={f.key} className="bg-gray-800/40 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500 mb-0.5">{f.label}</p>
                  <p className="text-base font-bold text-white leading-tight">
                    {dispVal}
                    <span className="text-xs text-gray-400 font-normal ml-1">{f.unit}</span>
                  </p>
                  {diffVal !== null && diffVal !== 0 && (
                    <div className={`flex items-center gap-0.5 text-xs mt-0.5 ${color}`}>
                      {diffVal > 0
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />
                      }
                      <span>
                        {diffVal > 0 ? '+' : ''}{Math.abs(diffVal).toFixed(1)} {f.unit}
                      </span>
                    </div>
                  )}
                  {diffVal === 0 && (
                    <div className="flex items-center gap-0.5 text-xs mt-0.5 text-gray-600">
                      <Minus className="w-3 h-3" /> Sin cambio
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Resumen en texto */}
          {summary.length > 0 && (
            <div className="rounded-xl border border-gray-700/50 overflow-hidden">
              <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-700/50">
                <p className="text-xs font-semibold text-gray-400">📊 Resumen del período</p>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {summary.map((s, i) => (
                  <p key={i} className={`text-xs flex items-start gap-1.5 ${s.good ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className="mt-px flex-shrink-0">{s.good ? '✓' : '!'}</span>
                    {s.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Notas del entrenador */}
          {measurement.notes && (
            <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-brand-400 font-semibold mb-1">📝 Nota del entrenador</p>
              <p className="text-xs text-gray-300">{measurement.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Vista comparativa antes/después (últimas 2 mediciones)
function CompareView({ latest, prev }) {
  if (!latest || !prev) return null

  const changedFields = measurementFields.filter(f => latest[f.key] && prev[f.key])
  if (!changedFields.length) return null

  return (
    <div className="card">
      <p className="text-xs font-semibold text-gray-400 mb-3">
        Comparando: <span className="text-white">{formatDate(prev.measured_at)}</span>
        {' → '}
        <span className="text-brand-400">{formatDate(latest.measured_at)}</span>
      </p>
      <div className="space-y-2">
        {changedFields.map(f => {
          const rawDiff = getMeasurementDiff(latest, prev, f.key)
          if (rawDiff === null) return null
          const prevVal = displayValue(f, prev[f.key])
          const currVal = displayValue(f, latest[f.key])
          const diffVal = f.convert ? (rawDiff * 2.20462) : rawDiff
          const color   = diffColor(f.key, rawDiff)
          const good    = isGoodChange(f.key, rawDiff)

          return (
            <div key={f.key} className="flex items-center gap-3">
              <p className="text-xs text-gray-500 w-20 flex-shrink-0">{f.label}</p>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-gray-400">{prevVal} {f.unit}</span>
                <div className="flex-1 h-px bg-gray-700 relative">
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-all ${good ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(diffVal / (Number(prevVal) || 1)) * 100 * 5)}%`, right: diffVal < 0 ? 0 : 'auto', left: diffVal > 0 ? 0 : 'auto' }}
                  />
                </div>
                <span className={`text-xs font-bold ${diffVal === 0 ? 'text-gray-500' : color}`}>
                  {currVal} {f.unit}
                </span>
                {diffVal !== 0 && (
                  <span className={`text-[10px] ${color}`}>
                    ({diffVal > 0 ? '+' : ''}{Math.abs(diffVal).toFixed(1)})
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GRÁFICA DE PROGRESO (SVG puro, sin librerías) ──────────
function ProgressChart({ measurements }) {
  // Métricas que tienen al menos 2 datos registrados
  const availableFields = measurementFields.filter(f =>
    measurements.filter(m => m[f.key] != null).length >= 2
  )

  const [metricKey, setMetricKey] = useState(availableFields[0]?.key || 'weight_kg')
  const [selectedIdx, setSelectedIdx] = useState(null)

  if (!availableFields.length) return null

  const field = measurementFields.find(f => f.key === metricKey) || availableFields[0]

  // Datos: de más antiguo a más reciente, máximo 12 puntos
  const data = [...measurements]
    .reverse()
    .filter(m => m[field.key] != null)
    .slice(-12)
    .map(m => ({
      date:  m.measured_at,
      value: field.convert ? Number(field.convert(m[field.key])) : Number(m[field.key]),
    }))

  if (data.length < 2) return null

  const sel = selectedIdx !== null && data[selectedIdx] ? selectedIdx : data.length - 1

  // Escalas
  const W = 340, H = 150
  const PAD = { top: 14, right: 14, bottom: 22, left: 38 }
  const min = Math.min(...data.map(d => d.value))
  const max = Math.max(...data.map(d => d.value))
  const range = (max - min) || 1
  const yMin = min - range * 0.15
  const yMax = max + range * 0.15
  const x = (i) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  const linePoints = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const areaPath = `M ${x(0).toFixed(1)},${(H - PAD.bottom)} L ${linePoints.replace(/ /g, ' L ')} L ${x(data.length - 1).toFixed(1)},${H - PAD.bottom} Z`

  // Tendencia total (primero → último) con semáforo según la métrica
  const totalDiff = data[data.length - 1].value - data[0].value
  const trendGood = isGoodChange(field.key, totalDiff)
  const trendColor = totalDiff === 0 ? 'text-gray-500' : trendGood ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-400">📈 Mi evolución</p>
        <span className={`text-xs font-bold flex items-center gap-1 ${trendColor}`}>
          {totalDiff !== 0 && (totalDiff > 0
            ? <TrendingUp className="w-3.5 h-3.5" />
            : <TrendingDown className="w-3.5 h-3.5" />)}
          {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(1)} {field.unit}
          <span className="text-gray-600 font-normal">total</span>
        </span>
      </div>

      {/* Selector de métrica */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {availableFields.map(f => (
          <button
            key={f.key}
            onClick={() => { setMetricKey(f.key); setSelectedIdx(null) }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0
              ${f.key === field.key
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'bg-gray-800/50 text-gray-500 border border-transparent'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Punto seleccionado */}
      <p className="text-center text-xs text-gray-500 mb-1">
        <span className="text-white font-bold text-sm">{data[sel].value.toFixed(1)} {field.unit}</span>
        {' · '}{formatDate(data[sel].date)}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ touchAction: 'manipulation' }}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  style={{ stopColor: 'var(--brand-hex)' }} stopOpacity="0.25" />
            <stop offset="100%" style={{ stopColor: 'var(--brand-hex)' }} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Líneas guía + etiquetas Y */}
        {[yMax - (yMax - yMin) * 0.1, (yMax + yMin) / 2, yMin + (yMax - yMin) * 0.1].map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#6b7280" strokeOpacity="0.15" strokeDasharray="3 4" />
            <text x={PAD.left - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#6b7280">{v.toFixed(1)}</text>
          </g>
        ))}

        {/* Área + línea */}
        <path d={areaPath} fill="url(#chartFill)" />
        <polyline points={linePoints} fill="none" style={{ stroke: 'var(--brand-hex)' }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Puntos (con zona de toque amplia) */}
        {data.map((d, i) => (
          <g key={i} onClick={() => setSelectedIdx(i)} style={{ cursor: 'pointer' }}>
            <circle cx={x(i)} cy={y(d.value)} r="13" fill="transparent" />
            <circle
              cx={x(i)} cy={y(d.value)}
              r={i === sel ? 5 : 3.5}
              style={{
                fill: i === sel ? 'var(--brand-hex)' : '#1f2937',
                stroke: 'var(--brand-hex)',
              }}
              strokeWidth="2"
            />
          </g>
        ))}

        {/* Fechas extremos */}
        <text x={x(0)} y={H - 6} textAnchor="start" fontSize="9" fill="#6b7280">{formatDateShort(data[0].date)}</text>
        <text x={x(data.length - 1)} y={H - 6} textAnchor="end" fontSize="9" fill="#6b7280">{formatDateShort(data[data.length - 1].date)}</text>
      </svg>

      <p className="text-[10px] text-gray-600 text-center mt-1">
        Toca un punto para ver el detalle · Últimas {data.length} mediciones
      </p>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────
export function UserBody({ measurements, photos, member, onRefresh }) {
  const [tab, setTab]         = useState('measures')
  const [uploading, setUploading] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState('front')
  const [lightboxPhoto, setLightboxPhoto] = useState(null)

  const latest = measurements[0]
  const prev   = measurements[1]

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !member) return
    setUploading(true)
    const { url, error } = await uploadProgressPhoto(file, member.id)
    if (!error) {
      await createProgressPhoto({
        member_id:  member.id,
        photo_url:  url,
        photo_date: today(),
        angle:      selectedAngle,
      })
      toast.success('Foto de progreso guardada')
      onRefresh()
    } else {
      toast.error('Error al subir la foto. Intenta de nuevo.')
    }
    setUploading(false)
  }

  const angleLabels = {
    front:      'Frente',
    back:       'Espalda',
    side_left:  'Lado izq.',
    side_right: 'Lado der.',
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-lg mx-auto">

      {/* Lightbox foto */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <img src={lightboxPhoto} alt="progreso" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      <h2 className="section-title">Mi cuerpo</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'measures', label: '📏 Medidas' },
          { id: 'compare',  label: '📊 Comparar' },
          { id: 'photos',   label: '📸 Fotos' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1
              ${tab === t.id
                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                : 'text-gray-400 hover:text-white bg-gray-800/50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MEDIDAS ──────────────────────────────────────── */}
      {tab === 'measures' && (
        <div className="space-y-3">
          {latest ? (
            <>
              <ProgressChart measurements={measurements} />
              {measurements.map((m, i) => (
                <MeasurementHistoryCard
                  key={m.id}
                  measurement={m}
                  prev={measurements[i + 1] || null}
                  defaultOpen={i === 0}
                />
              ))}
            </>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="Tu progreso empieza pronto"
              subtitle="Pide en recepción que registren tu primera medición — aquí verás tu evolución de peso y medidas con gráficas"
            />
          )}
        </div>
      )}

      {/* ── COMPARAR ─────────────────────────────────────── */}
      {tab === 'compare' && (
        <div className="space-y-3">
          {latest && prev ? (
            <>
              <ProgressChart measurements={measurements} />
              <CompareView latest={latest} prev={prev} />
              <p className="text-xs text-center text-gray-600">
                Comparando las últimas 2 mediciones registradas
              </p>
            </>
          ) : (
            <div className="text-center py-14 text-gray-500">
              <p className="font-medium">Se necesitan al menos 2 mediciones</p>
              <p className="text-xs mt-1 text-gray-600">
                Cuando el admin registre una segunda medición verás tu progreso aquí
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── FOTOS ────────────────────────────────────────── */}
      {tab === 'photos' && (
        <div className="space-y-4">
          {/* Selector de ángulo */}
          <div>
            <p className="label">Ángulo de la foto</p>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(angleLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedAngle(key)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium transition-all
                    ${selectedAngle === key
                      ? 'bg-brand-500/10 border border-brand-500/40 text-brand-400'
                      : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Botón subir */}
          <label className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all
            ${uploading
              ? 'border-gray-700 opacity-50 pointer-events-none'
              : 'border-brand-500/40 hover:border-brand-500/70 hover:bg-brand-500/5'}`}>
            <Camera className="w-5 h-5 text-brand-500" />
            <span className="font-semibold text-white text-sm">
              {uploading ? 'Subiendo foto...' : `Subir foto — ${angleLabels[selectedAngle]}`}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
          </label>

          {/* Galería por ángulo */}
          {photos.length > 0 ? (
            <div>
              {Object.keys(angleLabels).map(angle => {
                const anglePhotos = photos.filter(p => p.angle === angle)
                if (!anglePhotos.length) return null
                return (
                  <div key={angle} className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-2">
                      {angleLabels[angle]} ({anglePhotos.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {anglePhotos.map(p => (
                        <button
                          key={p.id}
                          className="relative rounded-xl overflow-hidden aspect-square bg-gray-800 active:scale-95 transition-transform"
                          onClick={() => setLightboxPhoto(p.photo_url)}
                        >
                          <img
                            src={p.photo_url}
                            alt="progreso"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                            <p className="text-[10px] text-white font-medium">{formatDate(p.photo_date)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-600">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sube tu primera foto de progreso</p>
              <p className="text-xs mt-1">Compara tu evolución mes a mes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { TrendingUp, Users, CreditCard, Calendar, Activity } from 'lucide-react'
import { formatCurrency, getMemberPaymentStatus } from '../utils/helpers'

// Nombres de meses en español
const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── GRÁFICA DE BARRAS (ingresos por mes) ──────────────────
function BarChart({ data, color = '#f97316' }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end justify-between gap-2 h-40 pt-4">
      {data.map((d, i) => {
        const height = (d.value / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className="text-[10px] font-semibold text-gray-400">
              {d.value > 0 ? (d.value >= 1000 ? `${(d.value/1000).toFixed(1)}k` : d.value) : ''}
            </span>
            <div
              className="w-full rounded-t-lg transition-all duration-500 min-h-[2px]"
              style={{
                height: `${height}%`,
                background: `linear-gradient(to top, ${color}, ${color}dd)`,
              }}
            />
            <span className="text-[10px] text-gray-500">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── GRÁFICA DE DONA (distribución) ────────────────────────
function DonutChart({ segments }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
      Sin datos para mostrar
    </div>
  )

  let offset = 0
  const radius = 60
  const circ = 2 * Math.PI * radius

  return (
    <div className="flex items-center gap-6">
      <svg width="150" height="150" viewBox="0 0 150 150" className="flex-shrink-0">
        <g transform="rotate(-90 75 75)">
          {segments.map((s, i) => {
            const pct = s.value / total
            const dash = pct * circ
            const seg = (
              <circle
                key={i}
                cx="75" cy="75" r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="20"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              />
            )
            offset += dash
            return seg
          })}
        </g>
        <text x="75" y="70" textAnchor="middle" className="fill-white text-2xl font-bold">{total}</text>
        <text x="75" y="88" textAnchor="middle" className="fill-gray-500 text-[10px]">total</text>
      </svg>

      <div className="flex-1 space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-400 flex-1">{s.label}</span>
            <span className="text-xs font-semibold text-white">{s.value}</span>
            <span className="text-[10px] text-gray-600">({Math.round(s.value/total*100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── GRÁFICA DE LÍNEA (tendencia) ──────────────────────────
function LineChart({ data, color = '#10b981' }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const min = 0
  const w = 300, h = 100, pad = 10
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - 2 * pad)
    const y = h - pad - ((d.value - min) / (max - min || 1)) * (h - 2 * pad)
    return { x, y, ...d }
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${path} L ${points[points.length-1]?.x || pad} ${h-pad} L ${pad} ${h-pad} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lineGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d, i) => (
          <span key={i} className="text-[10px] text-gray-500">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────
export function AdminStats({ members, payments }) {

  // ── Ingresos últimos 6 meses ──
  const incomeByMonth = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const total = payments
        .filter(p => p.status === 'approved' && p.payment_date?.startsWith(key))
        .reduce((a, p) => a + Number(p.amount), 0)
      result.push({ label: MES[d.getMonth()], value: total })
    }
    return result
  }, [payments])

  // ── Distribución de estados de cuota ──
  const statusDistribution = useMemo(() => {
    let current = 0, overdue = 0, dueSoon = 0, newM = 0, pending = 0
    members.forEach(m => {
      const st = getMemberPaymentStatus(m, payments)
      if (st === 'current') current++
      else if (st === 'overdue') overdue++
      else if (st === 'due_soon') dueSoon++
      else if (st === 'new_member') newM++
      else if (st === 'pending_approval') pending++
    })
    return [
      { label: 'Al día',           value: current,  color: '#10b981' },
      { label: 'Vencidos',         value: overdue,  color: '#ef4444' },
      { label: 'Próximos a vencer',value: dueSoon,  color: '#eab308' },
      { label: 'Primer mes',       value: newM,     color: '#94a3b8' },
      { label: 'Pendientes',       value: pending,  color: '#f59e0b' },
    ].filter(s => s.value > 0)
  }, [members, payments])

  // ── Activos vs inactivos ──
  const activeDistribution = useMemo(() => {
    const active = members.filter(m => m.status === 'active').length
    const inactive = members.filter(m => m.status !== 'active').length
    return [
      { label: 'Activos',   value: active,   color: '#f97316' },
      { label: 'Inactivos', value: inactive, color: '#475569' },
    ].filter(s => s.value > 0)
  }, [members])

  // ── Nuevos miembros últimos 6 meses ──
  const newMembersByMonth = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const count = members.filter(m => m.start_date?.startsWith(key)).length
      result.push({ label: MES[d.getMonth()], value: count })
    }
    return result
  }, [members])

  // ── KPIs ──
  const totalIncome6m = incomeByMonth.reduce((a, m) => a + m.value, 0)
  const avgMonthly = Math.round(totalIncome6m / 6)
  const currentMonthIncome = incomeByMonth[incomeByMonth.length - 1]?.value || 0
  const prevMonthIncome = incomeByMonth[incomeByMonth.length - 2]?.value || 0
  const incomeGrowth = prevMonthIncome > 0
    ? Math.round(((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100)
    : 0

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="section-title">Estadísticas</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card">
          <CreditCard className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-lg font-bold text-white">{formatCurrency(currentMonthIncome)}</p>
          <p className="text-[10px] text-gray-500">Ingresos este mes</p>
          {incomeGrowth !== 0 && (
            <p className={`text-[10px] mt-0.5 ${incomeGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {incomeGrowth > 0 ? '↑' : '↓'} {Math.abs(incomeGrowth)}% vs mes anterior
            </p>
          )}
        </div>
        <div className="card">
          <TrendingUp className="w-5 h-5 text-brand-400 mb-2" />
          <p className="text-lg font-bold text-white">{formatCurrency(avgMonthly)}</p>
          <p className="text-[10px] text-gray-500">Promedio mensual (6m)</p>
        </div>
        <div className="card">
          <Users className="w-5 h-5 text-brand-400 mb-2" />
          <p className="text-lg font-bold text-white">{members.filter(m => m.status === 'active').length}</p>
          <p className="text-[10px] text-gray-500">Miembros activos</p>
        </div>
        <div className="card">
          <Activity className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-lg font-bold text-white">{newMembersByMonth[newMembersByMonth.length-1]?.value || 0}</p>
          <p className="text-[10px] text-gray-500">Nuevos este mes</p>
        </div>
      </div>

      {/* Ingresos por mes */}
      <div className="card">
        <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-400" /> Ingresos últimos 6 meses
        </h3>
        <p className="text-xs text-gray-500 mb-2">Total: {formatCurrency(totalIncome6m)}</p>
        <BarChart data={incomeByMonth} color="#10b981" />
      </div>

      {/* Estado de cuotas (dona) */}
      <div className="card">
        <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-400" /> Estado de cuotas
        </h3>
        <DonutChart segments={statusDistribution} />
      </div>

      {/* Activos vs inactivos + Nuevos miembros */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" /> Miembros
          </h3>
          <DonutChart segments={activeDistribution} />
        </div>

        <div className="card">
          <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Nuevos miembros (6m)
          </h3>
          <LineChart data={newMembersByMonth} color="#10b981" />
        </div>
      </div>

      {members.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Agrega miembros para ver estadísticas
        </div>
      )}
    </div>
  )
}

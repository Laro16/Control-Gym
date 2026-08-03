import { useState } from 'react'
import {
  Users, CreditCard, Check, X, Download,
  AlertCircle, Clock, AlertTriangle, MessageCircle,
  ChevronDown, ChevronUp, Phone, Calendar, Layers,
  UserPlus, QrCode, FileText, ChevronRight, ArrowUpRight
} from 'lucide-react'
import { updatePayment, createNotification } from '../supabase'
import {
  formatDate, formatCurrency, getMemberPaymentStatus,
  paymentStatusLabel, approvalStatusLabel, today
} from '../utils/helpers'
import { toast } from './shared'

// ── OVERVIEW ───────────────────────────────────────────────
export function AdminOverview({ members, payments, profile, onNavigate }) {
  const [filter, setFilter] = useState(null) // null | 'active' | 'pending' | 'overdue'

  const active = members.filter(m => m.status === 'active').length
  const pendingPayments = payments.filter(p => p.status === 'pending')
  const overdueMembers = members.filter(m => getMemberPaymentStatus(m, payments) === 'overdue')
  const pendingMemberIds = new Set(pendingPayments.map(payment => payment.member_id))
  const totalMonth = payments
    .filter(p => p.status === 'approved' && p.payment_date?.startsWith(today().slice(0, 7)))
    .reduce((a, p) => a + Number(p.amount), 0)
  const approvedThisMonth = payments.filter(
    p => p.status === 'approved' && p.payment_date?.startsWith(today().slice(0, 7))
  ).length
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || 'Administrador'
  const monthLabel = new Date(`${today()}T12:00:00`).toLocaleDateString('es-GT', { month: 'long' })

  const stats = [
    { id: 'active', label: 'Miembros activos', value: active, icon: Users, color: 'text-brand-400', bg: 'bg-brand-500/10', clickable: true },
    { id: 'pending', label: 'Pagos por revisar', value: pendingPayments.length, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', clickable: true },
    { id: 'overdue', label: 'Cuotas vencidas', value: overdueMembers.length, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', clickable: true },
    { id: 'income', label: 'Pagos aprobados', value: approvedThisMonth, icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', clickable: false },
  ]

  const quickActions = [
    { id: 'members', label: 'Miembros', detail: 'Agregar y gestionar', icon: UserPlus, className: 'admin-quick-members' },
    { id: 'payments', label: 'Pagos', detail: 'Revisar cobros', icon: CreditCard, className: 'admin-quick-payments' },
    { id: 'checkin', label: 'Check-in', detail: 'Abrir código QR', icon: QrCode, className: 'admin-quick-checkin' },
    { id: 'reports', label: 'Reportes', detail: 'PDF y Excel', icon: FileText, className: 'admin-quick-reports' },
  ]

  // Miembros filtrados según stat activo
  const filteredMembers = filter === 'active'  ? members.filter(m => m.status === 'active')
    : filter === 'overdue' ? overdueMembers
    : filter === 'pending' ? members.filter(m => pendingMemberIds.has(m.id))
    : members

  return (
    <div className="space-y-7 animate-fade-in">
      <section className="admin-overview-hero relative overflow-hidden rounded-[30px] p-5 sm:p-7">
        <div className="admin-hero-grid absolute inset-0 pointer-events-none" />
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid lg:grid-cols-[1.2fr_0.8fr] gap-6 lg:items-stretch">
          <div className="flex flex-col justify-between py-1">
            <div>
              <span className="admin-hero-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] text-white font-bold uppercase tracking-[0.18em]">
                Panel administrativo
              </span>
              <p className="text-sm text-white/65 mt-5">Hola, {firstName}</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-[-0.03em] mt-1 max-w-md">
                Tu gimnasio, bajo control.
              </h1>
              <p className="text-sm text-white/65 mt-3 max-w-lg leading-relaxed">
                Revisa lo importante y continúa administrando sin perder tiempo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button onClick={() => onNavigate('members')} className="admin-hero-primary rounded-xl px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-transform">
                <UserPlus className="w-4 h-4" /> Gestionar miembros
              </button>
              <button onClick={() => onNavigate('checkin')} className="admin-hero-secondary rounded-xl px-4 py-2.5 text-sm font-semibold text-white flex items-center gap-2 active:scale-95 transition-transform">
                <QrCode className="w-4 h-4" /> Check-in
              </button>
            </div>
          </div>

          <button onClick={() => onNavigate('payments')} className="admin-income-card rounded-3xl p-5 text-left active:scale-[0.99] transition-transform">
            <div className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-white/55">Ingresos de {monthLabel}</span>
                <strong className="block text-3xl sm:text-4xl text-white font-black tracking-tight mt-2">{formatCurrency(totalMonth)}</strong>
              </span>
              <span className="w-10 h-10 rounded-2xl bg-emerald-400/15 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-emerald-300" />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/10">
              <span>
                <strong className="block text-lg text-white">{active}</strong>
                <small className="text-[10px] text-white/50">Activos</small>
              </span>
              <span>
                <strong className="block text-lg text-yellow-300">{pendingPayments.length}</strong>
                <small className="text-[10px] text-white/50">Por revisar</small>
              </span>
              <span>
                <strong className="block text-lg text-red-300">{overdueMembers.length}</strong>
                <small className="text-[10px] text-white/50">Vencidos</small>
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Stats interactivos */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[10px] text-brand-400 uppercase tracking-[0.18em] font-bold">Resumen de hoy</p>
            <h2 className="text-xl font-bold text-white mt-0.5">Indicadores clave</h2>
          </div>
          <span className="text-xs text-gray-500">{formatDate(today())}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(s => (
            <button
              key={s.id}
              onClick={() => s.clickable && setFilter(filter === s.id ? null : s.id)}
              className={`admin-kpi-card text-left rounded-2xl p-4 transition-all duration-200 ${s.clickable ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
                ${filter === s.id ? 'admin-kpi-active' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`w-10 h-10 rounded-2xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                {s.clickable && <ChevronRight className="w-4 h-4 text-gray-600" />}
              </div>
              <div className={`text-2xl sm:text-3xl font-black mt-4 ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      </section>

      {(pendingPayments.length > 0 || overdueMembers.length > 0) && (
        <section className="admin-attention-panel rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] text-yellow-400 uppercase tracking-[0.18em] font-bold">Requiere atención</p>
              <h2 className="text-lg font-bold text-white mt-0.5">Pendientes importantes</h2>
            </div>
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {pendingPayments.length > 0 && (
              <button onClick={() => { setFilter('pending'); onNavigate('payments') }} className="admin-attention-item rounded-2xl p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                <span className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-400" /></span>
                <span className="flex-1"><strong className="block text-sm text-white">{pendingPayments.length} pagos por revisar</strong><small className="text-xs text-gray-500">Aprobar o rechazar comprobantes</small></span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
            {overdueMembers.length > 0 && (
              <button onClick={() => setFilter('overdue')} className="admin-attention-item rounded-2xl p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                <span className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></span>
                <span className="flex-1"><strong className="block text-sm text-white">{overdueMembers.length} cuotas vencidas</strong><small className="text-xs text-gray-500">Ver miembros y enviar recordatorios</small></span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Acciones rápidas</h2>
          <span className="text-xs text-gray-500">Administrar</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button key={action.id} onClick={() => onNavigate(action.id)} className="admin-quick-action rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-all">
              <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${action.className}`}>
                <action.icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm text-white">{action.label}</strong>
                <small className="block text-[10px] text-gray-500 truncate mt-0.5">{action.detail}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Pagos pendientes — clicables para aprobar */}
      {filter === 'pending' || pendingPayments.length > 0 ? (
        <div>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            Comprobantes pendientes ({pendingPayments.length})
          </h3>
          {pendingPayments.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin comprobantes pendientes</p>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map(p => (
                <div key={p.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{p.member?.profile?.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(p.amount)} · {p.notes || ''} · Vence {formatDate(p.due_date)}
                      </p>
                    </div>
                    <span className="badge-yellow flex-shrink-0">Pendiente</span>
                  </div>
                  {p.voucher_url && (
                    <div className="relative rounded-xl overflow-hidden bg-gray-800 group">
                      <img src={p.voucher_url} alt="comprobante" className="w-full max-h-40 object-cover" />
                      <a href={p.voucher_url} target="_blank" rel="noreferrer" download
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="w-3 h-3" /> Ver
                      </a>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold py-2 rounded-xl transition-all text-sm"
                      onClick={async () => {
                        await updatePayment(p.id, { status: 'approved', approved_at: new Date().toISOString() })
                        await createNotification({ profile_id: p.member?.profile_id, type: 'payment_approved', title: 'Pago aprobado ✅', message: `Tu pago de ${formatCurrency(p.amount)} fue aprobado.` })
                        onNavigate('refresh')
                      }}>
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold py-2 rounded-xl transition-all text-sm"
                      onClick={async () => {
                        await updatePayment(p.id, { status: 'rejected' })
                        onNavigate('refresh')
                      }}>
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Lista de miembros filtrada — expandible */}
      <MemberStatusList members={filteredMembers} payments={payments} filter={filter} setFilter={setFilter} />
    </div>
  )
}

// ── LISTA EXPANDIBLE DE MIEMBROS ───────────────────────────
function MemberStatusList({ members, payments, filter, setFilter }) {
  const [expanded, setExpanded] = useState(null)

  const toggle = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div>
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-brand-500" />
        {filter === 'active' ? 'Miembros activos'
          : filter === 'overdue' ? 'Con cuota vencida'
          : filter === 'pending' ? 'Pendientes'
          : 'Estado de cuotas'}
        <span className="text-xs text-gray-600 font-normal">({members.length})</span>
        {filter && (
          <button onClick={() => setFilter(null)} className="ml-auto text-xs text-gray-500 hover:text-white">
            Ver todos
          </button>
        )}
      </h3>

      <div className="space-y-2">
        {members.map(m => {
          const memberPayments = payments.filter(p => p.member_id === m.id && p.status !== 'rejected')
          const lastPayment    = memberPayments[0]
          const approvedPays  = memberPayments.filter(p => p.status === 'approved')
          const st             = getMemberPaymentStatus(m, payments)
          const stLabel        = paymentStatusLabel[st]
          const isOpen         = expanded === m.id

          return (
            <div key={m.id} className={`card transition-all duration-200 ${isOpen ? 'border-gray-700' : ''}`}>

              {/* ── FILA PRINCIPAL (siempre visible) ── */}
              <button
                className="w-full flex items-center gap-3"
                onClick={() => toggle(m.id)}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex-shrink-0 ${stLabel?.bg || 'bg-gray-800'} flex items-center justify-center`}>
                  {m.profile?.avatar_url
                    ? <img src={m.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    : <span className="text-xs font-bold text-white">{m.profile?.full_name?.[0]?.toUpperCase()}</span>
                  }
                </div>

                {/* Nombre y subtítulo */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-white truncate">{m.profile?.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {lastPayment
                      ? `Vence ${formatDate(lastPayment.due_date)}`
                      : `Sin pagos · Desde ${formatDate(m.start_date)}`
                    }
                  </p>
                </div>

                {/* Badge estado */}
                <span className={`${stLabel?.cls} flex-shrink-0`}>{stLabel?.text}</span>

                {/* Chevron */}
                {isOpen
                  ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                }
              </button>

              {/* ── DETALLE EXPANDIDO ── */}
              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-fade-in">

                  {/* Datos personales */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Calendar, label: 'Miembro desde', value: formatDate(m.start_date) },
                      { icon: Layers,   label: 'Plan',          value: m.plan?.name || '—' },
                      { icon: Phone,    label: 'Teléfono',      value: m.profile?.phone || '—' },
                      { icon: Calendar, label: 'Vencimiento',   value: lastPayment ? formatDate(lastPayment.due_date) : '—' },
                    ].map(r => (
                      <div key={r.label} className="bg-gray-800/40 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <r.icon className="w-3 h-3 text-gray-500" />
                          <p className="text-[10px] text-gray-500">{r.label}</p>
                        </div>
                        <p className="text-xs font-semibold text-white truncate">{r.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Historial de pagos */}
                  {memberPayments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                        Últimos pagos
                      </p>
                      <div className="space-y-1.5">
                        {memberPayments.slice(0, 4).map(p => {
                          const pStatus = approvalStatusLabel?.[p.status]
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  p.status === 'approved' ? 'bg-emerald-400'
                                  : p.status === 'pending' ? 'bg-yellow-400'
                                  : 'bg-red-400'
                                }`} />
                                <span className="text-gray-400">{p.notes || formatDate(p.due_date)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300 font-medium">{formatCurrency(p.amount)}</span>
                                <span className={pStatus?.cls || 'badge-gray'}>{pStatus?.text}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Acciones rápidas */}
                  <div className="flex gap-2 pt-1">
                    {m.profile?.phone && (
                      <a
                        href={`https://wa.me/${m.profile.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {(st === 'overdue' || st === 'due_soon') && (
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-500/10 text-brand-400 text-xs font-medium hover:bg-brand-500/20 transition-all"
                        onClick={() => {
                          const msg = `Hola ${m.profile?.full_name?.split(' ')[0]}, te recordamos que tu cuota ${st === 'overdue' ? 'está vencida' : 'vence pronto'}. Por favor realiza tu pago. ¡Gracias! 🏋️`
                          const num = (m.profile?.phone || '').replace(/[^0-9]/g, '')
                          if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
                          else toast.info('Este miembro no tiene teléfono registrado')
                        }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Recordatorio
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          )
        })}

        {members.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-6">Sin miembros en esta categoría</p>
        )}
      </div>
    </div>
  )
}

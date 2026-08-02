import { getBrandHex, getBrandRGB } from './theme.js'

// jsPDF y write-excel-file se cargan bajo demanda (import dinámico) dentro de
// las funciones de exportación: pesan ~600KB y solo los necesita el
// admin cuando exporta. Así el bundle inicial es mucho más liviano.

// ── FECHAS ─────────────────────────────────────────────────
// IMPORTANTE: todas las fechas se manejan en hora LOCAL (Guatemala),
// nunca en UTC. Antes se usaba toISOString(), que devuelve UTC:
// entre las 6pm y medianoche (UTC-6) daba la fecha de MAÑANA,
// rompiendo rachas, asistencias y estados de pago.

// Convierte un Date a 'YYYY-MM-DD' usando la hora local del dispositivo
export const toLocalDateStr = (d) => {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parsea 'YYYY-MM-DD' como fecha local a mediodía.
// (new Date('2026-06-10') parsea como UTC medianoche y en GT
//  retrocede al día anterior — por eso se ancla a las 12:00)
export const parseDateStr = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`)

// Acepta Date, timestamp ISO completo o 'YYYY-MM-DD'
const asDate = (date) => {
  if (date instanceof Date) return date
  const s = String(date)
  return s.length <= 10 ? parseDateStr(s) : new Date(s)
}

export const formatDate = (date) => {
  if (!date) return '—'
  return asDate(date).toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export const formatDateShort = (date) => {
  if (!date) return '—'
  return asDate(date).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })
}

export const today = () => toLocalDateStr(new Date())

export const addDays = (date, days) => {
  const d = parseDateStr(date)
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}

export const daysBetween = (a, b) => {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((parseDateStr(b) - parseDateStr(a)) / msPerDay)
}

// ── ESTADO DE PAGO ─────────────────────────────────────────
// Calcula el estado de una cuota según su due_date
export const getPaymentStatus = (dueDate) => {
  if (!dueDate) return 'no_payment'
  const diff = daysBetween(today(), dueDate)
  if (diff < 0)   return 'overdue'   // vencida
  if (diff <= 5)  return 'due_soon'  // próxima a vencer (menos de 5 días)
  return 'current'                   // al día
}

// Calcula el estado de un miembro considerando pagos Y fecha de inicio
// Lógica sin pagos:
//   - Calcula due_date real = start_date + duración del plan (default 30 días)
//   - Usa getPaymentStatus(due_date) → puede ser 'due_soon', 'overdue' o 'new_member'
// Ejemplo: inicio 1-6-2026, plan 30 días → due 1-7-2026
//   - 1-6 al 25-6  → 'new_member'  (más de 5 días para vencer)
//   - 26-6 al 1-7  → 'due_soon'    (5 días o menos para vencer)
//   - 2-7 en adelante → 'overdue'  (vencida)
export const getMemberPaymentStatus = (member, payments) => {
  const memberPayments = (payments || []).filter(
    p => p.member_id === member.id && p.status !== 'rejected'
  )

  if (!memberPayments.length) {
    if (!member.start_date) return 'no_payment'

    // Calcular fecha de vencimiento esperada según el plan (hora local)
    const planDays = member.plan?.duration_days || 30
    const expectedDueDate = addDays(member.start_date, planDays)

    const diff = daysBetween(today(), expectedDueDate)

    if (diff < 0)  return 'overdue'    // ya venció
    if (diff <= 5) return 'due_soon'   // próxima a vencer
    return 'new_member'                // aún tiene tiempo
  }

  // Tiene pagos — revisar el más reciente no rechazado
  const last = memberPayments[0]
  if (last.status === 'pending') return 'pending_approval'
  return getPaymentStatus(last.due_date)
}

export const paymentStatusLabel = {
  overdue:          { text: 'Vencida',              cls: 'badge-red',    dot: 'bg-red-400',     bg: 'bg-red-500/10'    },
  due_soon:         { text: 'Próxima a vencer',     cls: 'badge-yellow', dot: 'bg-yellow-400',  bg: 'bg-yellow-500/10' },
  current:          { text: 'Al día',               cls: 'badge-green',  dot: 'bg-emerald-400', bg: 'bg-emerald-500/10'},
  no_payment:       { text: 'Sin pago',             cls: 'badge-red',    dot: 'bg-red-400',     bg: 'bg-red-500/10'    },
  new_member:       { text: 'Primer mes',           cls: 'badge-gray',   dot: 'bg-gray-400',    bg: 'bg-gray-700/30'   },
  pending_approval: { text: 'Pendiente aprobación', cls: 'badge-yellow', dot: 'bg-yellow-400',  bg: 'bg-yellow-500/10' },
}

export const approvalStatusLabel = {
  pending:  { text: 'Pendiente', cls: 'badge-yellow' },
  approved: { text: 'Aprobado',  cls: 'badge-green' },
  rejected: { text: 'Rechazado', cls: 'badge-red' },
}

// ── MEDIDAS ────────────────────────────────────────────────
// Campos de medidas — peso en libras, medidas en cm, grasa en %
// height_cm se guarda solo en la ficha del cliente (no se edita mes a mes)
export const measurementFields = [
  { key: 'weight_kg',    label: 'Peso',           unit: 'lbs', convert: v => (v * 2.20462).toFixed(1), store: v => (v / 2.20462).toFixed(2) },
  { key: 'waist_cm',     label: 'Cintura',        unit: 'cm',  convert: null, store: null },
  { key: 'chest_cm',     label: 'Pecho',          unit: 'cm',  convert: null, store: null },
  { key: 'hips_cm',      label: 'Caderas',        unit: 'cm',  convert: null, store: null },
  { key: 'left_arm_cm',  label: 'Brazo izq.',     unit: 'cm',  convert: null, store: null },
  { key: 'right_arm_cm', label: 'Brazo der.',     unit: 'cm',  convert: null, store: null },
  { key: 'left_leg_cm',  label: 'Pierna izq.',    unit: 'cm',  convert: null, store: null },
  { key: 'right_leg_cm', label: 'Pierna der.',    unit: 'cm',  convert: null, store: null },
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%',   convert: null, store: null },
]

// Mostrar el valor correcto (convirtiendo si aplica)
export const displayValue = (field, rawValue) => {
  if (!rawValue) return null
  if (field.convert) return field.convert(rawValue)
  return Number(rawValue).toFixed(1)
}

// Comentario automático de progreso
export const getMeasurementComment = (field, diff) => {
  if (diff === null || diff === 0) return null
  const label = field.label.toLowerCase()
  const unit  = field.unit
  // Para peso mostrar en lbs, resto en su unidad original
  const abs   = Math.abs(field.key === 'weight_kg' ? (diff * 2.20462) : diff).toFixed(1)

  // Peso: bajar es bueno (generalmente)
  if (field.key === 'weight_kg') {
    if (diff < 0) return `¡Bajaste ${abs} ${unit} de peso! 💪 ¡Sigue así!`
    if (diff > 0) return `Subiste ${abs} ${unit} de peso. Revisa tu alimentación.`
  }
  // Grasa: bajar es bueno
  if (field.key === 'body_fat_pct') {
    if (diff < 0) return `¡Bajaste ${abs}% de grasa corporal! 🔥 ¡Excelente!`
    if (diff > 0) return `Subiste ${abs}% de grasa. Enfócate en cardio y dieta.`
  }
  // Brazos, piernas, pecho: subir es músculo (bueno)
  if (['left_arm_cm','right_arm_cm','left_leg_cm','right_leg_cm','chest_cm'].includes(field.key)) {
    if (diff > 0) return `+${abs} ${unit} en ${label}. ¡Ganando músculo! 💪`
    if (diff < 0) return `${abs} ${unit} menos en ${label}.`
  }
  // Cintura, caderas: bajar es bueno
  if (['waist_cm','hips_cm'].includes(field.key)) {
    if (diff < 0) return `¡Bajaste ${abs} ${unit} de ${label}! ¡Muy bien! 🎉`
    if (diff > 0) return `Subiste ${abs} ${unit} en ${label}.`
  }
  return null
}

export const getMeasurementDiff = (current, previous, key) => {
  if (!current?.[key] || !previous?.[key]) return null
  const diff = Number(current[key]) - Number(previous[key])
  return diff
}

// ── RACHA ──────────────────────────────────────────────────
// Ahora respeta la configuración del gimnasio (streakOptions):
//   - closedWeekdays: días de la semana que el gym cierra (0=Dom ... 6=Sáb)
//   - holidays:       fechas 'YYYY-MM-DD' de feriados
// Reglas:
//   - Si asistió un día: SIEMPRE cuenta (aunque sea día cerrado/feriado)
//   - Día cerrado o feriado sin asistir: no rompe, no cuenta
//   - Día hábil sin asistir: rompe la racha
//   - Hoy sin marcar: se calcula desde ayer para no mostrar 0 durante el día
// Si no se pasan opciones, default [0,6] = cerrado Dom y Sáb (compatible
// con el comportamiento anterior, pero ahora Sáb/Dom asistidos SÍ cuentan).

const normalizeStreakOptions = (options = {}) => ({
  closedWeekdays: Array.isArray(options.closedWeekdays) ? options.closedWeekdays : [0, 6],
  // Los feriados pueden venir como strings 'YYYY-MM-DD' o como
  // objetos { date, label } (formato que guarda GymSchedule)
  holidays: new Set(
    (Array.isArray(options.holidays) ? options.holidays : [])
      .map(h => String(h?.date || h).slice(0, 10))
  ),
})

// ¿Es día de descanso (gym cerrado o feriado)? — usado también por el calendario
export const isRestDay = (dateStr, options = {}) => {
  const { closedWeekdays, holidays } = normalizeStreakOptions(options)
  return closedWeekdays.includes(parseDateStr(dateStr).getDay()) || holidays.has(String(dateStr).slice(0, 10))
}

export const calculateStreak = (attendanceDates, options = {}) => {
  if (!attendanceDates?.length) return 0
  const { closedWeekdays, holidays } = normalizeStreakOptions(options)
  const attended = new Set(attendanceDates.map(a => a.attended_date))

  const todayStr    = today()
  const markedToday = attended.has(todayStr)

  // Si aún no marcó hoy, empezamos desde ayer para no mostrar 0 injustamente
  const check = parseDateStr(todayStr)
  if (!markedToday) check.setDate(check.getDate() - 1)

  let streak = 0
  for (let i = 0; i < 366; i++) {
    const dateStr = toLocalDateStr(check)
    const dow     = check.getDay()
    const isRest  = closedWeekdays.includes(dow) || holidays.has(dateStr)

    if (attended.has(dateStr)) {
      streak++                 // asistió: cuenta siempre
    } else if (!isRest) {
      break                    // día hábil sin asistir: rompe
    }
    // día cerrado/feriado sin asistir: continúa sin romper

    check.setDate(check.getDate() - 1)
  }

  return streak
}

// ── PDF COMPROBANTE ────────────────────────────────────────
export const generatePaymentPDF = async (payment, member) => {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const gymName = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

  // Header
  doc.setFillColor(...getBrandRGB())
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(gymName, 14, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Comprobante de Pago', 14, 30)

  // Info member
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL MIEMBRO', 14, 54)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const memberInfo = [
    ['Nombre:', member?.profile?.full_name || '—'],
    ['Email:', member?.profile?.email || '—'],
    ['Teléfono:', member?.profile?.phone || '—'],
    ['Fecha de inicio:', formatDate(member?.start_date)],
  ]
  let y = 62
  memberInfo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(val, 55, y)
    y += 8
  })

  // Info pago
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('DETALLE DE PAGO', 14, y)
  y += 8

  doc.setFontSize(11)
  const payInfo = [
    ['Monto:', `Q ${Number(payment.amount).toFixed(2)}`],
    ['Método:', payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Depósito'],
    ['Fecha de pago:', formatDate(payment.payment_date)],
    ['Fecha de vencimiento:', formatDate(payment.due_date)],
    ['Estado:', payment.status === 'approved' ? 'APROBADO' : payment.status === 'pending' ? 'PENDIENTE' : 'RECHAZADO'],
  ]
  payInfo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(val, 65, y)
    y += 8
  })

  // Si es efectivo, mostrar nota grande
  if (payment.payment_method === 'cash') {
    y += 6
    doc.setFillColor(...getBrandRGB())
    doc.roundedRect(14, y, 182, 18, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`💵 PAGO EN EFECTIVO: Q ${Number(payment.amount).toFixed(2)}`, 105, y + 12, { align: 'center' })
    doc.setTextColor(30, 30, 30)
    y += 28
  }

  // Si tiene voucher (imagen), intentar agregarla
  if (payment.voucher_url) {
    try {
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('COMPROBANTE:', 14, y)
      y += 4
      // Nota: la imagen se agrega si el usuario la subió
      const img = await loadImageAsBase64(payment.voucher_url)
      if (img) doc.addImage(img, 'JPEG', 14, y, 80, 60)
    } catch {}
  }

  // Footer
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generado el ${formatDate(today())} — ${gymName}`, 105, 285, { align: 'center' })

  doc.save(`comprobante_${member?.profile?.full_name}_${formatDateShort(payment.due_date)}.pdf`)
}

const loadImageAsBase64 = (url) => new Promise((resolve) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    resolve(canvas.toDataURL('image/jpeg'))
  }
  img.onerror = () => resolve(null)
  img.src = url
})

// ── PDF HISTORIAL DE PAGOS ─────────────────────────────────
export const generatePaymentHistoryPDF = async (payments, member) => {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  const gymName = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

  doc.setFillColor(...getBrandRGB())
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`${gymName} — Historial de Pagos`, 14, 12)
  doc.setFontSize(10)
  doc.text(`${member?.profile?.full_name || ''} — Generado: ${formatDate(today())}`, 14, 22)

  autoTable(doc, {
    startY: 40,
    head: [['Fecha pago', 'Vence', 'Monto', 'Método', 'Estado']],
    body: (payments || []).map(p => [
      formatDate(p.payment_date),
      formatDate(p.due_date),
      `Q ${Number(p.amount).toFixed(2)}`,
      p.payment_method === 'cash' ? 'Efectivo' : p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito',
      p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
    ]),
    headStyles: { fillColor: getBrandRGB(), textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  doc.save(`historial_pagos_${member?.profile?.full_name}.pdf`)
}

// ── EXCEL HISTORIAL ────────────────────────────────────────
export const generatePaymentHistoryExcel = async (payments, member) => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const rows = (payments || []).map(p => ({
    'Nombre': member?.profile?.full_name,
    'Fecha Pago': formatDate(p.payment_date),
    'Vence': formatDate(p.due_date),
    'Monto (Q)': Number(p.amount).toFixed(2),
    'Método': p.payment_method === 'cash' ? 'Efectivo' : p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito',
    'Estado': p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
    'Notas': p.notes || '',
  }))

  await writeXlsxFile(objectsToExcelRows(rows), {
    fileName: `pagos_${safeFilename(member?.profile?.full_name)}.xlsx`,
    sheet: 'Pagos',
  })
}

// ── EXCEL MAESTRO (todos los miembros) ─────────────────────
export const generateMasterExcel = async (members, payments) => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  // Hoja 1: Miembros
  const memberRows = (members || []).map(m => ({
    'Nombre': m.profile?.full_name,
    'Email': m.profile?.email,
    'Teléfono': m.profile?.phone,
    'Inicio': formatDate(m.start_date),
    'Plan': m.plan?.name,
    'Estado': m.status === 'active' ? 'Activo' : m.status === 'inactive' ? 'Inactivo' : 'Suspendido',
    'Contacto emergencia': m.emergency_contact,
  }))

  // Hoja 2: Pagos
  const paymentRows = (payments || []).map(p => ({
    'Miembro': p.member?.profile?.full_name,
    'Fecha Pago': formatDate(p.payment_date),
    'Vence': formatDate(p.due_date),
    'Monto': Number(p.amount).toFixed(2),
    'Método': p.payment_method,
    'Estado': p.status,
  }))

  await writeXlsxFile([
    objectsToExcelRows(memberRows),
    objectsToExcelRows(paymentRows),
  ], {
    sheets: ['Miembros', 'Pagos'],
    fileName: 'reporte_maestro_gimnasio.xlsx',
  })
}

const safeFilename = (value) => String(value || 'miembro')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'miembro'

const objectsToExcelRows = (rows) => {
  const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos']
  const headerRow = headers.map(value => ({
    value,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#F97316',
    align: 'center',
  }))
  const dataRows = rows.map(row => headers.map(key => ({ value: row[key] ?? '' })))
  return [headerRow, ...dataRows]
}

// ── MONEDA ─────────────────────────────────────────────────
export const formatCurrency = (amount) =>
  `Q ${Number(amount || 0).toFixed(2)}`

// ── RECIBO DE CAJA COMO IMAGEN (PNG) ──────────────────────
// Genera un recibo visual descargable usando Canvas, sin librerias
export const generateReceiptImage = (payment, member, gymName) => {
  const canvas = document.createElement('canvas')
  const scale  = 2 // alta resolucion
  const W = 380, H = 560
  canvas.width  = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // Fondo blanco
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Banda superior naranja
  ctx.fillStyle = getBrandHex()
  ctx.fillRect(0, 0, W, 90)

  // Nombre del gimnasio
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(gymName || 'GYM', W/2, 42)

  ctx.font = '13px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('RECIBO DE PAGO', W/2, 66)

  // Numero de recibo y fecha
  const recId = payment.id ? payment.id.slice(0, 8).toUpperCase() : '--------'
  ctx.fillStyle = '#64748b'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Recibo #: ${recId}`, 30, 120)
  ctx.textAlign = 'right'
  ctx.fillText(`Fecha: ${formatDate(payment.payment_date || today())}`, W - 30, 120)

  // Linea separadora
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(30, 138); ctx.lineTo(W - 30, 138); ctx.stroke()

  // Datos del cliente
  let y = 170
  const row = (label, value, bold) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#94a3b8'
    ctx.font = '11px Arial, sans-serif'
    ctx.fillText(label, 30, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#0f172a'
    ctx.font = `${bold ? 'bold ' : ''}14px Arial, sans-serif`
    ctx.fillText(String(value), W - 30, y)
    y += 34
  }

  row('Cliente', member?.profile?.full_name || '—', true)
  row('Plan', member?.plan?.name || '—')
  row('Metodo de pago', payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Deposito')
  row('Concepto', payment.notes || 'Mensualidad')
  row('Vence', formatDate(payment.due_date))

  // Caja del monto
  y += 10
  ctx.fillStyle = '#f0fdf4'
  ctx.fillRect(30, y, W - 60, 70)
  ctx.strokeStyle = '#bbf7d0'
  ctx.strokeRect(30, y, W - 60, 70)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#16a34a'
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('TOTAL PAGADO', W/2, y + 26)
  ctx.font = 'bold 32px Arial, sans-serif'
  ctx.fillText(formatCurrency(payment.amount), W/2, y + 56)

  // Sello PAGADO
  y += 110
  ctx.save()
  ctx.translate(W/2, y + 20)
  ctx.rotate(-0.12)
  ctx.strokeStyle = '#16a34a'
  ctx.lineWidth = 3
  ctx.strokeRect(-70, -22, 140, 44)
  ctx.fillStyle = '#16a34a'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PAGADO', 0, 8)
  ctx.restore()

  // Pie
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Gracias por tu pago. Conserva este recibo.', W/2, H - 40)
  ctx.fillText(`Generado el ${formatDate(today())}`, W/2, H - 24)

  // Descargar
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recibo-${member?.profile?.full_name?.split(' ')[0] || 'pago'}-${recId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

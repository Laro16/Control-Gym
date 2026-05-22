import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ── FECHAS ─────────────────────────────────────────────────
export const formatDate = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export const formatDateShort = (date) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  })
}

export const today = () => new Date().toISOString().split('T')[0]

export const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export const daysBetween = (a, b) => {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(b) - new Date(a)) / msPerDay)
}

// ── ESTADO DE PAGO ─────────────────────────────────────────
export const getPaymentStatus = (dueDate) => {
  const diff = daysBetween(today(), dueDate)
  if (diff < 0) return 'overdue'      // vencida
  if (diff <= 5) return 'due_soon'    // próxima a vencer
  return 'current'                    // al día
}

export const paymentStatusLabel = {
  overdue:  { text: 'Vencida',          cls: 'badge-red',    dot: 'bg-red-400',     bg: 'bg-red-500/10' },
  due_soon: { text: 'Próxima a vencer', cls: 'badge-yellow', dot: 'bg-yellow-400',  bg: 'bg-yellow-500/10' },
  current:  { text: 'Al día',           cls: 'badge-green',  dot: 'bg-emerald-400', bg: 'bg-emerald-500/10' },
}

export const approvalStatusLabel = {
  pending:  { text: 'Pendiente', cls: 'badge-yellow' },
  approved: { text: 'Aprobado',  cls: 'badge-green' },
  rejected: { text: 'Rechazado', cls: 'badge-red' },
}

// ── MEDIDAS ────────────────────────────────────────────────
export const measurementFields = [
  { key: 'weight_kg',     label: 'Peso',            unit: 'kg' },
  { key: 'waist_cm',      label: 'Cintura',         unit: 'cm' },
  { key: 'chest_cm',      label: 'Pecho',           unit: 'cm' },
  { key: 'hips_cm',       label: 'Caderas',         unit: 'cm' },
  { key: 'left_arm_cm',   label: 'Brazo izq.',      unit: 'cm' },
  { key: 'right_arm_cm',  label: 'Brazo der.',      unit: 'cm' },
  { key: 'left_leg_cm',   label: 'Pierna izq.',     unit: 'cm' },
  { key: 'right_leg_cm',  label: 'Pierna der.',     unit: 'cm' },
  { key: 'body_fat_pct',  label: 'Grasa corporal',  unit: '%' },
  { key: 'height_cm',     label: 'Altura',          unit: 'cm' },
]

export const getMeasurementDiff = (current, previous, key) => {
  if (!current?.[key] || !previous?.[key]) return null
  const diff = Number(current[key]) - Number(previous[key])
  return diff
}

// ── RACHA ──────────────────────────────────────────────────
export const calculateStreak = (attendanceDates) => {
  if (!attendanceDates?.length) return 0
  const attended = new Set(attendanceDates.map(a => a.attended_date))
  let streak = 0
  let check = new Date()

  for (let i = 0; i < 365; i++) {
    const dow = check.getDay() // 0=domingo, 6=sábado
    const dateStr = check.toISOString().split('T')[0]

    if (dow === 0) { // domingo: saltar sin romper
      check.setDate(check.getDate() - 1)
      continue
    }

    if (attended.has(dateStr)) {
      streak++
    } else if (dow === 6) { // sábado sin asistir: no rompe
      // continúa
    } else {
      break // día de semana sin asistir: racha rota
    }

    check.setDate(check.getDate() - 1)
  }
  return streak
}

// ── PDF COMPROBANTE ────────────────────────────────────────
export const generatePaymentPDF = async (payment, member) => {
  const doc = new jsPDF()
  const gymName = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

  // Header
  doc.setFillColor(249, 115, 22)
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
    doc.setFillColor(249, 115, 22)
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
export const generatePaymentHistoryPDF = (payments, member) => {
  const doc = new jsPDF()
  const gymName = import.meta.env.VITE_GYM_NAME || 'Mi Gimnasio'

  doc.setFillColor(249, 115, 22)
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
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  doc.save(`historial_pagos_${member?.profile?.full_name}.pdf`)
}

// ── EXCEL HISTORIAL ────────────────────────────────────────
export const generatePaymentHistoryExcel = (payments, member) => {
  const rows = (payments || []).map(p => ({
    'Nombre': member?.profile?.full_name,
    'Fecha Pago': formatDate(p.payment_date),
    'Vence': formatDate(p.due_date),
    'Monto (Q)': Number(p.amount).toFixed(2),
    'Método': p.payment_method === 'cash' ? 'Efectivo' : p.payment_method === 'transfer' ? 'Transferencia' : 'Depósito',
    'Estado': p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
    'Notas': p.notes || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos')
  XLSX.writeFile(wb, `pagos_${member?.profile?.full_name}.xlsx`)
}

// ── EXCEL MAESTRO (todos los miembros) ─────────────────────
export const generateMasterExcel = (members, payments) => {
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

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(memberRows), 'Miembros')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), 'Pagos')
  XLSX.writeFile(wb, 'reporte_maestro_gimnasio.xlsx')
}

// ── MONEDA ─────────────────────────────────────────────────
export const formatCurrency = (amount) =>
  `Q ${Number(amount || 0).toFixed(2)}`

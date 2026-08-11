import writeXlsxFile from 'write-excel-file/browser'
import {
  getLastRegisteredDueDate,
  getMemberPaymentStatus,
  paymentStatusLabel,
} from './helpers.js'

const COLORS = {
  navy: '#111827',
  navySoft: '#1F2937',
  orange: '#F97316',
  orangeSoft: '#FFF1E8',
  white: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  stripe: '#F9FAFB',
  green: '#047857',
  greenSoft: '#ECFDF5',
  red: '#B91C1C',
  redSoft: '#FEF2F2',
  yellow: '#A16207',
  yellowSoft: '#FFFBEB',
}

const DATE_FORMAT = 'dd/mm/yyyy'
const DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm'
const MONEY_FORMAT = '"Q" #,##0.00'

const safeFilename = value => String(value || 'Control_Gym')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'Control_Gym'

const filenameDate = () => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const generatedAt = () => new Intl.DateTimeFormat('es-GT', {
  dateStyle: 'long', timeStyle: 'short',
}).format(new Date())

const toDate = value => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDpi = value => {
  const text = String(value || '').trim()
  const digits = text.replace(/\D/g, '')
  return digits.length === 13
    ? `${digits.slice(0, 4)} ${digits.slice(4, 9)} ${digits.slice(9)}`
    : text
}

const formatPhone = value => {
  const text = String(value || '').trim()
  const digits = text.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : text
}

const textCell = (value, style = {}) => ({ value: value ?? '', type: String, ...style })
const numberCell = (value, format = '#,##0', style = {}) => ({
  value: Number(value || 0), type: Number, format, align: 'right', ...style,
})
const dateCell = (value, withTime = false, style = {}) => {
  const date = toDate(value)
  return date
    ? { value: date, type: Date, format: withTime ? DATE_TIME_FORMAT : DATE_FORMAT, ...style }
    : textCell('—', style)
}
const formulaCell = (formula, format = '#,##0', style = {}) => ({
  value: formula, type: 'Formula', format, align: 'right', ...style,
})

const blankRow = count => Array.from({ length: count }, () => null)

const titleRows = (title, subtitle, columnCount) => [
  [
    textCell(title, {
      columnSpan: columnCount, backgroundColor: COLORS.navy, textColor: COLORS.white,
      fontSize: 18, fontWeight: 'bold', height: 32, alignVertical: 'center',
    }),
    ...Array(columnCount - 1).fill(null),
  ],
  [
    textCell(`${subtitle} · Generado ${generatedAt()}`, {
      columnSpan: columnCount, backgroundColor: COLORS.navySoft, textColor: '#D1D5DB',
      fontSize: 10, height: 23, alignVertical: 'center',
    }),
    ...Array(columnCount - 1).fill(null),
  ],
  blankRow(columnCount),
]

const headerRow = headers => headers.map(value => textCell(value, {
  fontWeight: 'bold', textColor: COLORS.white, backgroundColor: COLORS.orange,
  align: 'center', alignVertical: 'center', wrap: true, height: 27,
  bottomBorderColor: '#C2410C', bottomBorderStyle: 'medium',
}))

const dataRow = (cells, index) => cells.map(cell => {
  if (!cell) return cell
  return {
    ...cell,
    backgroundColor: index % 2 ? COLORS.stripe : COLORS.white,
    bottomBorderColor: COLORS.border,
    bottomBorderStyle: 'thin',
    alignVertical: 'center',
    height: 21,
  }
})

const emptyDataRow = (message, columnCount) => [
  textCell(message, {
    columnSpan: columnCount, textColor: COLORS.muted, fontStyle: 'italic',
    align: 'center', height: 25,
  }),
  ...Array(columnCount - 1).fill(null),
]

const makeTableSheet = ({ title, subtitle, headers, rows, columns, sheet }) => ({
  data: [
    ...titleRows(title, subtitle, headers.length),
    headerRow(headers),
    ...(rows.length ? rows.map(dataRow) : [emptyDataRow('No hay información registrada.', headers.length)]),
  ],
  sheet,
  columns,
  stickyRowsCount: 4,
  stickyColumnsCount: 1,
  showGridLines: false,
  orientation: headers.length > 7 ? 'landscape' : 'portrait',
  zoomScale: headers.length > 9 ? 0.8 : 0.9,
})

const paymentMethodLabel = method => (
  method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'Depósito'
)

const approvalLabel = status => (
  status === 'approved' ? 'Aprobado' : status === 'pending' ? 'Pendiente' : 'Rechazado'
)

const membershipLabel = status => (
  status === 'active' ? 'Activo' : status === 'inactive' ? 'Inactivo' : 'Suspendido'
)

export const buildPaymentHistorySheet = (payments, member) => {
  const name = member?.profile?.full_name || 'Miembro'
  const rows = (payments || []).map(payment => [
    textCell(name),
    dateCell(payment.payment_date),
    dateCell(payment.due_date),
    numberCell(payment.amount, MONEY_FORMAT),
    textCell(paymentMethodLabel(payment.payment_method)),
    textCell(approvalLabel(payment.status)),
    textCell(payment.notes || ''),
  ])

  return makeTableSheet({
    title: 'Historial de pagos',
    subtitle: name,
    sheet: 'Pagos',
    headers: ['Miembro', 'Fecha de pago', 'Vencimiento', 'Monto', 'Método', 'Estado', 'Notas'],
    rows,
    columns: [
      { width: 28 }, { width: 15 }, { width: 15 }, { width: 15 },
      { width: 16 }, { width: 14 }, { width: 36 },
    ],
  })
}

export const generatePaymentHistoryExcel = async (payments, member) => {
  const sheet = buildPaymentHistorySheet(payments, member)
  await writeXlsxFile(sheet.data, sheet)
    .toFile(`Historial_Pagos_${safeFilename(member?.profile?.full_name)}_${filenameDate()}.xlsx`)
}

const buildMemberRows = (members, payments) => (members || []).map(member => {
  const paymentState = getMemberPaymentStatus(member, payments)
  const dueDate = getLastRegisteredDueDate(member.id, payments)
  return [
    textCell(member.profile?.full_name || ''),
    textCell(formatDpi(member.profile?.dpi), { format: '@' }),
    textCell(member.profile?.email || ''),
    textCell(formatPhone(member.profile?.phone), { format: '@' }),
    dateCell(member.start_date),
    textCell(member.plan?.name || 'Sin plan'),
    textCell(membershipLabel(member.status)),
    textCell(paymentStatusLabel[paymentState]?.text || 'Sin información'),
    dateCell(dueDate),
    numberCell(member.plan?.price || 0, MONEY_FORMAT),
    textCell(member.emergency_contact || ''),
  ]
})

const buildPaymentRows = (members, payments) => {
  const memberNames = new Map((members || []).map(member => [member.id, member.profile?.full_name || '']))
  return (payments || []).map(payment => [
    textCell(payment.member?.profile?.full_name || memberNames.get(payment.member_id) || ''),
    dateCell(payment.payment_date),
    dateCell(payment.due_date),
    numberCell(payment.amount, MONEY_FORMAT),
    textCell(paymentMethodLabel(payment.payment_method)),
    textCell(approvalLabel(payment.status)),
    dateCell(payment.approved_at, true),
    textCell(payment.notes || ''),
  ])
}

const buildPlanRows = plans => (plans || []).map(plan => [
  textCell(plan.name || ''),
  numberCell(plan.price, MONEY_FORMAT),
  numberCell(plan.duration_days),
  null, // La fórmula de miembros activos se agrega más adelante.
  null, // La fórmula de ingreso estimado se agrega más adelante.
  textCell(plan.description || ''),
  textCell(Array.isArray(plan.features) ? plan.features.join(' · ') : ''),
])

const summaryLabel = value => textCell(value, {
  fontWeight: 'bold', textColor: COLORS.muted, backgroundColor: '#F3F4F6',
  align: 'center', height: 23,
})
const summaryValue = (formula, format = '#,##0', tone = 'normal') => formulaCell(formula, format, {
  fontSize: 16, fontWeight: 'bold', align: 'center', height: 32,
  backgroundColor: tone === 'positive' ? COLORS.greenSoft
    : tone === 'negative' ? COLORS.redSoft
      : tone === 'warning' ? COLORS.yellowSoft : COLORS.orangeSoft,
  textColor: tone === 'positive' ? COLORS.green
    : tone === 'negative' ? COLORS.red
      : tone === 'warning' ? COLORS.yellow : '#C2410C',
})

const buildGeneralSummarySheet = ({ gymName, memberEnd, paymentEnd, plans }) => {
  const columns = [{ width: 26 }, { width: 18 }, { width: 26 }, { width: 18 }]
  const rows = [
    ...titleRows('Reporte General', gymName, 4),
    [summaryLabel('Total de miembros'), null, summaryLabel('Miembros activos'), null],
    [summaryValue(`=COUNTA('Miembros'!A5:A${memberEnd})`), null,
      summaryValue(`=COUNTIF('Miembros'!G5:G${memberEnd},"Activo")`, '#,##0', 'positive'), null],
    blankRow(4),
    [summaryLabel('Cuotas al día'), null, summaryLabel('Cuotas vencidas'), null],
    [summaryValue(`=COUNTIF('Miembros'!H5:H${memberEnd},"Al día")`, '#,##0', 'positive'), null,
      summaryValue(`=COUNTIF('Miembros'!H5:H${memberEnd},"Vencida")`, '#,##0', 'negative'), null],
    blankRow(4),
    [summaryLabel('Ingresos aprobados'), null, summaryLabel('Pagos pendientes'), null],
    [summaryValue(`=SUMIF('Pagos'!F5:F${paymentEnd},"Aprobado",'Pagos'!D5:D${paymentEnd})`, MONEY_FORMAT, 'positive'), null,
      summaryValue(`=COUNTIF('Pagos'!F5:F${paymentEnd},"Pendiente")`, '#,##0', 'warning'), null],
    blankRow(4),
    [textCell('Resumen por plan', {
      columnSpan: 4, backgroundColor: COLORS.navySoft, textColor: COLORS.white,
      fontWeight: 'bold', height: 25,
    }), null, null, null],
    headerRow(['Plan', 'Precio', 'Miembros activos', 'Ingreso estimado']),
  ]

  if ((plans || []).length) {
    plans.forEach((plan, index) => {
      const rowNumber = rows.length + 1
      rows.push(dataRow([
        textCell(plan.name),
        numberCell(plan.price, MONEY_FORMAT),
        formulaCell(`=COUNTIFS('Miembros'!F5:F${memberEnd},A${rowNumber},'Miembros'!G5:G${memberEnd},"Activo")`),
        formulaCell(`=B${rowNumber}*C${rowNumber}`, MONEY_FORMAT),
      ], index))
    })
  } else {
    rows.push(emptyDataRow('No hay planes activos.', 4))
  }

  rows.push(blankRow(4))
  rows.push([
    textCell('Estado de pagos', {
      columnSpan: 4, backgroundColor: COLORS.navySoft, textColor: COLORS.white,
      fontWeight: 'bold', height: 25,
    }), null, null, null,
  ])
  rows.push(headerRow(['Estado', 'Cantidad', 'Monto', 'Observación']))
  ;[
    ['Aprobado', 'Pagos confirmados'],
    ['Pendiente', 'Requieren revisión'],
    ['Rechazado', 'No cuentan como ingreso'],
  ].forEach(([status, note], index) => {
    rows.push(dataRow([
      textCell(status),
      formulaCell(`=COUNTIF('Pagos'!F5:F${paymentEnd},A${rows.length + 1})`),
      formulaCell(`=SUMIF('Pagos'!F5:F${paymentEnd},A${rows.length + 1},'Pagos'!D5:D${paymentEnd})`, MONEY_FORMAT),
      textCell(note),
    ], index))
  })

  return {
    data: rows, sheet: 'Resumen', columns, stickyRowsCount: 2,
    showGridLines: false, orientation: 'portrait', zoomScale: 0.9,
  }
}

export const buildGeneralReportSheets = (members, payments, plans = [], gym = null) => {
  const gymName = gym?.name || 'Control Gym'
  const memberRows = buildMemberRows(members, payments)
  const paymentRows = buildPaymentRows(members, payments)
  const planRows = buildPlanRows(plans)
  const memberEnd = 4 + Math.max(1, memberRows.length)
  const paymentEnd = 4 + Math.max(1, paymentRows.length)

  const membersSheet = makeTableSheet({
    title: 'Miembros', subtitle: gymName, sheet: 'Miembros',
    headers: [
      'Nombre', 'DPI', 'Correo', 'Teléfono', 'Miembro desde', 'Plan',
      'Membresía', 'Estado de cuota', 'Último vencimiento', 'Precio del plan',
      'Contacto de emergencia',
    ],
    rows: memberRows,
    columns: [
      { width: 28 }, { width: 18 }, { width: 30 }, { width: 16 }, { width: 16 },
      { width: 22 }, { width: 14 }, { width: 20 }, { width: 18 }, { width: 17 }, { width: 30 },
    ],
  })

  const paymentsSheet = makeTableSheet({
    title: 'Pagos', subtitle: gymName, sheet: 'Pagos',
    headers: ['Miembro', 'Fecha de pago', 'Vencimiento', 'Monto', 'Método', 'Estado', 'Revisado', 'Notas'],
    rows: paymentRows,
    columns: [
      { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 },
      { width: 16 }, { width: 14 }, { width: 19 }, { width: 36 },
    ],
  })

  const plansSheet = makeTableSheet({
    title: 'Planes', subtitle: gymName, sheet: 'Planes',
    headers: ['Plan', 'Precio', 'Duración (días)', 'Miembros activos', 'Ingreso estimado', 'Descripción', 'Beneficios'],
    rows: planRows,
    columns: [
      { width: 24 }, { width: 15 }, { width: 17 }, { width: 18 },
      { width: 19 }, { width: 38 }, { width: 55 },
    ],
  })

  // Completar las fórmulas de la hoja Planes después de conocer sus filas.
  if (planRows.length) {
    plansSheet.data.slice(4).forEach((row, index) => {
      const excelRow = index + 5
      row[3] = formulaCell(`=COUNTIFS('Miembros'!F5:F${memberEnd},A${excelRow},'Miembros'!G5:G${memberEnd},"Activo")`)
      row[4] = formulaCell(`=B${excelRow}*D${excelRow}`, MONEY_FORMAT)
    })
  }

  return [
    buildGeneralSummarySheet({ gymName, memberEnd, paymentEnd, plans }),
    membersSheet,
    paymentsSheet,
    plansSheet,
  ]
}

export const generateGeneralReportExcel = async (members, payments, plans = [], gym = null) => {
  await writeXlsxFile(buildGeneralReportSheets(members, payments, plans, gym), {
    fontFamily: 'Arial', fontSize: 10,
  }).toFile(`Reporte_General_${safeFilename(gym?.name || 'Control_Gym')}_${filenameDate()}.xlsx`)
}

const AUDIT_LABELS = {
  'session.login': 'Inicio de sesión',
  'session.logout': 'Cierre de sesión',
  'account.password_changed': 'Contraseña actualizada',
  'profile.updated': 'Perfil actualizado',
  'profile.avatar_updated': 'Fotografía de perfil actualizada',
  'profile.preferences_updated': 'Preferencias actualizadas',
  'gym.updated': 'Configuración del gimnasio actualizada',
  'member.created': 'Miembro creado',
  'member.updated': 'Miembro actualizado',
  'member.deactivated': 'Miembro desactivado',
  'member.archived': 'Miembro archivado',
  'member.restored': 'Miembro restaurado',
  'plan.created': 'Plan creado',
  'plan.updated': 'Plan actualizado',
  'plan.archived': 'Plan archivado',
  'payment.submitted': 'Pago enviado para revisión',
  'payment.voucher_attached': 'Comprobante adjuntado',
  'payment.approved': 'Pago aprobado',
  'payment.rejected': 'Pago rechazado',
  'payment.cash_registered': 'Pago registrado en recepción',
  'attendance.checked_in': 'Check-in registrado',
  'attendance.manually_added': 'Asistencia agregada manualmente',
  'attendance.manually_removed': 'Asistencia eliminada manualmente',
  'measurement.created': 'Medidas registradas',
  'measurement.updated': 'Medidas actualizadas',
  'measurement.deleted': 'Registro de medidas eliminado',
  'progress_photo.created': 'Foto de progreso agregada',
  'progress_photo.updated': 'Foto de progreso actualizada',
  'progress_photo.deleted': 'Foto de progreso eliminada',
  'announcement.created': 'Anuncio publicado',
  'announcement.updated': 'Anuncio actualizado',
  'announcement.deleted': 'Anuncio eliminado',
}

const auditCategory = action => {
  if (action.startsWith('payment.')) return 'Pagos'
  if (action.startsWith('attendance.')) return 'Asistencia'
  if (action.startsWith('measurement.') || action.startsWith('progress_photo.')) return 'Progreso'
  if (action.startsWith('announcement.')) return 'Anuncios'
  if (action.startsWith('plan.') || action.startsWith('gym.')) return 'Configuración'
  if (action.startsWith('session.') || action.startsWith('account.')) return 'Acceso'
  return 'Miembros'
}

const auditDetail = details => {
  if (!details) return ''
  const parts = []
  if (details.cycles) parts.push(`${details.cycles} cuota${Number(details.cycles) === 1 ? '' : 's'}`)
  if (details.total != null) parts.push(`Total Q ${Number(details.total).toFixed(2)}`)
  else if (details.amount != null) parts.push(`Q ${Number(details.amount).toFixed(2)}`)
  if (details.method) parts.push(`Método: ${paymentMethodLabel(details.method)}`)
  if (details.date) parts.push(`Fecha: ${details.date}`)
  if (Array.isArray(details.changed_fields) && details.changed_fields.length) {
    parts.push(`Campos modificados: ${details.changed_fields.join(', ')}`)
  }
  return parts.join(' · ')
}

const buildAuditRows = events => (events || []).map(event => [
  dateCell(event.created_at, true),
  textCell(AUDIT_LABELS[event.action] || event.action),
  textCell(auditCategory(event.action)),
  textCell(event.actor_name || 'Sistema'),
  textCell(event.actor_email || ''),
  textCell(event.actor_role === 'admin' ? 'Administrador' : event.actor_role === 'user' ? 'Miembro' : 'Sistema'),
  textCell(event.details?.target_name || ''),
  textCell(auditDetail(event.details), { wrap: true }),
])

const buildAuditSummarySheet = ({ gymName, eventEnd, events }) => {
  const categories = ['Miembros', 'Pagos', 'Asistencia', 'Progreso', 'Anuncios', 'Configuración', 'Acceso']
  const rows = [
    ...titleRows('Reporte de Bitácora', gymName, 4),
    [summaryLabel('Acciones registradas'), null, summaryLabel('Acciones de administradores'), null],
    [summaryValue(`=COUNTA('Bitácora'!A5:A${eventEnd})`), null,
      summaryValue(`=COUNTIF('Bitácora'!F5:F${eventEnd},"Administrador")`), null],
    blankRow(4),
    [summaryLabel('Acciones de miembros'), null, summaryLabel('Eventos de acceso'), null],
    [summaryValue(`=COUNTIF('Bitácora'!F5:F${eventEnd},"Miembro")`), null,
      summaryValue(`=COUNTIF('Bitácora'!C5:C${eventEnd},"Acceso")`), null],
    blankRow(4),
    [textCell('Distribución por categoría', {
      columnSpan: 4, backgroundColor: COLORS.navySoft, textColor: COLORS.white,
      fontWeight: 'bold', height: 25,
    }), null, null, null],
    headerRow(['Categoría', 'Cantidad', 'Participación', 'Observación']),
  ]

  categories.forEach((category, index) => {
    const rowNumber = rows.length + 1
    rows.push(dataRow([
      textCell(category),
      formulaCell(`=COUNTIF('Bitácora'!C5:C${eventEnd},A${rowNumber})`),
      formulaCell(`=IFERROR(B${rowNumber}/COUNTA('Bitácora'!A5:A${eventEnd}),0)`, '0.0%'),
      textCell(category === 'Acceso' ? 'Inicios, cierres y contraseñas' : ''),
    ], index))
  })

  if ((events || []).length) {
    const dates = events.map(event => toDate(event.created_at)).filter(Boolean).sort((a, b) => a - b)
    rows.push(blankRow(4))
    rows.push([
      textCell('Período incluido', { fontWeight: 'bold', textColor: COLORS.muted }),
      dateCell(dates[0], true),
      textCell('hasta', { align: 'center', textColor: COLORS.muted }),
      dateCell(dates.at(-1), true),
    ])
  }

  return {
    data: rows, sheet: 'Resumen', columns: [{ width: 28 }, { width: 18 }, { width: 20 }, { width: 34 }],
    stickyRowsCount: 2, showGridLines: false, zoomScale: 0.9,
  }
}

export const buildAuditReportSheets = (events, gym = null) => {
  const gymName = gym?.name || 'Control Gym'
  const rows = buildAuditRows(events)
  const eventEnd = 4 + Math.max(1, rows.length)
  const detailSheet = makeTableSheet({
    title: 'Bitácora detallada', subtitle: gymName, sheet: 'Bitácora',
    headers: ['Fecha y hora', 'Acción', 'Categoría', 'Usuario', 'Correo', 'Rol', 'Persona o elemento afectado', 'Detalles'],
    rows,
    columns: [
      { width: 20 }, { width: 34 }, { width: 18 }, { width: 27 },
      { width: 31 }, { width: 17 }, { width: 30 }, { width: 52 },
    ],
  })
  return [buildAuditSummarySheet({ gymName, eventEnd, events }), detailSheet]
}

export const generateAuditReportExcel = async (events, gym = null) => {
  await writeXlsxFile(buildAuditReportSheets(events, gym), {
    fontFamily: 'Arial', fontSize: 10,
  }).toFile(`Reporte_Bitacora_${safeFilename(gym?.name || 'Control_Gym')}_${filenameDate()}.xlsx`)
}

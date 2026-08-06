import writeXlsxFile from 'write-excel-file/browser'
import {
  formatDate,
  getLastRegisteredDueDate,
  getMemberPaymentStatus,
  paymentStatusLabel,
} from './helpers.js'

const safeFilename = value => String(value || 'miembro')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'miembro'

const objectsToExcelRows = rows => {
  const headers = rows.length ? Object.keys(rows[0]) : ['Sin datos']
  const headerRow = headers.map(value => ({
    value,
    fontWeight: 'bold',
    textColor: '#FFFFFF',
    backgroundColor: '#F97316',
    align: 'center',
  }))
  const dataRows = rows.map(row => headers.map(key => ({ value: row[key] ?? '' })))
  return [headerRow, ...dataRows]
}

const paymentMethodLabel = method => (
  method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'Depósito'
)

const approvalLabel = status => (
  status === 'approved' ? 'Aprobado' : status === 'pending' ? 'Pendiente' : 'Rechazado'
)

export const buildPaymentHistorySheet = (payments, member) => {
  const rows = (payments || []).map(payment => ({
    Nombre: member?.profile?.full_name || '',
    'Fecha de pago': formatDate(payment.payment_date),
    Vencimiento: formatDate(payment.due_date),
    'Monto (Q)': Number(payment.amount || 0),
    Método: paymentMethodLabel(payment.payment_method),
    Estado: approvalLabel(payment.status),
    Notas: payment.notes || '',
  }))

  return { data: objectsToExcelRows(rows), sheet: 'Pagos' }
}

export const generatePaymentHistoryExcel = async (payments, member) => {
  const { data, sheet } = buildPaymentHistorySheet(payments, member)
  await writeXlsxFile(data, { sheet })
    .toFile(`pagos_${safeFilename(member?.profile?.full_name)}.xlsx`)
}

export const buildMasterWorkbookSheets = (members, payments) => {
  const memberRows = (members || []).map(member => {
    const paymentState = getMemberPaymentStatus(member, payments)
    const dueDate = getLastRegisteredDueDate(member.id, payments)
    return {
      Nombre: member.profile?.full_name || '',
      Email: member.profile?.email || '',
      Teléfono: member.profile?.phone || '',
      Inicio: formatDate(member.start_date),
      Plan: member.plan?.name || 'Sin plan',
      Membresía: member.status === 'active' ? 'Activo' : member.status === 'inactive' ? 'Inactivo' : 'Suspendido',
      'Estado de cuota': paymentStatusLabel[paymentState]?.text || 'Sin información',
      'Último vencimiento': dueDate ? formatDate(dueDate) : '—',
      'Contacto de emergencia': member.emergency_contact || '',
    }
  })

  const memberNames = new Map((members || []).map(member => [member.id, member.profile?.full_name || '']))
  const paymentRows = (payments || []).map(payment => ({
    Miembro: payment.member?.profile?.full_name || memberNames.get(payment.member_id) || '',
    'Fecha de pago': formatDate(payment.payment_date),
    Vencimiento: formatDate(payment.due_date),
    'Monto (Q)': Number(payment.amount || 0),
    Método: paymentMethodLabel(payment.payment_method),
    Estado: approvalLabel(payment.status),
    Notas: payment.notes || '',
  }))

  return [
    { data: objectsToExcelRows(memberRows), sheet: 'Miembros' },
    { data: objectsToExcelRows(paymentRows), sheet: 'Pagos' },
  ]
}

export const generateMasterExcel = async (members, payments) => {
  await writeXlsxFile(buildMasterWorkbookSheets(members, payments))
    .toFile('reporte_maestro_gimnasio.xlsx')
}

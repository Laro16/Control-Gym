import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAuditReportSheets,
  buildGeneralReportSheets,
} from '../src/utils/excelExports.js'

const members = [{
  id: 'member-1', profile: {
    full_name: 'Ana López', dpi: '1234567890101', email: 'ana@example.com', phone: '55550000',
  },
  start_date: '2026-08-01', status: 'active', plan_id: 'plan-1',
  plan: { id: 'plan-1', name: 'Plan Básico', price: 150, duration_days: 30 },
  emergency_contact: 'Carlos 55551111',
}]

const payments = [{
  id: 'payment-1', member_id: 'member-1', amount: 150,
  payment_date: '2026-08-01', due_date: '2026-08-31',
  payment_method: 'cash', status: 'approved', approved_at: '2026-08-01T15:00:00Z',
}]

const plans = [{
  id: 'plan-1', name: 'Plan Básico', price: 150, duration_days: 30,
  description: 'Acceso general', features: ['Máquinas', 'Medidas'],
}]

test('Reporte General contiene resumen, miembros, pagos y planes con datos tipados', () => {
  const sheets = buildGeneralReportSheets(members, payments, plans, { name: 'Control Gym' })
  assert.deepEqual(sheets.map(sheet => sheet.sheet), ['Resumen', 'Miembros', 'Pagos', 'Planes'])
  assert.equal(sheets[0].data[0][0].value, 'Reporte General')
  assert.match(sheets[0].data[4][0].value, /COUNTA\('Miembros'/)
  assert.equal(sheets[1].data[4][1].format, '@')
  assert.equal(sheets[1].data[4][1].value, '1234 56789 0101')
  assert.equal(sheets[1].data[4][3].value, '5555 0000')
  assert.equal(sheets[1].data[4][4].type, Date)
  assert.equal(sheets[1].data[4][9].type, Number)
  assert.match(sheets[3].data[4][3].value, /COUNTIFS\('Miembros'/)
})

test('Reporte de Bitácora incluye responsable, afectado y resumen por categoría', () => {
  const events = [{
    id: 1, created_at: '2026-08-10T22:00:00Z', action: 'payment.approved',
    actor_name: 'Administrador Principal', actor_email: 'admin@example.com', actor_role: 'admin',
    details: { target_name: 'Ana López', amount: 150, method: 'cash' },
  }]
  const sheets = buildAuditReportSheets(events, { name: 'Control Gym' })
  assert.deepEqual(sheets.map(sheet => sheet.sheet), ['Resumen', 'Bitácora'])
  assert.equal(sheets[0].data[0][0].value, 'Reporte de Bitácora')
  assert.match(sheets[0].data[4][0].value, /COUNTA\('Bitácora'/)
  const row = sheets[1].data[4]
  assert.equal(row[0].type, Date)
  assert.equal(row[3].value, 'Administrador Principal')
  assert.equal(row[6].value, 'Ana López')
  assert.match(row[7].value, /Q 150\.00/)
})

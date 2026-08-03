import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  calculateStreak,
  getMemberPaymentStatus,
  today,
} from '../src/utils/helpers.js'

test('addDays conserva fechas locales y cruza meses correctamente', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('un pago pendiente tiene prioridad como pendiente de aprobación', () => {
  const member = { id: 'm1', start_date: '2026-01-01', plan: { duration_days: 30 } }
  const payments = [{ member_id: 'm1', status: 'pending', due_date: addDays(today(), 30) }]
  assert.equal(getMemberPaymentStatus(member, payments), 'pending_approval')
})

test('una racha cuenta hoy y omite un día de cierre', () => {
  const current = today()
  const yesterday = addDays(current, -1)
  const before = addDays(current, -2)
  const closedDow = new Date(`${yesterday}T12:00:00`).getDay()
  const attendance = [
    { attended_date: current },
    { attended_date: before },
  ]
  assert.equal(calculateStreak(attendance, { closedWeekdays: [closedDow] }), 2)
})


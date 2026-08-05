import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  buildPaymentCycleDates,
  calculateStreak,
  getLastRegisteredDueDate,
  getMemberPaymentStatus,
  selectConsecutiveCycleDates,
  today,
} from '../src/utils/helpers.js'

test('addDays conserva fechas locales y cruza meses correctamente', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('un pago pendiente tiene prioridad como pendiente de aprobación', () => {
  const member = { id: 'm1', plan_id: 'p1', start_date: '2026-01-01', plan: { duration_days: 30 } }
  const payments = [{ member_id: 'm1', status: 'pending', due_date: addDays(today(), 30) }]
  assert.equal(getMemberPaymentStatus(member, payments), 'pending_approval')
})

test('el estado usa el vencimiento más reciente aunque los pagos lleguen desordenados', () => {
  const member = { id: 'm1', plan_id: 'p1', start_date: '2026-01-01', plan: { duration_days: 30 } }
  const payments = [
    { member_id: 'm1', status: 'approved', due_date: addDays(today(), -20) },
    { member_id: 'm1', status: 'pending', due_date: addDays(today(), 30) },
    { member_id: 'm1', status: 'rejected', due_date: addDays(today(), 60) },
  ]
  assert.equal(getMemberPaymentStatus(member, payments), 'pending_approval')
  assert.equal(getLastRegisteredDueDate(member.id, payments), addDays(today(), 30))
})

test('los ciclos seleccionados siempre son consecutivos desde el primero', () => {
  const cycles = buildPaymentCycleDates('2026-01-01', 30, 4)
  assert.deepEqual(cycles, ['2026-01-31', '2026-03-02', '2026-04-01', '2026-05-01'])
  assert.deepEqual(selectConsecutiveCycleDates(cycles, cycles[2], []), cycles.slice(0, 3))
  assert.deepEqual(selectConsecutiveCycleDates(cycles, cycles[1], cycles.slice(0, 3)), cycles.slice(0, 2))
  assert.deepEqual(selectConsecutiveCycleDates(cycles, cycles[0], cycles.slice(0, 1)), [])
})

test('sin pagos, la cuota vence según inicio y duración del plan', () => {
  const member = {
    id: 'm1',
    plan_id: 'p1',
    start_date: addDays(today(), -31),
    plan: { duration_days: 30 },
  }
  assert.equal(getMemberPaymentStatus(member, []), 'overdue')
})

test('un miembro sin plan no se cuenta como cuota vencida', () => {
  const member = { id: 'm1', plan_id: null, start_date: addDays(today(), -90), plan: null }
  assert.equal(getMemberPaymentStatus(member, []), 'no_plan')
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

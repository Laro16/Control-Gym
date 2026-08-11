import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('la Edge Function nunca reutiliza una cuenta existente cambiando su contraseña', () => {
  const source = read('supabase/functions/admin-users/index.ts')
  assert.equal(source.includes('listUsers('), false)
  assert.equal(/updateUserById\([\s\S]{0,300}password\s*[:,]/.test(source), false)
  assert.match(source, /Este email ya está registrado/)
  assert.match(source, /APP_ORIGINS no está configurado/)
})

test('el check-in estricto solo considera pagos aprobados', () => {
  const sql = read('supabase/migrations/20260808_single_gym_hardening.sql')
  const start = sql.indexOf('create or replace function public.register_checkin')
  const end = sql.indexOf('revoke all on function public.register_checkin', start)
  const checkin = sql.slice(start, end)
  assert.match(checkin, /p\.status = 'approved'/)
  assert.equal(checkin.includes("p.status <> 'rejected'"), false)
  assert.ok(
    checkin.indexOf("if v_plan_days is null then raise exception 'No tienes un plan activo'")
      < checkin.indexOf('if not coalesce(v_gym.allow_overdue_checkin'),
    'el plan activo debe validarse antes de evaluar si se permiten cuotas vencidas'
  )
})

test('los vouchers vinculados no tienen política de actualización', () => {
  const sql = read('supabase/migrations/20260808_single_gym_hardening.sql')
  assert.match(sql, /drop policy if exists vouchers_update_scoped/)
  assert.equal(/create policy vouchers_update_scoped/.test(sql), false)
  assert.match(sql, /not exists \(\s*select 1 from public\.payments p where p\.voucher_url = name/)
})

test('el frontend no solicita checkin_code al leer el gimnasio', () => {
  const source = read('src/supabase.jsx')
  const columns = source.slice(source.indexOf('const GYM_COLUMNS'), source.indexOf('const PAGE_SIZE'))
  assert.equal(columns.includes('checkin_code'), false)
})

test('el borrado permanente de miembros está deshabilitado', () => {
  const edge = read('supabase/functions/admin-users/index.ts')
  assert.match(edge, /El borrado permanente está deshabilitado/)
  const migration = read('supabase/migrations/20260808_single_gym_hardening.sql')
  assert.match(migration, /create or replace function public\.archive_member/)
})

test('estado activo, inactivo y archivado se sincroniza con el bloqueo de Auth', () => {
  const edge = read('supabase/functions/admin-users/index.ts')
  assert.match(edge, /const desiredBanState = status !== 'active'/)
  assert.match(edge, /const desiredBanState = body\.action !== 'restore'/)
  assert.match(edge, /await setBanState\(target\.profile_id, desiredBanState\)/)
  assert.match(edge, /await setBanState\(target\.profile_id, previousBanState\)/)
})

test('las funciones financieras no mezclan una fila compuesta con escalares en INTO', () => {
  for (const migration of [
    'supabase/migrations/20260804_financial_integrity.sql',
    'supabase/migrations/20260808_single_gym_hardening.sql',
  ]) {
    const sql = read(migration)
    assert.equal(/select\s+m\s*,[\s\S]{0,160}?into\s+v_member\s*,/i.test(sql), false)
  }
})

test('una instalación nueva incluye esquema base y límite de un gimnasio', () => {
  const initial = read('supabase/migrations/20260801_initial_schema.sql')
  assert.match(initial, /create table if not exists public\.gyms/)
  assert.match(initial, /single_gym_only_uidx/)
  assert.match(initial, /file_size_limit/)
})

test('el administrador entra sin MFA pero conserva autorización por rol y gimnasio', () => {
  const app = read('src/App.jsx')
  const edge = read('supabase/functions/admin-users/index.ts')
  const migration = read('supabase/migrations/20260810_remove_admin_mfa.sql')
  const config = read('supabase/config.toml')
  assert.equal(app.includes('AdminMfaGate'), false)
  assert.equal(edge.includes('verificación MFA'), false)
  assert.equal(migration.includes('aal2'), false)
  assert.match(migration, /p\.role = 'admin' and p\.gym_id is not null/)
  assert.match(config, /\[functions\.admin-users\][\s\S]*verify_jwt = false/)
})

test('las consultas members-profiles especifican la relación del propietario', () => {
  const frontend = read('src/supabase.jsx')
  const edge = read('supabase/functions/admin-users/index.ts')
  assert.equal(/profile:profiles\((?:\*|role)\)/.test(frontend), false)
  assert.match(frontend, /profile:profiles!members_profile_id_fkey\(\*\)/)
  assert.match(edge, /profile:profiles!members_profile_id_fkey\(role\)/)
})

test('los beneficios de planes se editan y muestran como elementos separados', () => {
  const plans = read('src/components/AdminPlans.jsx')
  assert.match(plans, /features: \(plan\.features \|\| \[\]\)\.join\('\\n'\)/)
  assert.match(plans, /form\.features\.split\(\/\\r\?\\n\/\)/)
  assert.match(plans, /Escribe un beneficio por línea/)
  assert.match(plans, /divide-y divide-gray-800\/70/)
  assert.match(plans, /items-start gap-2 py-1\.5/)
})

test('la ficha móvil se monta fuera del header y deja visible cerrar sesión', () => {
  const dashboard = read('src/components/UserDashboard.jsx')
  const account = read('src/components/UserAccount.jsx')
  const styles = read('src/index.css')
  const headerEnd = dashboard.indexOf('</header>')
  const panelRender = dashboard.indexOf('{showAccount && (', headerEnd)

  assert.ok(headerEnd >= 0 && panelRender > headerEnd)
  assert.equal(account.includes('sm:absolute'), false)
  assert.match(account, /flex-shrink-0 pt-3 mt-3 border-t/)
  assert.match(styles, /bottom: calc\(5\.75rem \+ env\(safe-area-inset-bottom, 0px\)\)/)
})

test('la bitácora conserva al responsable y cubre cambios directos', () => {
  const sql = read('supabase/migrations/20260810_comprehensive_audit_log.sql')
  for (const column of ['actor_name', 'actor_email', 'actor_role']) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`))
  }
  for (const trigger of [
    'audit_profiles_update', 'audit_gyms_update', 'audit_measurements_change',
    'audit_progress_photos_change', 'audit_announcements_change',
    'audit_attendance_admin_change',
  ]) {
    assert.match(sql, new RegExp(`create trigger ${trigger}`))
  }
  assert.match(sql, /p_action not in \('session\.login', 'session\.logout', 'account\.password_changed'\)/)
  assert.match(sql, /- 'password' - 'new_password' - 'token' - 'token_value'/)
  assert.match(sql, /revoke insert, update, delete on public\.audit_events/)
})

test('la bitácora administrativa muestra usuario, correo y detalles legibles', () => {
  const audit = read('src/components/AdminAudit.jsx')
  const login = read('src/components/Login.jsx')
  const app = read('src/App.jsx')
  assert.match(audit, /event\.actor_name/)
  assert.match(audit, /event\.actor_email/)
  assert.match(audit, /Administrador/)
  assert.equal(audit.includes('JSON.stringify(event.details'), false)
  assert.match(login, /recordMyAuditEvent\('session\.login'\)/)
  assert.match(app, /recordMyAuditEvent\('session\.logout'\)/)
})

-- Ejecutar DESPUES de 20260802_security_integrity.sql y
-- 20260804_financial_integrity.sql.
-- Estas consultas no modifican datos.

-- 1) Los 12 objetos deben tener RLS habilitado (rowsecurity = true).
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'profiles','gyms','notifications','plans','members','payments',
    'measurements','announcements','progress_photos','attendance',
    'audit_events','checkin_tokens'
  )
order by relname;

-- 2) No debe aparecer profiles_own, payments_user_insert,
-- payments_admin_gym ni attendance_user_own. Para pagos de administrador debe
-- aparecer payments_admin_select_gym con cmd SELECT; toda escritura financiera
-- se realiza mediante funciones transaccionales.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3) Los cuatro buckets deben respetar visibilidad y límites:
-- avatars=true, logos=true, progress=false, vouchers=false.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars','logos','progress','vouchers')
order by id;

-- 4) Debe devolver cero filas: no puede haber asistencia duplicada por dia.
select member_id, attended_date, count(*)
from public.attendance
group by member_id, attended_date
having count(*) > 1;

-- 5) Debe devolver cero filas: solo puede existir una cuota no rechazada por
-- miembro y vencimiento.
select member_id, due_date, count(*)
from public.payments
where status <> 'rejected'
group by member_id, due_date
having count(*) > 1;

-- 6) Debe devolver allow_overdue_checkin con tipo boolean.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'gyms'
  and column_name = 'allow_overdue_checkin';

-- 7) Debe devolver todas las funciones financieras y de seguridad.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'register_checkin','submit_member_payments',
    'attach_payment_voucher','review_payment','register_admin_payment',
    'archive_plan','delete_member_data','issue_checkin_token',
    'get_gym_business_date','provision_member_data',
    'admin_update_member_data','archive_member','restore_member',
    'deactivate_member','save_plan','complete_initial_password_change',
    'generate_payment_notifications'
  )
order by routine_name;

-- 8) Debe devolver cero filas: un miembro nunca referencia un plan de otro gym.
select m.id as member_id, m.gym_id as member_gym, p.gym_id as plan_gym
from public.members m
join public.plans p on p.id = m.plan_id
where m.gym_id is distinct from p.gym_id;

-- 9) Debe devolver cero filas: DPI duplicado dentro del mismo gimnasio.
select gym_id, dpi, count(*)
from public.profiles
where dpi is not null
group by gym_id, dpi
having count(*) > 1;

-- 10) Debe devolver cero filas: referencias esenciales huérfanas.
select 'member_without_profile' as problem, m.id
from public.members m left join public.profiles p on p.id = m.profile_id
where p.id is null
union all
select 'payment_without_member', pay.id
from public.payments pay left join public.members m on m.id = pay.member_id
where m.id is null;

-- 11) Debe devolver true. Si devuelve false, habilita pg_cron antes de producción.
select exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_installed;
-- Si el resultado anterior es true, ejecuta además:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'control-gym-payment-notifications';

-- 12) No debe aparecer vouchers_update_scoped ni progress_update_scoped.
-- Las políticas DELETE solo permiten al miembro limpiar archivos no vinculados.
select policyname, cmd, qual
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'vouchers_update_scoped','vouchers_delete_scoped',
    'progress_update_scoped','progress_delete_scoped'
  )
order by policyname;

-- 13) Confirmar que miembros y planes no tienen DML directo para authenticated.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('members','plans','payments')
  and grantee = 'authenticated'
order by table_name, privilege_type;

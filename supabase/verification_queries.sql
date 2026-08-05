-- Ejecutar DESPUES de 20260802_security_integrity.sql y
-- 20260804_financial_integrity.sql.
-- Estas consultas no modifican datos.

-- 1) Los 10 objetos deben tener RLS habilitado (rowsecurity = true).
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'profiles','gyms','notifications','plans','members','payments',
    'measurements','announcements','progress_photos','attendance'
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

-- 3) Los cuatro buckets deben respetar esta visibilidad:
-- avatars=true, logos=true, progress=false, vouchers=false.
select id, public
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

-- 7) Debe devolver todas las funciones financieras y de check-in.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'register_checkin','submit_member_payments',
    'attach_payment_voucher','review_payment','register_admin_payment',
    'archive_plan','delete_member_data'
  )
order by routine_name;

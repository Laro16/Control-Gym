-- Ejecutar DESPUES de 20260802_security_integrity.sql.
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

-- 2) No debe aparecer profiles_own ni payments_user_insert ni
-- attendance_user_own. Deben aparecer las politicas nuevas y especificas.
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

-- 5) Debe devolver las cuatro funciones y sus permisos.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'register_checkin','submit_member_payments',
    'attach_payment_voucher','delete_member_data'
  )
order by routine_name;

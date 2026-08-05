-- Control Gym: integridad financiera y reglas operativas
-- Fecha: 2026-08-04
-- Ejecutar UNA VEZ después de 20260802_security_integrity.sql.
-- Es idempotente: puede volver a ejecutarse si el SQL Editor se interrumpe.

begin;

-- ---------------------------------------------------------------------------
-- Configuración explícita del acceso con cuotas vencidas
-- ---------------------------------------------------------------------------
alter table public.gyms
  add column if not exists allow_overdue_checkin boolean not null default true;

-- ---------------------------------------------------------------------------
-- Recuperar gym_id cuando pueda inferirse sin mezclar gimnasios
-- ---------------------------------------------------------------------------
update public.announcements a
set gym_id = p.gym_id
from public.profiles p
where a.gym_id is null
  and a.created_by = p.id
  and p.gym_id is not null;

with plan_gym as (
  select m.plan_id, min(m.gym_id::text)::uuid as gym_id
  from public.members m
  where m.plan_id is not null and m.gym_id is not null
  group by m.plan_id
  having count(distinct m.gym_id) = 1
)
update public.plans p
set gym_id = pg.gym_id
from plan_gym pg
where p.id = pg.plan_id and p.gym_id is null;

update public.plans
set gym_id = (select g.id from public.gyms g limit 1)
where gym_id is null and (select count(*) from public.gyms) = 1;

update public.announcements
set gym_id = (select g.id from public.gyms g limit 1)
where gym_id is null and (select count(*) from public.gyms) = 1;

-- Si el frontend olvidara gym_id, se completa con el gimnasio autenticado.
-- También impide intentar escribir datos en otro gimnasio.
create or replace function public.enforce_current_gym_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    raise exception 'Solo un administrador puede realizar esta acción';
  end if;

  v_gym_id := public.current_gym_id();
  if v_gym_id is null then
    raise exception 'El administrador no tiene gimnasio asignado';
  end if;

  if new.gym_id is null then
    new.gym_id := v_gym_id;
  elsif new.gym_id <> v_gym_id then
    raise exception 'No puedes guardar datos en otro gimnasio';
  end if;
  return new;
end;
$$;

drop trigger if exists plans_enforce_gym on public.plans;
create trigger plans_enforce_gym
  before insert or update on public.plans
  for each row execute function public.enforce_current_gym_id();

drop trigger if exists announcements_enforce_gym on public.announcements;
create trigger announcements_enforce_gym
  before insert or update on public.announcements
  for each row execute function public.enforce_current_gym_id();

revoke all on function public.enforce_current_gym_id() from public;

-- ---------------------------------------------------------------------------
-- Validaciones para nuevas operaciones
-- NOT VALID conserva datos históricos que pudieran requerir revisión manual,
-- pero desde ahora impide guardar nuevos valores inválidos.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_duration_valid') then
    alter table public.plans
      add constraint plans_duration_valid
      check (duration_days between 1 and 730) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_price_valid') then
    alter table public.plans
      add constraint plans_price_valid
      check (price >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_amount_valid') then
    alter table public.payments
      add constraint payments_amount_valid
      check (amount >= 0) not valid;
  end if;
end;
$$;

-- Conservar una sola cuota vigente por miembro y vencimiento. Si ya existían
-- duplicados, se conserva primero la aprobada (o la más antigua) y las demás
-- quedan rechazadas con una nota auditable; no se borra historial financiero.
with ranked as (
  select
    p.id,
    row_number() over (
      partition by p.member_id, p.due_date
      order by
        case p.status when 'approved' then 0 when 'pending' then 1 else 2 end,
        p.created_at nulls last,
        p.id
    ) as row_number
  from public.payments p
  where p.status <> 'rejected'
)
update public.payments p
set status = 'rejected',
    approved_by = null,
    approved_at = null,
    notes = concat_ws(E'\n', nullif(p.notes, ''), '[Duplicado cerrado automáticamente el 2026-08-04]')
from ranked r
where p.id = r.id and r.row_number > 1;

create unique index if not exists payments_member_due_open_uidx
  on public.payments(member_id, due_date)
  where status <> 'rejected';

-- La app ya no escribe pagos directamente desde el navegador. Los
-- administradores conservan lectura de su gimnasio, pero altas y revisiones
-- pasan exclusivamente por las funciones transaccionales de este archivo.
drop policy if exists payments_admin_gym on public.payments;
drop policy if exists payments_admin_select_gym on public.payments;
create policy payments_admin_select_gym on public.payments
  for select to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Notificaciones internas para administradores del gimnasio
-- ---------------------------------------------------------------------------
create or replace function public.notify_gym_admins(
  p_gym_id uuid,
  p_type text,
  p_title text,
  p_message text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications(profile_id, type, title, message, is_read)
  select p.id, p_type, p_title, p_message, false
  from public.profiles p
  where p.gym_id = p_gym_id and p.role = 'admin';
$$;

revoke all on function public.notify_gym_admins(uuid, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- Pago de miembro: ciclos consecutivos, sin huecos ni duplicados
-- ---------------------------------------------------------------------------
create or replace function public.submit_member_payments(
  p_due_dates date[],
  p_payment_method text,
  p_voucher_path text
)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_plan public.plans%rowtype;
  v_due date;
  v_today date;
  v_anchor date;
  v_expected date;
  v_payment public.payments%rowtype;
  v_count integer := 0;
  v_total numeric := 0;
  v_member_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(array_length(p_due_dates, 1), 0) < 1 or array_length(p_due_dates, 1) > 24 then
    raise exception 'Selecciona entre 1 y 24 ciclos';
  end if;
  if p_payment_method not in ('transfer', 'deposit') then
    raise exception 'Método de pago no permitido';
  end if;
  if nullif(trim(p_voucher_path), '') is null then raise exception 'Falta el comprobante'; end if;

  select m, pr.full_name
  into v_member, v_member_name
  from public.members m
  join public.profiles pr on pr.id = m.profile_id
  where m.profile_id = auth.uid()
  limit 1;

  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;
  if split_part(trim(p_voucher_path), '/', 1) <> v_member.id::text then
    raise exception 'El comprobante no pertenece al miembro autenticado';
  end if;

  select p.* into v_plan
  from public.plans p
  where p.id = v_member.plan_id
    and p.gym_id = v_member.gym_id
    and p.is_active = true;
  if v_plan.id is null then raise exception 'El miembro no tiene un plan activo'; end if;
  if v_plan.duration_days < 1 or v_plan.price < 0 then raise exception 'Configuración de plan inválida'; end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today
  from public.gyms g where g.id = v_member.gym_id;
  if v_today is null then raise exception 'Gimnasio no encontrado'; end if;

  select coalesce(max(p.due_date), v_member.start_date)
  into v_anchor
  from public.payments p
  where p.member_id = v_member.id and p.status <> 'rejected';

  v_expected := v_anchor + v_plan.duration_days;
  foreach v_due in array p_due_dates loop
    if v_due <> v_expected then
      raise exception 'Los ciclos deben ser consecutivos. El próximo vencimiento es %', v_expected;
    end if;
    if v_due > v_today + interval '18 months' then
      raise exception 'No se permiten pagos con más de 18 meses de anticipación';
    end if;

    insert into public.payments(
      member_id, amount, payment_method, payment_date, due_date,
      status, voucher_url, notes
    ) values (
      v_member.id, v_plan.price, p_payment_method, v_today, v_due,
      'pending', trim(p_voucher_path), 'Ciclo con vencimiento ' || v_due::text
    ) returning * into v_payment;

    v_count := v_count + 1;
    v_total := v_total + v_plan.price;
    v_expected := v_expected + v_plan.duration_days;
    return next v_payment;
  end loop;

  perform public.notify_gym_admins(
    v_member.gym_id,
    'custom',
    'Nuevo pago pendiente',
    v_member_name || ' registró ' || v_count ||
      case when v_count = 1 then ' ciclo por ' else ' ciclos por ' end ||
      'Q ' || to_char(v_total, 'FM999999990.00') || '.'
  );
end;
$$;

revoke all on function public.submit_member_payments(date[], text, text) from public;
grant execute on function public.submit_member_payments(date[], text, text) to authenticated;

-- Asociar comprobante a una cuota pendiente y avisar al administrador.
create or replace function public.attach_payment_voucher(
  p_payment_id uuid,
  p_voucher_path text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_member public.members%rowtype;
  v_today date;
  v_member_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if nullif(trim(p_voucher_path), '') is null then raise exception 'Falta el comprobante'; end if;

  select m, pr.full_name,
         timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_member, v_member_name, v_today
  from public.members m
  join public.profiles pr on pr.id = m.profile_id
  join public.gyms g on g.id = m.gym_id
  where m.profile_id = auth.uid() and m.status = 'active'
  limit 1;

  if v_member.id is null then raise exception 'No existe una membresía activa'; end if;
  if split_part(trim(p_voucher_path), '/', 1) <> v_member.id::text then
    raise exception 'El comprobante no pertenece al miembro autenticado';
  end if;

  update public.payments p
  set voucher_url = trim(p_voucher_path),
      payment_date = coalesce(p.payment_date, v_today),
      status = 'pending'
  where p.id = p_payment_id
    and p.member_id = v_member.id
    and p.status = 'pending'
  returning p.* into v_payment;

  if v_payment.id is null then raise exception 'Pago no encontrado o no modificable'; end if;

  perform public.notify_gym_admins(
    v_member.gym_id,
    'custom',
    'Nuevo comprobante',
    v_member_name || ' envió un comprobante por Q ' ||
      to_char(v_payment.amount, 'FM999999990.00') || '.'
  );
  return v_payment;
end;
$$;

revoke all on function public.attach_payment_voucher(uuid, text) from public;
grant execute on function public.attach_payment_voucher(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Revisión atómica: estado, aprobador, fecha y notificación
-- ---------------------------------------------------------------------------
create or replace function public.review_payment(
  p_payment_id uuid,
  p_status text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_profile_id uuid;
  v_voucher text;
  v_reviewed_count bigint;
  v_reviewed_total numeric;
  v_today date;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador puede revisar pagos';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Estado de revisión inválido';
  end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today
  from public.gyms g where g.id = public.current_gym_id();

  select p.* into v_payment
  from public.payments p
  join public.members m on m.id = p.member_id
  where p.id = p_payment_id
    and m.gym_id = public.current_gym_id()
    and p.status = 'pending'
  for update of p;
  if v_payment.id is null then
    raise exception 'Pago no encontrado o ya fue revisado';
  end if;

  -- Cuando un comprobante cubre varias cuotas, todas se revisan juntas. Así no
  -- quedan meses del mismo depósito aprobados y otros todavía pendientes.
  v_voucher := v_payment.voucher_url;

  with reviewed as (
    update public.payments p
    set status = p_status,
        approved_by = case when p_status = 'approved' then auth.uid() else null end,
        approved_at = case when p_status = 'approved' then now() else null end,
        payment_date = case when p_status = 'approved'
          then coalesce(p.payment_date, v_today)
          else p.payment_date
        end
    where p.member_id = v_payment.member_id
      and p.status = 'pending'
      and (
        (v_voucher is not null and p.voucher_url = v_voucher)
        or (v_voucher is null and p.id = v_payment.id)
      )
    returning p.amount
  )
  select count(*), coalesce(sum(amount), 0)
  into v_reviewed_count, v_reviewed_total
  from reviewed;

  if v_reviewed_count = 0 then
    raise exception 'El pago ya fue revisado';
  end if;

  select p.* into v_payment
  from public.payments p where p.id = p_payment_id;

  select m.profile_id into v_profile_id
  from public.members m where m.id = v_payment.member_id;

  insert into public.notifications(profile_id, type, title, message, is_read)
  values (
    v_profile_id,
    case when p_status = 'approved' then 'payment_approved' else 'payment_rejected' end,
    case when p_status = 'approved' then 'Pago aprobado ✅' else 'Pago rechazado' end,
    case when p_status = 'approved'
      then case when v_reviewed_count = 1
        then 'Tu pago de Q ' || to_char(v_reviewed_total, 'FM999999990.00') || ' fue aprobado.'
        else 'Tus ' || v_reviewed_count || ' cuotas por Q ' ||
          to_char(v_reviewed_total, 'FM999999990.00') || ' fueron aprobadas.'
      end
      else case when v_reviewed_count = 1
        then 'Tu pago de Q ' || to_char(v_reviewed_total, 'FM999999990.00') ||
          ' fue rechazado. Consulta con recepción.'
        else 'Tus ' || v_reviewed_count || ' cuotas por Q ' ||
          to_char(v_reviewed_total, 'FM999999990.00') ||
          ' fueron rechazadas. Consulta con recepción.'
      end
    end,
    false
  );

  return v_payment;
end;
$$;

revoke all on function public.review_payment(uuid, text) from public;
grant execute on function public.review_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Registro de pago por administrador: Supabase calcula el siguiente ciclo
-- ---------------------------------------------------------------------------
create or replace function public.register_admin_payment(
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_notes text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_plan public.plans%rowtype;
  v_payment public.payments%rowtype;
  v_anchor date;
  v_due date;
  v_today date;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador puede registrar pagos';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Monto inválido'; end if;
  if p_payment_method not in ('cash', 'transfer', 'deposit') then
    raise exception 'Método de pago inválido';
  end if;

  select m.* into v_member
  from public.members m
  where m.id = p_member_id and m.gym_id = public.current_gym_id();
  if v_member.id is null then raise exception 'Miembro no encontrado'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;
  if exists (
    select 1 from public.payments p
    where p.member_id = v_member.id and p.status = 'pending'
  ) then
    raise exception 'Este miembro tiene un pago pendiente de revisión';
  end if;

  select p.* into v_plan
  from public.plans p
  where p.id = v_member.plan_id
    and p.gym_id = v_member.gym_id
    and p.is_active = true;
  if v_plan.id is null then raise exception 'El miembro no tiene un plan activo'; end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today from public.gyms g where g.id = v_member.gym_id;
  if p_payment_date is not null and p_payment_date > v_today then
    raise exception 'La fecha de pago no puede estar en el futuro';
  end if;

  select coalesce(max(p.due_date), v_member.start_date)
  into v_anchor
  from public.payments p
  where p.member_id = v_member.id and p.status <> 'rejected';
  v_due := v_anchor + v_plan.duration_days;

  insert into public.payments(
    member_id, amount, payment_date, due_date, payment_method,
    status, notes, approved_by, approved_at
  ) values (
    v_member.id, p_amount, coalesce(p_payment_date, v_today), v_due, p_payment_method,
    'approved', nullif(trim(p_notes), ''), auth.uid(), now()
  ) returning * into v_payment;

  insert into public.notifications(profile_id, type, title, message, is_read)
  values (
    v_member.profile_id,
    'payment_approved',
    'Pago registrado ✅',
    'Recepción registró tu pago de Q ' || to_char(v_payment.amount, 'FM999999990.00') ||
      '. Tu nuevo vencimiento es ' || to_char(v_due, 'DD/MM/YYYY') || '.',
    false
  );

  return v_payment;
end;
$$;

revoke all on function public.register_admin_payment(uuid, numeric, text, date, text) from public;
grant execute on function public.register_admin_payment(uuid, numeric, text, date, text) to authenticated;

-- Un plan con miembros vigentes no puede archivarse y dejarlos sin renovar.
create or replace function public.archive_plan(p_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador puede archivar planes';
  end if;
  if not exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.gym_id = public.current_gym_id() and p.is_active = true
  ) then
    raise exception 'Plan no encontrado';
  end if;
  if exists (
    select 1 from public.members m
    where m.plan_id = p_plan_id and m.status <> 'inactive'
  ) then
    raise exception 'No puedes archivar un plan que todavía tiene miembros asignados';
  end if;

  update public.plans set is_active = false where id = p_plan_id;
  return true;
end;
$$;

revoke all on function public.archive_plan(uuid) from public;
grant execute on function public.archive_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in: la regla de cuota vencida ahora depende de la configuración del gym
-- ---------------------------------------------------------------------------
create or replace function public.register_checkin(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_gym public.gyms%rowtype;
  v_today date;
  v_check date;
  v_due date;
  v_plan_days integer;
  v_streak integer := 0;
  v_inserted boolean := false;
  v_row_count integer := 0;
  v_rest boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select m.* into v_member
  from public.members m
  where m.profile_id = auth.uid()
  limit 1;
  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;

  select g.* into v_gym from public.gyms g where g.id = v_member.gym_id;
  if v_gym.id is null then raise exception 'Gimnasio no encontrado'; end if;
  if p_code is null or p_code <> v_gym.checkin_code then raise exception 'Código de check-in inválido'; end if;

  v_today := timezone(coalesce(nullif(v_gym.timezone, ''), 'America/Guatemala'), now())::date;

  if not coalesce(v_gym.allow_overdue_checkin, true) then
    select p.duration_days into v_plan_days
    from public.plans p
    where p.id = v_member.plan_id and p.gym_id = v_member.gym_id and p.is_active = true;
    if v_plan_days is null then raise exception 'No tienes un plan activo'; end if;

    select coalesce(max(p.due_date), v_member.start_date + v_plan_days)
    into v_due
    from public.payments p
    where p.member_id = v_member.id and p.status <> 'rejected';

    if v_due < v_today then
      raise exception 'Cuota vencida. Regulariza tu pago en recepción';
    end if;
  end if;

  insert into public.attendance(member_id, attended_date)
  values (v_member.id, v_today)
  on conflict (member_id, attended_date) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  v_check := v_today;
  for i in 0..365 loop
    if exists (
      select 1 from public.attendance a
      where a.member_id = v_member.id and a.attended_date = v_check
    ) then
      v_streak := v_streak + 1;
    else
      v_rest := extract(dow from v_check)::integer = any(coalesce(v_gym.closed_weekdays, array[0,6]))
        or exists (
          select 1
          from jsonb_array_elements(coalesce(v_gym.holidays, '[]'::jsonb)) h
          where case
            when jsonb_typeof(h) = 'object' then h ->> 'date'
            else trim(both '"' from h::text)
          end = v_check::text
        );
      if not v_rest then exit; end if;
    end if;
    v_check := v_check - 1;
  end loop;

  update public.members
  set best_streak = greatest(coalesce(best_streak, 0), v_streak)
  where id = v_member.id;

  return jsonb_build_object(
    'already', not v_inserted,
    'streak', v_streak,
    'attended_date', v_today,
    'gym_name', v_gym.name
  );
end;
$$;

revoke all on function public.register_checkin(text) from public;
grant execute on function public.register_checkin(text) to authenticated;

commit;

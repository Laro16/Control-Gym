-- Control Gym: cierre de seguridad e integridad
-- Fecha: 2026-08-02
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Conserva los datos de negocio; si hay asistencias duplicadas del mismo
-- miembro y dia, conserva una sola antes de crear la restriccion unica.

begin;

-- ---------------------------------------------------------------------------
-- Funciones de identidad seguras para RLS
-- ---------------------------------------------------------------------------
create or replace function public.current_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.gym_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin'
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ), false);
$$;

revoke all on function public.current_gym_id() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_gym_id() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- Los usuarios creados desde Auth nunca pueden asignarse role o gym_id
-- mediante user_metadata. La Edge Function completa esos datos con service_role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, gym_id)
  values (
    new.id,
    'user',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Usuario'),
    coalesce(new.email, ''),
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zona horaria por gimnasio. Evita depender de la hora configurada en el telefono.
alter table public.gyms
  add column if not exists timezone text not null default 'America/Guatemala';

-- ---------------------------------------------------------------------------
-- Integridad e indices
-- ---------------------------------------------------------------------------
-- Quitar duplicados de asistencia antes de crear la restriccion unica.
delete from public.attendance a
using public.attendance b
where a.member_id = b.member_id
  and a.attended_date = b.attended_date
  and (
    coalesce(a.created_at, '-infinity'::timestamptz), a.id
  ) > (
    coalesce(b.created_at, '-infinity'::timestamptz), b.id
  );

create unique index if not exists attendance_member_day_uidx
  on public.attendance(member_id, attended_date);
create index if not exists profiles_gym_idx on public.profiles(gym_id);
create index if not exists members_gym_idx on public.members(gym_id);
create index if not exists members_plan_idx on public.members(plan_id);
create index if not exists payments_member_due_idx on public.payments(member_id, due_date desc);
create index if not exists measurements_member_date_idx on public.measurements(member_id, measured_at desc);
create index if not exists progress_photos_member_date_idx on public.progress_photos(member_id, photo_date desc);
create index if not exists notifications_profile_created_idx on public.notifications(profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: reemplazar politicas permisivas por operaciones especificas
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.measurements enable row level security;
alter table public.announcements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.attendance enable row level security;

drop policy if exists profiles_own on public.profiles;
drop policy if exists profiles_admin_gym on public.profiles;
create policy profiles_own_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_gym_select on public.profiles
  for select to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id());
create policy profiles_own_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Aunque RLS permita actualizar el propio perfil, estas concesiones impiden
-- cambiar role, gym_id, email o id desde el navegador.
revoke insert, delete, update on public.profiles from authenticated;
grant update (full_name, phone, birth_date, avatar_url, gender) on public.profiles to authenticated;

drop policy if exists gyms_read_own on public.gyms;
drop policy if exists gyms_admin_update on public.gyms;
create policy gyms_read_own on public.gyms
  for select to authenticated using (id = public.current_gym_id());
create policy gyms_admin_update on public.gyms
  for update to authenticated
  using (public.is_admin() and id = public.current_gym_id())
  with check (public.is_admin() and id = public.current_gym_id());

drop policy if exists plans_read_gym on public.plans;
drop policy if exists plans_admin_gym on public.plans;
create policy plans_read_gym on public.plans
  for select to authenticated using (gym_id = public.current_gym_id());
create policy plans_admin_gym on public.plans
  for all to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id())
  with check (public.is_admin() and gym_id = public.current_gym_id());

drop policy if exists members_user_own on public.members;
drop policy if exists members_admin_gym on public.members;
create policy members_user_own on public.members
  for select to authenticated using (profile_id = auth.uid());
create policy members_admin_gym on public.members
  for all to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id())
  with check (public.is_admin() and gym_id = public.current_gym_id());

drop policy if exists payments_admin_gym on public.payments;
drop policy if exists payments_user_select on public.payments;
drop policy if exists payments_user_insert on public.payments;
create policy payments_admin_gym on public.payments
  for all to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  );
create policy payments_user_select on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.profile_id = auth.uid()
  ));

drop policy if exists measurements_admin_gym on public.measurements;
drop policy if exists measurements_user_select on public.measurements;
create policy measurements_admin_gym on public.measurements
  for all to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  );
create policy measurements_user_select on public.measurements
  for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.profile_id = auth.uid()
  ));

drop policy if exists photos_admin_gym on public.progress_photos;
drop policy if exists photos_user_select on public.progress_photos;
drop policy if exists photos_user_insert on public.progress_photos;
create policy photos_admin_gym on public.progress_photos
  for all to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  );
create policy photos_user_select on public.progress_photos
  for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.profile_id = auth.uid()
  ));
create policy photos_user_insert on public.progress_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.profile_id = auth.uid() and m.status = 'active'
  ));

drop policy if exists attendance_admin_gym on public.attendance;
drop policy if exists attendance_user_own on public.attendance;
create policy attendance_admin_gym on public.attendance
  for all to authenticated
  using (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  )
  with check (
    public.is_admin() and exists (
      select 1 from public.members m
      where m.id = member_id and m.gym_id = public.current_gym_id()
    )
  );
create policy attendance_user_select on public.attendance
  for select to authenticated
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.profile_id = auth.uid()
  ));

drop policy if exists notifications_user_own on public.notifications;
drop policy if exists notifications_admin_gym on public.notifications;
create policy notifications_user_select on public.notifications
  for select to authenticated using (profile_id = auth.uid());
create policy notifications_user_update on public.notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notifications_user_custom_insert on public.notifications
  for insert to authenticated
  with check (profile_id = auth.uid() and type = 'custom' and is_read = false);
create policy notifications_admin_gym on public.notifications
  for all to authenticated
  using (
    public.is_admin() and (
      profile_id = auth.uid() or exists (
        select 1 from public.members m
        where m.profile_id = notifications.profile_id
          and m.gym_id = public.current_gym_id()
      )
    )
  )
  with check (
    public.is_admin() and (
      profile_id = auth.uid() or exists (
        select 1 from public.members m
        where m.profile_id = notifications.profile_id
          and m.gym_id = public.current_gym_id()
      )
    )
  );

drop policy if exists announcements_read_gym on public.announcements;
drop policy if exists announcements_admin_gym on public.announcements;
create policy announcements_read_gym on public.announcements
  for select to authenticated using (gym_id = public.current_gym_id());
create policy announcements_admin_gym on public.announcements
  for all to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id())
  with check (public.is_admin() and gym_id = public.current_gym_id());

-- ---------------------------------------------------------------------------
-- RPC: check-in validado en el servidor
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
  v_streak integer := 0;
  v_inserted boolean := false;
  v_row_count integer := 0;
  v_rest boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select m.* into v_member
  from public.members m
  where m.profile_id = auth.uid()
  limit 1;

  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresia no esta activa'; end if;

  select g.* into v_gym from public.gyms g where g.id = v_member.gym_id;
  if v_gym.id is null then raise exception 'Gimnasio no encontrado'; end if;
  if p_code is null or p_code <> v_gym.checkin_code then raise exception 'Codigo de check-in invalido'; end if;

  v_today := timezone(coalesce(nullif(v_gym.timezone, ''), 'America/Guatemala'), now())::date;

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

-- ---------------------------------------------------------------------------
-- RPC: pagos de miembros validados por plan y ciclo
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
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(array_length(p_due_dates, 1), 0) < 1 or array_length(p_due_dates, 1) > 24 then
    raise exception 'Selecciona entre 1 y 24 ciclos';
  end if;
  if p_payment_method not in ('transfer', 'deposit') then
    raise exception 'Metodo de pago no permitido';
  end if;
  if nullif(trim(p_voucher_path), '') is null then raise exception 'Falta el comprobante'; end if;

  select m.* into v_member
  from public.members m where m.profile_id = auth.uid() limit 1;
  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresia no esta activa'; end if;

  select p.* into v_plan
  from public.plans p
  where p.id = v_member.plan_id and p.gym_id = v_member.gym_id and p.is_active = true;
  if v_plan.id is null then raise exception 'El miembro no tiene un plan activo'; end if;
  if v_plan.duration_days < 1 or v_plan.price < 0 then raise exception 'Configuracion de plan invalida'; end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today from public.gyms g where g.id = v_member.gym_id;

  -- Continuar desde el ultimo vencimiento existente. Esto mantiene
  -- compatibilidad con pagos antiguos creados por mes calendario.
  select coalesce(max(p.due_date), v_member.start_date)
  into v_anchor
  from public.payments p
  where p.member_id = v_member.id and p.status <> 'rejected';

  foreach v_due in array p_due_dates loop
    if v_due <= v_anchor
       or mod(v_due - v_anchor, v_plan.duration_days) <> 0 then
      raise exception 'La fecha % no corresponde a un ciclo del plan', v_due;
    end if;
    if v_due > v_today + interval '18 months' then
      raise exception 'No se permiten pagos con mas de 18 meses de anticipacion';
    end if;
    if exists (
      select 1 from public.payments p
      where p.member_id = v_member.id
        and p.due_date = v_due
        and p.status <> 'rejected'
    ) then
      raise exception 'El ciclo con vencimiento % ya fue registrado', v_due;
    end if;

    insert into public.payments(
      member_id, amount, payment_method, payment_date, due_date,
      status, voucher_url, notes
    ) values (
      v_member.id, v_plan.price, p_payment_method, v_today, v_due,
      'pending', p_voucher_path, 'Ciclo con vencimiento ' || v_due::text
    ) returning * into v_payment;
    return next v_payment;
  end loop;
end;
$$;

revoke all on function public.submit_member_payments(date[], text, text) from public;
grant execute on function public.submit_member_payments(date[], text, text) to authenticated;

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
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if nullif(trim(p_voucher_path), '') is null then raise exception 'Falta el comprobante'; end if;

  update public.payments p
  set voucher_url = p_voucher_path,
      payment_date = coalesce(p.payment_date, current_date),
      status = 'pending'
  where p.id = p_payment_id
    and p.status = 'pending'
    and exists (
      select 1 from public.members m
      where m.id = p.member_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
  returning p.* into v_payment;

  if v_payment.id is null then raise exception 'Pago no encontrado o no modificable'; end if;
  return v_payment;
end;
$$;

revoke all on function public.attach_payment_voucher(uuid, text) from public;
grant execute on function public.attach_payment_voucher(uuid, text) to authenticated;

-- Borrado atomico de tablas. Solo la Edge Function con service_role puede usarlo.
create or replace function public.delete_member_data(
  p_member_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.members m
    where m.id = p_member_id and m.profile_id = p_profile_id
  ) then
    raise exception 'Miembro y perfil no coinciden';
  end if;

  delete from public.attendance where member_id = p_member_id;
  delete from public.measurements where member_id = p_member_id;
  delete from public.progress_photos where member_id = p_member_id;
  delete from public.payments where member_id = p_member_id;
  delete from public.notifications where profile_id = p_profile_id;
  delete from public.members where id = p_member_id;
  delete from public.profiles where id = p_profile_id;
end;
$$;

revoke all on function public.delete_member_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_member_data(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage
-- Los dos nombres siguientes son los recomendados anteriormente y eran
-- demasiado amplios. Se reemplazan por politicas por carpeta y gimnasio.
-- ---------------------------------------------------------------------------
drop policy if exists allow_authenticated_upload on storage.objects;
drop policy if exists allow_authenticated_read on storage.objects;

-- Avatares y logos son recursos publicos de presentacion. Comprobantes y
-- fotos corporales contienen informacion privada y nunca deben ser publicos.
update storage.buckets set public = true
where id in ('avatars', 'logos');
update storage.buckets set public = false
where id in ('progress', 'vouchers');

-- Inventario real recibido el 2026-08-02. Algunos nombres fueron generados
-- por el Dashboard con sufijos y barras invertidas, por eso se eliminan de
-- forma segura con format('%I'). Todas estas politicas eran generales para
-- el bucket y se sustituyen abajo por permisos por usuario/gimnasio.
do $$
declare
  v_policy text;
begin
  for v_policy in
    select unnest(array[
      'Nombre: allow\_authenticated\_read 1ih3h2l_0',
      'Nombre: allow\_authenticated\_upload 1ih3h2l_0',
      'allow\_authenticated\_read 183bix1_0',
      'allow\_authenticated\_upload 183bix1_0',
      'avatars_auth_delete',
      'avatars_auth_update',
      'avatars_auth_upload',
      'avatars_public_read',
      'logos_auth_upload 1peuqw_0',
      'logos_public_read 1peuqw_0',
      'progress_auth_update',
      'progress_auth_upload',
      'progress_public_read',
      'vouchers_auth_update',
      'vouchers_auth_upload',
      'vouchers_public_read'
    ]::text[])
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy);
  end loop;
end;
$$;

drop policy if exists vouchers_read_scoped on storage.objects;
drop policy if exists vouchers_write_scoped on storage.objects;
drop policy if exists vouchers_update_scoped on storage.objects;
drop policy if exists vouchers_delete_scoped on storage.objects;
create policy vouchers_read_scoped on storage.objects
  for select to authenticated using (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy vouchers_write_scoped on storage.objects
  for insert to authenticated with check (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and m.status = 'active'
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy vouchers_update_scoped on storage.objects
  for update to authenticated using (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  ) with check (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy vouchers_delete_scoped on storage.objects
  for delete to authenticated using (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );

drop policy if exists progress_read_scoped on storage.objects;
drop policy if exists progress_write_scoped on storage.objects;
drop policy if exists progress_update_scoped on storage.objects;
drop policy if exists progress_delete_scoped on storage.objects;
create policy progress_read_scoped on storage.objects
  for select to authenticated using (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy progress_write_scoped on storage.objects
  for insert to authenticated with check (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and m.status = 'active'
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy progress_update_scoped on storage.objects
  for update to authenticated using (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  ) with check (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );
create policy progress_delete_scoped on storage.objects
  for delete to authenticated using (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (m.profile_id = auth.uid() or (public.is_admin() and m.gym_id = public.current_gym_id()))
    )
  );

drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select to public using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists logos_admin_own_gym_insert on storage.objects;
drop policy if exists logos_admin_own_gym_update on storage.objects;
drop policy if exists logos_admin_own_gym_delete on storage.objects;
drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects
  for select to public using (bucket_id = 'logos');
create policy logos_admin_own_gym_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos' and public.is_admin()
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );
create policy logos_admin_own_gym_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos' and public.is_admin()
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  )
  with check (
    bucket_id = 'logos' and public.is_admin()
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );
create policy logos_admin_own_gym_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos' and public.is_admin()
    and (storage.foldername(name))[1] = public.current_gym_id()::text
  );

commit;

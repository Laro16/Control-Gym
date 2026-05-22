-- ============================================================
-- GYM APP - SQL COMPLETO PARA SUPABASE
-- Pega todo esto en SQL Editor de Supabase y ejecuta
-- ============================================================

-- EXTENSIONES
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: profiles (extiende auth.users de Supabase)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null default 'user' check (role in ('admin', 'user')),
  full_name text not null,
  email text not null,
  phone text,
  birth_date date,
  avatar_url text,
  gym_id uuid, -- para SaaS multi-gimnasio en el futuro
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: gyms (preparado para SaaS futuro)
-- ============================================================
create table public.gyms (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  primary_color text default '#F97316',
  whatsapp_number text,
  address text,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: plans (planes del gimnasio)
-- ============================================================
create table public.plans (
  id uuid default uuid_generate_v4() primary key,
  gym_id uuid references public.gyms(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  duration_days int not null default 30,
  features jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: members (usuarios del gimnasio)
-- ============================================================
create table public.members (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade unique,
  gym_id uuid references public.gyms(id),
  plan_id uuid references public.plans(id),
  start_date date not null,
  status text default 'active' check (status in ('active', 'inactive', 'suspended')),
  emergency_contact text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: payments (pagos mensuales)
-- ============================================================
create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  member_id uuid references public.members(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_date date,
  due_date date not null,
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer', 'deposit')),
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  voucher_url text,
  notes text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: measurements (medidas corporales)
-- ============================================================
create table public.measurements (
  id uuid default uuid_generate_v4() primary key,
  member_id uuid references public.members(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  waist_cm numeric(5,2),
  chest_cm numeric(5,2),
  hips_cm numeric(5,2),
  left_arm_cm numeric(5,2),
  right_arm_cm numeric(5,2),
  left_leg_cm numeric(5,2),
  right_leg_cm numeric(5,2),
  body_fat_pct numeric(4,2),
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: progress_photos (fotos de progreso)
-- ============================================================
create table public.progress_photos (
  id uuid default uuid_generate_v4() primary key,
  member_id uuid references public.members(id) on delete cascade,
  photo_url text not null,
  photo_date date not null default current_date,
  angle text default 'front' check (angle in ('front', 'back', 'side_left', 'side_right')),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLA: attendance (racha de asistencia)
-- ============================================================
create table public.attendance (
  id uuid default uuid_generate_v4() primary key,
  member_id uuid references public.members(id) on delete cascade,
  attended_date date not null default current_date,
  created_at timestamptz default now(),
  unique(member_id, attended_date)
);

-- ============================================================
-- TABLA: notifications (notificaciones)
-- ============================================================
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'payment_due', 'payment_overdue', 'payment_approved',
    'payment_rejected', 'plan_assigned', 'measurements_updated',
    'progress_photo', 'custom'
  )),
  title text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.attendance enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.gyms enable row level security;

-- PROFILES: cada usuario ve su perfil, admin ve todos
create policy "users_own_profile" on public.profiles
  for all using (auth.uid() = id);

create policy "admin_all_profiles" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- MEMBERS: admin ve todos, usuario ve el suyo
create policy "admin_all_members" on public.members
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "user_own_member" on public.members
  for select using (
    profile_id = auth.uid()
  );

-- PAYMENTS: admin ve todos, usuario ve los suyos
create policy "admin_all_payments" on public.payments
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "user_own_payments" on public.payments
  for select using (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

create policy "user_insert_payment" on public.payments
  for insert with check (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

-- MEASUREMENTS: admin full, usuario solo lectura
create policy "admin_all_measurements" on public.measurements
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "user_own_measurements" on public.measurements
  for select using (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

-- PROGRESS PHOTOS: admin ve todas, usuario ve las suyas y puede subir
create policy "admin_all_photos" on public.progress_photos
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "user_own_photos" on public.progress_photos
  for select using (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

create policy "user_insert_photos" on public.progress_photos
  for insert with check (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

-- ATTENDANCE
create policy "admin_all_attendance" on public.attendance
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "user_own_attendance" on public.attendance
  for all using (
    member_id in (
      select id from public.members where profile_id = auth.uid()
    )
  );

-- NOTIFICATIONS
create policy "user_own_notifications" on public.notifications
  for all using (profile_id = auth.uid());

-- PLANS (todos pueden leer, solo admin puede modificar)
create policy "all_read_plans" on public.plans
  for select using (true);

create policy "admin_manage_plans" on public.plans
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- GYMS
create policy "all_read_gyms" on public.gyms
  for select using (true);

create policy "admin_manage_gyms" on public.gyms
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- FUNCIÓN: crear perfil automático al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNCIÓN: calcular racha de asistencia
-- ============================================================
create or replace function public.get_attendance_streak(p_member_id uuid)
returns int as $$
declare
  streak int := 0;
  check_date date := current_date;
  day_of_week int;
begin
  loop
    day_of_week := extract(dow from check_date); -- 0=domingo, 6=sabado
    
    -- Domingo no cuenta nunca
    if day_of_week = 0 then
      check_date := check_date - 1;
      continue;
    end if;
    
    -- Verificar si asistió
    if exists (
      select 1 from public.attendance
      where member_id = p_member_id and attended_date = check_date
    ) then
      streak := streak + 1;
      check_date := check_date - 1;
    else
      -- Sábado no rompe racha si no asistió
      if day_of_week = 6 then
        check_date := check_date - 1;
        continue;
      else
        exit; -- Día de semana sin asistencia: rompe racha
      end if;
    end if;
  end loop;
  
  return streak;
end;
$$ language plpgsql;

-- ============================================================
-- DATOS INICIALES: Gimnasio de ejemplo
-- ============================================================
insert into public.gyms (id, name, primary_color, whatsapp_number)
values (
  '00000000-0000-0000-0000-000000000001',
  'Mi Gimnasio',
  '#F97316',
  '50212345678'
);

-- ============================================================
-- STORAGE BUCKETS (ejecutar después de crear las políticas)
-- Esto se configura en Supabase Dashboard > Storage
-- Buckets a crear manualmente:
--   - vouchers      (privado)
--   - progress      (privado)
--   - avatars       (público)
-- ============================================================

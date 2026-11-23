-- StudyFlow: rode este arquivo inteiro no Supabase > SQL Editor.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role text not null default 'user' check (role in ('admin','user')),
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now()
);
create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, color text not null default '#8b5cf6', description text,
  created_at timestamptz not null default now()
);
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  title text not null, description text, due_date date,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  status text not null default 'pendente' check (status in ('pendente','andamento','concluida')),
  created_at timestamptz not null default now()
);
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  started_at timestamptz not null default now(),
  duration_seconds int not null check (duration_seconds > 0)
);
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null, end_time time not null
);
create table goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_minutes int not null default 120, weekly_hours numeric not null default 10
);
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, message text not null,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on subjects(user_id);
create index on tasks(user_id, due_date);
create index on study_sessions(user_id, started_at);
create index on study_plans(user_id, weekday);

-- Funções de permissão (security definer = ignoram RLS, por isso não geram loop)
create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') $$;
create function is_active() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and status = 'active') $$;

-- Todo cadastro novo vira USER (ignora qualquer "role" enviado pelo frontend)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, email, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, 'user', 'active');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Usuário comum não pode alterar papel/status/e-mail. (auth.uid() nulo = SQL Editor do dono)
create function protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role <> old.role or new.status <> old.status or new.email is distinct from old.email or new.id <> old.id then
      raise exception 'Alteração não permitida';
    end if;
  end if;
  return new;
end $$;
create trigger protect_profile_trg before update on profiles for each row execute function protect_profile();

-- RLS
alter table profiles enable row level security;
create policy profiles_select on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update on profiles for update using (id = auth.uid() and is_active()) with check (id = auth.uid());

alter table announcements enable row level security;
create policy ann_read on announcements for select using (is_active());
create policy ann_admin on announcements for all using (is_admin()) with check (is_admin());

-- Tabelas de estudo: só o dono, e só se a conta não estiver bloqueada
do $$ declare t text; begin
  foreach t in array array['subjects','tasks','study_sessions','study_plans','goals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid() and is_active()) with check (user_id = auth.uid() and is_active())', t);
  end loop;
end $$;

-- Funções administrativas (checam is_admin() no banco)
create function admin_set_status(target uuid, new_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if new_status not in ('active','blocked') then raise exception 'status inválido'; end if;
  update profiles set status = new_status where id = target and role <> 'admin';
end $$;
create function admin_delete_user(target uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if target = auth.uid() or exists(select 1 from profiles where id = target and role = 'admin') then raise exception 'Não é possível excluir um admin'; end if;
  delete from auth.users where id = target; -- cascade apaga perfil e dados
end $$;
create function admin_stats() returns json language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'users', (select count(*) from profiles),
    'active', (select count(*) from profiles where status='active'),
    'blocked', (select count(*) from profiles where status='blocked'),
    'new7', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'subjects', (select count(*) from subjects),
    'tasks', (select count(*) from tasks),
    'tasks_done', (select count(*) from tasks where status='concluida'),
    'sessions', (select count(*) from study_sessions),
    'hours', (select coalesce(sum(duration_seconds),0)/3600.0 from study_sessions));
end $$;
revoke all on function admin_set_status(uuid,text), admin_delete_user(uuid), admin_stats() from public, anon;
grant execute on function admin_set_status(uuid,text), admin_delete_user(uuid), admin_stats() to authenticated;

-- ADMIN INICIAL (execute manualmente, depois de criar sua conta pelo site):
-- update profiles set role = 'admin' where email = 'seu@email.com';

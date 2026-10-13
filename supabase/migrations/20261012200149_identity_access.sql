create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.cities (
	id uuid primary key,
	slug text not null unique,
	name text not null,
	state_code text not null check (state_code ~ '^[A-Z]{2}$'),
	ibge_code text not null unique,
	created_at timestamptz not null default now()
);

insert into public.cities (id, slug, name, state_code, ibge_code)
values (
	'41152000-0000-4000-8000-000000000001',
	'maringa-pr',
	'Maringá',
	'PR',
	'4115200'
);

create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	city_id uuid not null references public.cities (id),
	name text not null check (char_length(btrim(name)) between 1 and 120),
	whatsapp_e164 text not null check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
	role text not null default 'participante'
		check (role in ('participante', 'lider_setor', 'lider_cidade')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index profiles_city_role_idx on public.profiles (city_id, role);

create or replace function private.is_city_leader_or_sector_leader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.profiles as profile
		where profile.id = (select auth.uid())
			and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and profile.role in ('lider_setor', 'lider_cidade')
	);
$$;

revoke all on function private.is_city_leader_or_sector_leader() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_city_leader_or_sector_leader() to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	pilot_city_id uuid;
begin
	select city.id
	into strict pilot_city_id
	from public.cities as city
	where city.slug = 'maringa-pr';

	insert into public.profiles (id, city_id, name, whatsapp_e164, role)
	values (
		new.id,
		pilot_city_id,
		btrim(new.raw_user_meta_data ->> 'name'),
		new.raw_user_meta_data ->> 'whatsapp_e164',
		'participante'
	);

	return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

alter table public.cities enable row level security;
alter table public.profiles enable row level security;

revoke all on table public.cities from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.cities to authenticated;
grant select on table public.profiles to authenticated;
grant update (name, whatsapp_e164) on table public.profiles to authenticated;

create policy "authenticated users can read pilot city"
on public.cities
for select
to authenticated
using (true);

create policy "users read own profiles and leaders read city profiles"
on public.profiles
for select
to authenticated
using (
	id = (select auth.uid())
	or (select private.is_city_leader_or_sector_leader())
);

create policy "users update own profile fields"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create table public.availability_windows (
	id uuid primary key default gen_random_uuid(),
	profile_id uuid not null references public.profiles (id) on delete cascade,
	day_of_week smallint not null check (day_of_week between 0 and 6),
	starts_at time without time zone not null,
	ends_at time without time zone not null,
	created_at timestamptz not null default now(),
	check (ends_at > starts_at)
);

create index availability_windows_profile_schedule_idx
	on public.availability_windows (profile_id, day_of_week, starts_at);

alter table public.availability_windows enable row level security;

revoke all on table public.availability_windows from anon, authenticated;
grant select, insert, update, delete on table public.availability_windows to authenticated;

create policy "users and leaders read city availability"
on public.availability_windows
for select
to authenticated
using (
	profile_id = (select auth.uid())
	or (select private.is_city_leader_or_sector_leader())
);

create policy "users insert own availability"
on public.availability_windows
for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "users update own availability"
on public.availability_windows
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "users delete own availability"
on public.availability_windows
for delete
to authenticated
using (profile_id = (select auth.uid()));

create or replace function public.replace_my_availability(p_windows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
begin
	if current_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if jsonb_typeof(p_windows) is distinct from 'array' then
		raise exception 'At least one availability window is required.' using errcode = '23514';
	end if;

	if jsonb_array_length(p_windows) = 0 then
		raise exception 'At least one availability window is required.' using errcode = '23514';
	end if;

	delete from public.availability_windows as availability
	where availability.profile_id = current_user_id;

	insert into public.availability_windows (profile_id, day_of_week, starts_at, ends_at)
	select
		current_user_id,
		availability_input.day_of_week,
		availability_input.starts_at,
		availability_input.ends_at
	from jsonb_to_recordset(p_windows) as availability_input(
		day_of_week smallint,
		starts_at time without time zone,
		ends_at time without time zone
	);
end;
$$;

revoke all on function public.replace_my_availability(jsonb) from public, anon, authenticated;
grant execute on function public.replace_my_availability(jsonb) to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	pilot_city_id uuid;
	availability_metadata jsonb := new.raw_user_meta_data -> 'availability_windows';
begin
	if jsonb_typeof(availability_metadata) is distinct from 'array' then
		raise exception 'At least one availability window is required.' using errcode = '23514';
	end if;

	if jsonb_array_length(availability_metadata) = 0 then
		raise exception 'At least one availability window is required.' using errcode = '23514';
	end if;

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

	insert into public.availability_windows (profile_id, day_of_week, starts_at, ends_at)
	select
		new.id,
		availability_input.day_of_week,
		availability_input.starts_at,
		availability_input.ends_at
	from jsonb_to_recordset(availability_metadata) as availability_input(
		day_of_week smallint,
		starts_at time without time zone,
		ends_at time without time zone
	);

	return new;
end;
$$;

create table public.region_sets (
	id uuid primary key default gen_random_uuid(),
	city_id uuid not null references public.cities (id),
	status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
	target_region_count smallint not null check (target_region_count between 1 and 50),
	created_by uuid not null references public.profiles (id),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	published_at timestamptz,
	check ((status = 'published') = (published_at is not null))
);

create unique index region_sets_one_draft_per_city_idx
	on public.region_sets (city_id)
	where status = 'draft';

create unique index region_sets_one_published_per_city_idx
	on public.region_sets (city_id)
	where status = 'published';

create table public.regions (
	id uuid primary key default gen_random_uuid(),
	region_set_id uuid not null references public.region_sets (id) on delete cascade,
	region_number smallint not null check (region_number between 1 and 50),
	color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
	geom extensions.geometry(MultiPolygon, 4326) not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (region_set_id, region_number),
	check (extensions.st_srid(geom) = 4326),
	check (extensions.st_isvalid(geom))
);

create index regions_geom_idx on public.regions using gist (geom);

create table public.subdivisions (
	id uuid primary key default gen_random_uuid(),
	region_id uuid not null references public.regions (id) on delete cascade,
	subdivision_number integer not null check (subdivision_number > 0),
	geom extensions.geometry(MultiPolygon, 4326) not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (region_id, subdivision_number),
	check (extensions.st_srid(geom) = 4326),
	check (extensions.st_isvalid(geom))
);

create index subdivisions_geom_idx on public.subdivisions using gist (geom);

create table public.sector_leader_regions (
	sector_leader_id uuid not null references public.profiles (id) on delete cascade,
	region_id uuid not null references public.regions (id) on delete cascade,
	assigned_by uuid not null references public.profiles (id),
	created_at timestamptz not null default now(),
	primary key (sector_leader_id, region_id)
);

alter table public.region_sets enable row level security;
alter table public.regions enable row level security;
alter table public.subdivisions enable row level security;
alter table public.sector_leader_regions enable row level security;

revoke all on table public.region_sets, public.regions, public.subdivisions, public.sector_leader_regions from anon, authenticated, service_role;
grant select on table public.region_sets, public.regions, public.subdivisions, public.sector_leader_regions to authenticated;

create policy "authenticated users read published region sets and city leaders read drafts"
on public.region_sets
for select
to authenticated
using (
	status = 'published'
	or exists (
		select 1
		from public.profiles as profile
		where profile.id = (select auth.uid())
			and profile.city_id = city_id
			and profile.role = 'lider_cidade'
	)
);

create policy "authenticated users read published regions and city leaders read drafts"
on public.regions
for select
to authenticated
using (
	exists (
		select 1
		from public.region_sets as region_set
		where region_set.id = region_set_id
			and (
				region_set.status = 'published'
				or exists (
					select 1
					from public.profiles as profile
					where profile.id = (select auth.uid())
						and profile.role = 'lider_cidade'
				)
			)
	)
);

create policy "authenticated users read published subdivisions and city leaders read drafts"
on public.subdivisions
for select
to authenticated
using (
	exists (
		select 1
		from public.regions as region
		join public.region_sets as region_set on region_set.id = region.region_set_id
		where region.id = region_id
			and (
				region_set.status = 'published'
				or exists (
					select 1
					from public.profiles as profile
					where profile.id = (select auth.uid())
						and profile.role = 'lider_cidade'
				)
			)
	)
);

create policy "leaders read their sector region assignments"
on public.sector_leader_regions
for select
to authenticated
using (
	sector_leader_id = (select auth.uid())
	or exists (
		select 1
		from public.profiles as profile
		where profile.id = (select auth.uid())
			and profile.role = 'lider_cidade'
	)
);

create or replace function private.save_region_partition(
	p_regions jsonb,
	p_target_count integer,
	p_colors text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
	validation_result jsonb;
	region_set_id uuid;
	color_count integer := coalesce(cardinality(p_colors), 0);
begin
	if current_user_id is null or not exists (
		select 1
		from public.profiles as profile
		where profile.id = current_user_id
			and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and profile.role = 'lider_cidade'
	) then
		raise exception 'Only the city leader can save a region draft.' using errcode = '42501';
	end if;

	if p_colors is null
		or color_count <> p_target_count
		or exists (select 1 from unnest(p_colors) as color(value) where color.value !~ '^#[0-9A-Fa-f]{6}$')
	then
		raise exception 'A valid hexadecimal color is required for each region.' using errcode = '23514';
	end if;

	validation_result := public.validate_region_partition(p_regions, p_target_count);
	if (validation_result->>'passesValidation')::boolean is distinct from true then
		raise exception 'The region partition did not pass PostGIS validation.' using errcode = '23514';
	end if;

	select region_set.id
	into region_set_id
	from public.region_sets as region_set
	where region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
		and region_set.status = 'draft'
	for update;

	if region_set_id is null then
		insert into public.region_sets (city_id, status, target_region_count, created_by)
		values (
			'41152000-0000-4000-8000-000000000001'::uuid,
			'draft',
			p_target_count,
			current_user_id
		)
		returning id into region_set_id;
	else
		update public.region_sets
		set target_region_count = p_target_count,
			updated_at = now()
		where id = region_set_id;
	end if;

	delete from public.regions as region
	where region.region_set_id = region_set_id
		and region.region_number > p_target_count;

	insert into public.regions (region_set_id, region_number, color, geom)
	select
		region_set_id,
		region_input.ordinality::smallint,
		p_colors[region_input.ordinality::integer],
		extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(region_input.value::text), 4326))::extensions.geometry(MultiPolygon, 4326)
	from jsonb_array_elements(p_regions) with ordinality as region_input(value, ordinality)
	on conflict (region_set_id, region_number)
	do update set
		color = excluded.color,
		geom = excluded.geom,
		updated_at = now();

	return region_set_id;
end;
$$;

revoke all on function private.save_region_partition(jsonb, integer, text[]) from public, anon, authenticated;
grant execute on function private.save_region_partition(jsonb, integer, text[]) to authenticated;

create or replace function public.save_region_partition(
	p_regions jsonb,
	p_target_count integer,
	p_colors text[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
	select private.save_region_partition(p_regions, p_target_count, p_colors);
$$;

revoke all on function public.save_region_partition(jsonb, integer, text[]) from public, anon, authenticated;
grant execute on function public.save_region_partition(jsonb, integer, text[]) to authenticated;

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
	v_current_user_id uuid := (select auth.uid());
	v_validation_result jsonb;
	v_region_set_id uuid;
	v_color_count integer := coalesce(cardinality(p_colors), 0);
begin
	if v_current_user_id is null or not exists (
		select 1
		from public.profiles as profile
		where profile.id = v_current_user_id
			and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and profile.role = 'lider_cidade'
	) then
		raise exception 'Only the city leader can save a region draft.' using errcode = '42501';
	end if;

	if p_colors is null
		or v_color_count <> p_target_count
		or exists (select 1 from unnest(p_colors) as color(value) where color.value !~ '^#[0-9A-Fa-f]{6}$')
	then
		raise exception 'A valid hexadecimal color is required for each region.' using errcode = '23514';
	end if;

	v_validation_result := public.validate_region_partition(p_regions, p_target_count);
	if (v_validation_result->>'passesValidation')::boolean is distinct from true then
		raise exception 'The region partition did not pass PostGIS validation.' using errcode = '23514';
	end if;

	select draft.id
	into v_region_set_id
	from public.region_sets as draft
	where draft.city_id = '41152000-0000-4000-8000-000000000001'::uuid
		and draft.status = 'draft'
	for update;

	if v_region_set_id is null then
		insert into public.region_sets (city_id, status, target_region_count, created_by)
		values (
			'41152000-0000-4000-8000-000000000001'::uuid,
			'draft',
			p_target_count,
			v_current_user_id
		)
		returning id into v_region_set_id;
	else
		update public.region_sets
		set target_region_count = p_target_count,
			updated_at = now()
		where id = v_region_set_id;
	end if;

	delete from public.regions as region
	where region.region_set_id = v_region_set_id
		and region.region_number > p_target_count;

	insert into public.regions (region_set_id, region_number, color, geom)
	select
		v_region_set_id,
		region_input.ordinality::smallint,
		p_colors[region_input.ordinality::integer],
		extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(region_input.value::text), 4326))::extensions.geometry(MultiPolygon, 4326)
	from jsonb_array_elements(p_regions) with ordinality as region_input(value, ordinality)
	on conflict (region_set_id, region_number)
	do update set
		color = excluded.color,
		geom = excluded.geom,
		updated_at = now();

	return v_region_set_id;
end;
$$;

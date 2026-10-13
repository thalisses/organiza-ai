alter function public.validate_region_partition(jsonb, integer) set schema private;

create or replace function public.validate_region_partition(
	p_regions jsonb,
	p_target_count integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
	region_input record;
	candidate_geometry extensions.geometry;
begin
	if current_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if not exists (
		select 1
		from public.profiles as profile
		where profile.id = current_user_id
			and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and profile.role = 'lider_cidade'
	) then
		raise exception 'Only the city leader can validate a region partition.' using errcode = '42501';
	end if;

	if jsonb_typeof(p_regions) is distinct from 'array' then
		raise exception 'Region geometries must be provided as a JSON array.' using errcode = '23514';
	end if;

	if octet_length(p_regions::text) > 1048576 then
		raise exception 'Region geometry payload exceeds the 1 MiB limit.' using errcode = '23514';
	end if;

	if jsonb_array_length(p_regions) > 50 then
		raise exception 'A partition cannot contain more than 50 regions.' using errcode = '23514';
	end if;

	if p_target_count is null or p_target_count not between 1 and 50 then
		raise exception 'The target region count must be between 1 and 50.' using errcode = '23514';
	end if;

	for region_input in
		select item.value
		from jsonb_array_elements(p_regions) as item(value)
	loop
		if jsonb_typeof(region_input.value) is distinct from 'object' then
			raise exception 'Each region must be a GeoJSON geometry object.' using errcode = '23514';
		end if;

		begin
			candidate_geometry := extensions.st_setsrid(
				extensions.st_geomfromgeojson(region_input.value::text),
				4326
			);
		exception when others then
			raise exception 'A region contains invalid GeoJSON.' using errcode = '22023';
		end;

		if extensions.st_geometrytype(candidate_geometry) not in ('ST_Polygon', 'ST_MultiPolygon') then
			raise exception 'Regions must be Polygon or MultiPolygon geometries.' using errcode = '23514';
		end if;

		if not extensions.st_isvalid(candidate_geometry) then
			raise exception 'Every region geometry must be valid.' using errcode = '23514';
		end if;

		if extensions.st_npoints(candidate_geometry) > 10000 then
			raise exception 'A region cannot contain more than 10,000 vertices.' using errcode = '23514';
		end if;
	end loop;

	return private.validate_region_partition(p_regions, p_target_count);
end;
$$;

revoke all on function public.validate_region_partition(jsonb, integer) from public, anon, authenticated;
grant execute on function public.validate_region_partition(jsonb, integer) to authenticated;

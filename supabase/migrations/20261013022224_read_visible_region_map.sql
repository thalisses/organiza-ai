create or replace function public.get_visible_region_set()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
	visible_set record;
	region_payload jsonb;
begin
	select region_set.id, region_set.status, region_set.target_region_count
	into visible_set
	from public.region_sets as region_set
	where region_set.status in ('draft', 'published')
	order by case when region_set.status = 'draft' then 0 else 1 end
	limit 1;

	if not found then
		return null;
	end if;

	select coalesce(
		jsonb_agg(
			jsonb_build_object(
				'id', region.id,
				'number', region.region_number,
				'color', region.color,
				'geometry', extensions.st_asgeojson(region.geom, 15)::jsonb,
				'subdivisions', coalesce((
					select jsonb_agg(
						jsonb_build_object(
							'id', subdivision.id,
							'number', subdivision.subdivision_number,
							'geometry', extensions.st_asgeojson(subdivision.geom, 15)::jsonb
						)
						order by subdivision.subdivision_number
					)
					from public.subdivisions as subdivision
					where subdivision.region_id = region.id
				), '[]'::jsonb)
			)
			order by region.region_number
		),
		'[]'::jsonb
	)
	into region_payload
	from public.regions as region
	where region.region_set_id = visible_set.id;

	return jsonb_build_object(
		'regionSetId', visible_set.id,
		'status', visible_set.status,
		'targetRegionCount', visible_set.target_region_count,
		'regions', region_payload
	);
end;
$$;

revoke all on function public.get_visible_region_set() from public, anon;
grant execute on function public.get_visible_region_set() to authenticated;

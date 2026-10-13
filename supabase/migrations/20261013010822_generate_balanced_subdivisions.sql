create or replace function private.generate_balanced_subdivisions(
	p_parent extensions.geometry,
	p_target_count integer
)
returns table (
	subdivision_number integer,
	subdivision_geometry extensions.geometry(MultiPolygon, 4326),
	area_square_meters double precision,
	deviation_percent double precision
)
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_parent_utm extensions.geometry;
	v_bounds extensions.geometry;
	v_band extensions.geometry;
	v_candidate_utm extensions.geometry;
	v_candidate_4326 extensions.geometry;
	v_cut_positions double precision[] := array[]::double precision[];
	v_min_x double precision;
	v_min_y double precision;
	v_max_x double precision;
	v_max_y double precision;
	v_lower_bound double precision;
	v_upper_bound double precision;
	v_midpoint double precision;
	v_cut_area double precision;
	v_expected_area double precision;
	v_parent_area double precision;
	v_target_area double precision;
	v_max_deviation double precision := 0;
	v_axis integer;
	v_cut_index integer;
	v_iteration integer;
	v_region_number integer;
begin
	if p_target_count is null or p_target_count not between 1 and 50 then
		raise exception 'Subdivision count must be between 1 and 50.' using errcode = '23514';
	end if;

	if p_parent is null
		or extensions.st_srid(p_parent) <> 4326
		or extensions.st_geometrytype(p_parent) not in ('ST_Polygon', 'ST_MultiPolygon')
		or not extensions.st_isvalid(p_parent)
	then
		raise exception 'Parent must be a valid Polygon or MultiPolygon in EPSG:4326.' using errcode = '23514';
	end if;

	v_parent_utm := extensions.st_transform(p_parent, 31982);
	v_parent_area := extensions.st_area(v_parent_utm);
	if v_parent_area <= 0 then
		raise exception 'Parent geometry must have positive area.' using errcode = '23514';
	end if;

	v_expected_area := v_parent_area / p_target_count;
	v_bounds := extensions.st_envelope(v_parent_utm);
	v_min_x := extensions.st_xmin(extensions.box3d(v_bounds));
	v_min_y := extensions.st_ymin(extensions.box3d(v_bounds));
	v_max_x := extensions.st_xmax(extensions.box3d(v_bounds));
	v_max_y := extensions.st_ymax(extensions.box3d(v_bounds));
	v_axis := case when (v_max_x - v_min_x) >= (v_max_y - v_min_y) then 1 else 2 end;

	for v_cut_index in 1..(p_target_count - 1) loop
		if v_axis = 1 then
			v_lower_bound := v_min_x;
			v_upper_bound := v_max_x;
		else
			v_lower_bound := v_min_y;
			v_upper_bound := v_max_y;
		end if;

		for v_iteration in 1..32 loop
			v_midpoint := (v_lower_bound + v_upper_bound) / 2;
			if v_axis = 1 then
				v_band := extensions.st_makeenvelope(v_min_x, v_min_y, v_midpoint, v_max_y, 31982);
			else
				v_band := extensions.st_makeenvelope(v_min_x, v_min_y, v_max_x, v_midpoint, 31982);
			end if;

			v_cut_area := extensions.st_area(extensions.st_intersection(v_parent_utm, v_band));
			v_target_area := v_expected_area * v_cut_index;
			if v_cut_area < v_target_area then
				v_lower_bound := v_midpoint;
			else
				v_upper_bound := v_midpoint;
			end if;
		end loop;

		v_cut_positions := array_append(v_cut_positions, (v_lower_bound + v_upper_bound) / 2);
	end loop;

	for v_region_number in 1..p_target_count loop
		if v_axis = 1 then
			v_lower_bound := case when v_region_number = 1 then v_min_x else v_cut_positions[v_region_number - 1] end;
			v_upper_bound := case when v_region_number = p_target_count then v_max_x else v_cut_positions[v_region_number] end;
			v_band := extensions.st_makeenvelope(v_lower_bound, v_min_y, v_upper_bound, v_max_y, 31982);
		else
			v_lower_bound := case when v_region_number = 1 then v_min_y else v_cut_positions[v_region_number - 1] end;
			v_upper_bound := case when v_region_number = p_target_count then v_max_y else v_cut_positions[v_region_number] end;
			v_band := extensions.st_makeenvelope(v_min_x, v_lower_bound, v_max_x, v_upper_bound, 31982);
		end if;

		v_candidate_utm := extensions.st_multi(
			extensions.st_collectionextract(extensions.st_intersection(v_parent_utm, v_band), 3)
		);
		if extensions.st_isempty(v_candidate_utm) or not extensions.st_isvalid(v_candidate_utm) then
			raise exception 'Subdivision generation produced an empty or invalid geometry.' using errcode = '23514';
		end if;

		area_square_meters := extensions.st_area(v_candidate_utm);
		deviation_percent := abs(area_square_meters / v_expected_area - 1) * 100;
		v_max_deviation := greatest(v_max_deviation, deviation_percent);
		if deviation_percent > 15 then
			raise exception 'Subdivision generation exceeded the 15 percent area tolerance.' using errcode = '23514';
		end if;
		if extensions.st_area(extensions.st_difference(v_candidate_utm, v_parent_utm)) > 0.01 then
			raise exception 'Subdivision generation produced geometry outside its parent.' using errcode = '23514';
		end if;

		v_candidate_4326 := extensions.st_multi(extensions.st_transform(v_candidate_utm, 4326))::extensions.geometry(MultiPolygon, 4326);
		if not extensions.st_isvalid(v_candidate_4326) then
			raise exception 'Subdivision generation produced invalid WGS84 output.' using errcode = '23514';
		end if;

		subdivision_number := v_region_number;
		subdivision_geometry := v_candidate_4326;
		return next;
	end loop;
end;
$$;

revoke all on function private.generate_balanced_subdivisions(extensions.geometry, integer) from public, anon, authenticated;

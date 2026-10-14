create or replace function private.save_subdivision_edits(p_region_id uuid, p_subdivisions jsonb) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_region extensions.geometry;
v_region_set_id uuid;
v_city_id uuid;
v_role text;
v_target_count integer;
v_expected_area double precision;
v_candidate extensions.geometry;
v_candidate_utm extensions.geometry;
v_child_geometries extensions.geometry [] := array []::extensions.geometry [];
v_subdivision_numbers integer [] := array []::integer [];
v_item record;
v_area double precision;
v_deviation double precision;
v_coverage_difference double precision;
v_has_overlaps boolean;
v_reports jsonb := '[]'::jsonb;
begin if v_current_user_id is null then raise exception 'Authentication is required.' using errcode = '42501';
end if;
select profile.role,
    profile.city_id into v_role,
    v_city_id
from public.profiles as profile
where profile.id = v_current_user_id;
if v_role is null
or v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid then raise exception 'The authenticated user is not a leader in the pilot city.' using errcode = '42501';
end if;
select region.geom,
    region.region_set_id into v_region,
    v_region_set_id
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region.id = p_region_id
    and region_set.city_id = v_city_id
    and region_set.status = 'draft' for
update of region;
if v_region is null then raise exception 'Draft region was not found.' using errcode = 'P0002';
end if;
if v_role <> 'lider_cidade'
and not exists (
    select 1
    from public.sector_leader_regions as assignment
    where assignment.sector_leader_id = v_current_user_id
        and assignment.region_id = p_region_id
) then raise exception 'The sector leader is not assigned to this region.' using errcode = '42501';
end if;
if jsonb_typeof(p_subdivisions) is distinct
from 'array'
    or octet_length(p_subdivisions::text) > 1048576
    or jsonb_array_length(p_subdivisions) > 50 then raise exception 'Subdivision input must be an array of at most 50 geometries and 1 MiB.' using errcode = '23514';
end if;
select count(*)::integer into v_target_count
from public.subdivisions as subdivision
where subdivision.region_id = p_region_id;
if v_target_count < 1
or jsonb_array_length(p_subdivisions) <> v_target_count then raise exception 'Subdivision geometry count does not match the generated draft.' using errcode = '23514';
end if;
v_expected_area := extensions.st_area(extensions.st_transform(v_region, 31982)) / v_target_count;
for v_item in
select item.value,
    item.ordinality::integer as ordinal
from jsonb_array_elements(p_subdivisions) with ordinality as item(value, ordinality) loop if jsonb_typeof(v_item.value) is distinct
from 'object'
    or jsonb_typeof(v_item.value->'geometry') is distinct
from 'object' then raise exception 'Each subdivision must include a GeoJSON geometry object.' using errcode = '23514';
end if;
if (v_item.value->>'number')::integer <> v_item.ordinal then raise exception 'Subdivision numbers must be contiguous starting at one.' using errcode = '23514';
end if;
begin v_candidate := extensions.st_setsrid(
    extensions.st_geomfromgeojson((v_item.value->'geometry')::text),
    4326
);
exception
when others then raise exception 'A subdivision contains invalid GeoJSON.' using errcode = '22023';
end;
if extensions.st_geometrytype(v_candidate) not in ('ST_Polygon', 'ST_MultiPolygon')
or not extensions.st_isvalid(v_candidate)
or extensions.st_npoints(v_candidate) > 10000 then raise exception 'Every subdivision must be a valid Polygon or MultiPolygon with at most 10,000 vertices.' using errcode = '23514';
end if;
v_candidate_utm := extensions.st_transform(v_candidate, 31982);
if extensions.st_area(
    extensions.st_difference(
        v_candidate_utm,
        extensions.st_transform(v_region, 31982)
    )
) > 0.01 then raise exception 'Every subdivision must remain inside its region.' using errcode = '23514';
end if;
v_area := extensions.st_area(v_candidate_utm);
v_deviation := abs(v_area / v_expected_area - 1) * 100;
if v_deviation > 15 then raise exception 'Every subdivision must be within 15 percent of the target area.' using errcode = '23514';
end if;
v_child_geometries := array_append(v_child_geometries, v_candidate);
v_subdivision_numbers := array_append(v_subdivision_numbers, v_item.ordinal);
v_reports := v_reports || jsonb_build_array(
    jsonb_build_object(
        'number',
        v_item.ordinal,
        'areaSquareMeters',
        round(v_area::numeric, 2),
        'deviationPercent',
        round(v_deviation::numeric, 4)
    )
);
end loop;
select extensions.st_area(
        extensions.st_symdifference(
            extensions.st_transform(v_region, 31982),
            extensions.st_unaryunion(
                extensions.st_collect(extensions.st_transform(child.geometry, 31982))
            )
        )
    ) into v_coverage_difference
from unnest(v_child_geometries) as child(geometry);
if v_coverage_difference > 0.01 then raise exception 'Subdivision edits must cover the complete parent region.' using errcode = '23514';
end if;
with child_metrics as (
    select child.ordinality::integer as subdivision_number,
        extensions.st_transform(child.geometry, 31982) as geometry
    from unnest(v_child_geometries) with ordinality as child(geometry, ordinality)
)
select coalesce(
        bool_or(
            extensions.st_area(
                extensions.st_intersection(first_child.geometry, second_child.geometry)
            ) > 0.01
        ),
        false
    ) into v_has_overlaps
from child_metrics as first_child
    join child_metrics as second_child on first_child.subdivision_number < second_child.subdivision_number;
if v_has_overlaps then raise exception 'Subdivision edits cannot overlap.' using errcode = '23514';
end if;
for v_item in
select item.value,
    item.ordinality::integer as ordinal
from jsonb_array_elements(p_subdivisions) with ordinality as item(value, ordinality) loop
update public.subdivisions as subdivision
set geom = extensions.st_multi(
        extensions.st_setsrid(
            extensions.st_geomfromgeojson((v_item.value->'geometry')::text),
            4326
        )
    )::extensions.geometry(MultiPolygon, 4326),
    updated_at = now()
where subdivision.region_id = p_region_id
    and subdivision.subdivision_number = v_item.ordinal;
end loop;
return jsonb_build_object(
    'regionId',
    p_region_id,
    'subdivisionCount',
    v_target_count,
    'coverageDifferenceSquareMeters',
    round(v_coverage_difference::numeric, 4),
    'subdivisions',
    v_reports
);
end;
$$;
revoke all on function private.save_subdivision_edits(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function private.save_subdivision_edits(uuid, jsonb) to authenticated;
create or replace function public.save_subdivision_edits(p_region_id uuid, p_subdivisions jsonb) returns jsonb language sql security invoker
set search_path = '' as $$
select private.save_subdivision_edits(p_region_id, p_subdivisions);
$$;
revoke all on function public.save_subdivision_edits(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function public.save_subdivision_edits(uuid, jsonb) to authenticated;
revoke all on table public.subdivisions
from anon,
    authenticated,
    service_role;
grant select on table public.subdivisions to authenticated;
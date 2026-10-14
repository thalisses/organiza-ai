create or replace function private.generate_subdivision_drafts(
        p_region_set_id uuid,
        p_region_number integer,
        p_target_count integer
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_region_id uuid;
v_parent extensions.geometry;
v_parent_utm extensions.geometry;
v_child extensions.geometry;
v_child_geometries extensions.geometry [] := array []::extensions.geometry [];
v_generated record;
v_region_reports jsonb := '[]'::jsonb;
v_expected_area double precision;
v_coverage_difference double precision;
v_has_overlaps boolean;
v_child_count integer;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can generate subdivisions.' using errcode = '42501';
end if;
if p_target_count is null
or p_target_count not between 1 and 50 then raise exception 'Subdivision count must be between 1 and 50.' using errcode = '23514';
end if;
select region.id,
    region.geom into v_region_id,
    v_parent
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region.region_set_id = p_region_set_id
    and region.region_number = p_region_number
    and region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and region_set.status = 'draft' for
update of region;
if v_region_id is null then raise exception 'Draft region was not found.' using errcode = 'P0002';
end if;
v_parent_utm := extensions.st_transform(v_parent, 31982);
v_expected_area := extensions.st_area(v_parent_utm) / p_target_count;
for v_generated in
select *
from private.generate_balanced_subdivisions(v_parent, p_target_count) loop v_child_geometries := array_append(
        v_child_geometries,
        v_generated.subdivision_geometry
    );
v_region_reports := v_region_reports || jsonb_build_array(
    jsonb_build_object(
        'number',
        v_generated.subdivision_number,
        'geometry',
        extensions.st_asgeojson(v_generated.subdivision_geometry, 15)::jsonb,
        'areaSquareMeters',
        round(v_generated.area_square_meters::numeric, 2),
        'deviationPercent',
        round(v_generated.deviation_percent::numeric, 4)
    )
);
end loop;
v_child_count := cardinality(v_child_geometries);
if v_child_count <> p_target_count then raise exception 'Subdivision generation returned an unexpected count.' using errcode = '23514';
end if;
select extensions.st_area(
        extensions.st_symdifference(
            v_parent_utm,
            extensions.st_unaryunion(
                extensions.st_collect(extensions.st_transform(child.geometry, 31982))
            )
        )
    ) into v_coverage_difference
from unnest(v_child_geometries) as child(geometry);
if v_coverage_difference > 0.01 then raise exception 'Generated subdivisions do not fully cover their parent.' using errcode = '23514';
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
if v_has_overlaps then raise exception 'Generated subdivisions overlap.' using errcode = '23514';
end if;
delete from public.subdivisions as subdivision
where subdivision.region_id = v_region_id
    and subdivision.subdivision_number > p_target_count;
insert into public.subdivisions (region_id, subdivision_number, geom)
select v_region_id,
    child.ordinality::integer,
    child.geometry
from unnest(v_child_geometries) with ordinality as child(geometry, ordinality) on conflict (region_id, subdivision_number) do
update
set geom = excluded.geom,
    updated_at = now();
return jsonb_build_object(
    'regionSetId',
    p_region_set_id,
    'regionId',
    v_region_id,
    'targetSubdivisionCount',
    p_target_count,
    'expectedAreaSquareMeters',
    round(v_expected_area::numeric, 2),
    'coverageDifferenceSquareMeters',
    round(v_coverage_difference::numeric, 4),
    'subdivisions',
    v_region_reports
);
end;
$$;
revoke all on function private.generate_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
grant execute on function private.generate_subdivision_drafts(uuid, integer, integer) to authenticated;
create or replace function public.generate_subdivision_drafts(
        p_region_set_id uuid,
        p_region_number integer,
        p_target_count integer
    ) returns jsonb language sql security invoker
set search_path = '' as $$
select private.generate_subdivision_drafts(p_region_set_id, p_region_number, p_target_count);
$$;
revoke all on function public.generate_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
grant execute on function public.generate_subdivision_drafts(uuid, integer, integer) to authenticated;
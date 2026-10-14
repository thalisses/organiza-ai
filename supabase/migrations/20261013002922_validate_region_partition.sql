create or replace function public.validate_region_partition(p_regions jsonb, p_target_count integer) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare current_user_id uuid := (
        select auth.uid()
    );
boundary_4326 extensions.geometry;
boundary_utm extensions.geometry;
candidate_geometry extensions.geometry;
candidate_geometries extensions.geometry [] := array []::extensions.geometry [];
region_input record;
region_count integer;
expected_area_square_meters double precision;
coverage_difference_square_meters double precision;
maximum_deviation_percent double precision;
all_contained boolean;
all_within_area_tolerance boolean;
has_overlaps boolean;
region_reports jsonb;
count_matches_target boolean;
begin if current_user_id is null then raise exception 'Authentication is required.' using errcode = '42501';
end if;
if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can validate a region partition.' using errcode = '42501';
end if;
if jsonb_typeof(p_regions) is distinct
from 'array' then raise exception 'Region geometries must be provided as a JSON array.' using errcode = '23514';
end if;
if p_target_count is null
or p_target_count not between 1 and 50 then raise exception 'The target region count must be between 1 and 50.' using errcode = '23514';
end if;
select extensions.st_unaryunion(extensions.st_collect(perimeter.geom)) into boundary_4326
from public.urban_perimeters as perimeter
where perimeter.city_id = '41152000-0000-4000-8000-000000000001'::uuid;
if boundary_4326 is null then raise exception 'The official urban perimeter is unavailable.' using errcode = 'P0002';
end if;
boundary_utm := extensions.st_transform(boundary_4326, 31982);
expected_area_square_meters := extensions.st_area(boundary_utm) / p_target_count;
for region_input in
select item.value
from jsonb_array_elements(p_regions) as item(value) loop if jsonb_typeof(region_input.value) is distinct
from 'object' then raise exception 'Each region must be a GeoJSON geometry object.' using errcode = '23514';
end if;
candidate_geometry := extensions.st_setsrid(
    extensions.st_geomfromgeojson(region_input.value::text),
    4326
);
if extensions.st_geometrytype(candidate_geometry) not in ('ST_Polygon', 'ST_MultiPolygon') then raise exception 'Regions must be Polygon or MultiPolygon geometries.' using errcode = '23514';
end if;
if not extensions.st_isvalid(candidate_geometry) then raise exception 'Every region geometry must be valid.' using errcode = '23514';
end if;
candidate_geometries := array_append(candidate_geometries, candidate_geometry);
end loop;
region_count := cardinality(candidate_geometries);
count_matches_target := region_count = p_target_count;
with candidate_metrics as (
    select candidate.geometry,
        candidate.ordinality::integer as region_number,
        extensions.st_transform(candidate.geometry, 31982) as metric_geometry,
        extensions.st_area(
            extensions.st_transform(candidate.geometry, 31982)
        ) as area_square_meters
    from unnest(candidate_geometries) with ordinality as candidate(geometry, ordinality)
),
measured_regions as (
    select candidate_metrics.region_number,
        candidate_metrics.area_square_meters,
        extensions.st_covers(boundary_4326, candidate_metrics.geometry) as is_contained,
        abs(
            candidate_metrics.area_square_meters / expected_area_square_meters - 1
        ) * 100 as deviation_percent
    from candidate_metrics
)
select coalesce(bool_and(measured_regions.is_contained), false),
    coalesce(
        bool_and(measured_regions.deviation_percent <= 15),
        false
    ),
    max(measured_regions.deviation_percent),
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'number',
                measured_regions.region_number,
                'areaSquareMeters',
                round(measured_regions.area_square_meters::numeric, 2),
                'containedByUrbanBoundary',
                measured_regions.is_contained,
                'deviationPercent',
                round(measured_regions.deviation_percent::numeric, 4),
                'withinAreaTolerance',
                measured_regions.deviation_percent <= 15
            )
            order by measured_regions.region_number
        ),
        '[]'::jsonb
    ) into all_contained,
    all_within_area_tolerance,
    maximum_deviation_percent,
    region_reports
from measured_regions;
if region_count = 0 then coverage_difference_square_meters := extensions.st_area(boundary_utm);
has_overlaps := false;
else with candidate_metrics as (
    select candidate.ordinality::integer as region_number,
        extensions.st_transform(candidate.geometry, 31982) as metric_geometry
    from unnest(candidate_geometries) with ordinality as candidate(geometry, ordinality)
)
select extensions.st_area(
        extensions.st_symdifference(
            boundary_utm,
            extensions.st_unaryunion(
                extensions.st_collect(candidate_metrics.metric_geometry)
            )
        )
    ) into coverage_difference_square_meters
from candidate_metrics;
with candidate_metrics as (
    select candidate.ordinality::integer as region_number,
        extensions.st_transform(candidate.geometry, 31982) as metric_geometry
    from unnest(candidate_geometries) with ordinality as candidate(geometry, ordinality)
)
select coalesce(
        bool_or(
            extensions.st_area(
                extensions.st_intersection(
                    first_region.metric_geometry,
                    second_region.metric_geometry
                )
            ) > 0.01
        ),
        false
    ) into has_overlaps
from candidate_metrics as first_region
    join candidate_metrics as second_region on first_region.region_number < second_region.region_number;
end if;
return jsonb_build_object(
    'targetRegionCount',
    p_target_count,
    'draftRegionCount',
    region_count,
    'expectedAreaSquareMeters',
    round(expected_area_square_meters::numeric, 2),
    'draftCountMatchesTarget',
    count_matches_target,
    'allContained',
    all_contained,
    'allWithinAreaTolerance',
    all_within_area_tolerance,
    'maximumDeviationPercent',
    round(maximum_deviation_percent::numeric, 4),
    'hasOverlaps',
    has_overlaps,
    'coverageDifferenceSquareMeters',
    round(coverage_difference_square_meters::numeric, 4),
    'passesValidation',
    count_matches_target
    and all_contained
    and all_within_area_tolerance
    and not has_overlaps
    and coverage_difference_square_meters <= 0.01,
    'regions',
    region_reports
);
end;
$$;
revoke all on function public.validate_region_partition(jsonb, integer)
from public,
    anon,
    authenticated;
grant execute on function public.validate_region_partition(jsonb, integer) to authenticated;
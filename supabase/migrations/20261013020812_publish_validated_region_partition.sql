create or replace function private.publish_region_partition(p_region_set_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_status text;
v_target_region_count integer;
v_regions jsonb;
v_region record;
v_child_count integer;
v_expected_area double precision;
v_invalid_count integer;
v_overlap_count integer;
v_coverage_difference double precision;
v_region_validation jsonb;
v_published_at timestamptz;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can publish a region set.' using errcode = '42501';
end if;
select region_set.city_id,
    region_set.status,
    region_set.target_region_count into v_city_id,
    v_status,
    v_target_region_count
from public.region_sets as region_set
where region_set.id = p_region_set_id for
update;
if v_status is null then raise exception 'Region draft was not found.' using errcode = 'P0002';
end if;
if v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid
or v_status <> 'draft' then raise exception 'Only a Maringá draft can be published.' using errcode = '23514';
end if;
if exists (
    select 1
    from public.region_sets as published
    where published.city_id = v_city_id
        and published.status = 'published'
) then raise exception 'A published region set already exists; replacement requires a separate realignment workflow.' using errcode = '23514';
end if;
select jsonb_agg(
        extensions.st_asgeojson(region.geom, 15)::jsonb
        order by region.region_number
    ) into v_regions
from public.regions as region
where region.region_set_id = p_region_set_id;
if coalesce(jsonb_array_length(v_regions), 0) <> v_target_region_count then raise exception 'Region count does not match the configured target.' using errcode = '23514';
end if;
v_region_validation := public.validate_region_partition(v_regions, v_target_region_count);
if (v_region_validation->>'passesValidation')::boolean is distinct
from true then raise exception 'Region set failed PostGIS validation.' using errcode = '23514';
end if;
for v_region in
select region.id,
    region.region_number,
    region.geom
from public.regions as region
where region.region_set_id = p_region_set_id
order by region.region_number loop
select count(*)::integer into v_child_count
from public.subdivisions as subdivision
where subdivision.region_id = v_region.id;
if v_child_count < 1 then raise exception 'Every region must have at least one subdivision before publication.' using errcode = '23514';
end if;
v_expected_area := extensions.st_area(extensions.st_transform(v_region.geom, 31982)) / v_child_count;
select count(*)::integer into v_invalid_count
from public.subdivisions as subdivision
where subdivision.region_id = v_region.id
    and (
        not extensions.st_isvalid(subdivision.geom)
        or extensions.st_srid(subdivision.geom) <> 4326
        or extensions.st_area(
            extensions.st_difference(
                extensions.st_transform(subdivision.geom, 31982),
                extensions.st_transform(v_region.geom, 31982)
            )
        ) > 0.01
        or abs(
            extensions.st_area(extensions.st_transform(subdivision.geom, 31982)) / v_expected_area - 1
        ) * 100 > 15
    );
if v_invalid_count > 0 then raise exception 'Subdivision validity, parent containment, or area tolerance failed.' using errcode = '23514';
end if;
with child_metrics as (
    select subdivision.subdivision_number,
        extensions.st_transform(subdivision.geom, 31982) as geom
    from public.subdivisions as subdivision
    where subdivision.region_id = v_region.id
)
select extensions.st_area(
        extensions.st_symdifference(
            extensions.st_transform(v_region.geom, 31982),
            extensions.st_unaryunion(extensions.st_collect(child_metrics.geom))
        )
    ) into v_coverage_difference
from child_metrics;
if v_coverage_difference > 0.01 then raise exception 'Subdivision set does not completely cover its parent region.' using errcode = '23514';
end if;
with child_metrics as (
    select subdivision.subdivision_number,
        extensions.st_transform(subdivision.geom, 31982) as geom
    from public.subdivisions as subdivision
    where subdivision.region_id = v_region.id
)
select coalesce(
        bool_or(
            extensions.st_area(
                extensions.st_intersection(first_child.geom, second_child.geom)
            ) > 0.01
        ),
        false
    )::integer into v_overlap_count
from child_metrics as first_child
    join child_metrics as second_child on first_child.subdivision_number < second_child.subdivision_number;
if v_overlap_count > 0 then raise exception 'Subdivision set contains overlapping areas.' using errcode = '23514';
end if;
end loop;
update public.region_sets
set status = 'published',
    published_at = now(),
    updated_at = now()
where id = p_region_set_id
returning published_at into v_published_at;
return jsonb_build_object(
    'regionSetId',
    p_region_set_id,
    'regionCount',
    v_target_region_count,
    'status',
    'published',
    'publishedAt',
    v_published_at
);
end;
$$;
revoke all on function private.publish_region_partition(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.publish_region_partition(uuid) to authenticated;
create or replace function public.publish_region_partition(p_region_set_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.publish_region_partition(p_region_set_id);
$$;
revoke all on function public.publish_region_partition(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.publish_region_partition(uuid) to authenticated;
create or replace function private.publish_region_partition(p_region_set_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_status text;
v_target_region_count integer;
v_regions jsonb;
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
if exists (
    select 1
    from public.regions as region
        join public.subdivisions as subdivision on subdivision.region_id = region.id
    where region.region_set_id = p_region_set_id
        and (
            not extensions.st_isvalid(subdivision.geom)
            or extensions.st_srid(subdivision.geom) <> 4326
            or extensions.st_isempty(subdivision.geom)
            or extensions.st_npoints(subdivision.geom) > 10000
            or extensions.st_area(extensions.st_transform(subdivision.geom, 31982)) <= 0
            or extensions.st_area(
                extensions.st_difference(
                    extensions.st_transform(subdivision.geom, 31982),
                    extensions.st_transform(region.geom, 31982)
                )
            ) > 0.01
        )
)
or exists (
    select region.id
    from public.regions as region
        join public.subdivisions as subdivision on subdivision.region_id = region.id
    where region.region_set_id = p_region_set_id
    group by region.id
    having count(*) > 50
) then raise exception 'Subdivision validity, parent containment, or input limits failed.' using errcode = '23514';
end if;
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
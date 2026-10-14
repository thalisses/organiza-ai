alter table public.subdivisions
add column if not exists origin text not null default 'unknown' check (origin in ('unknown', 'automatic', 'manual')),
    add column if not exists manual_request_id uuid unique,
    add column if not exists manual_created_by uuid references public.profiles(id),
    add column if not exists manual_input_hash text;
create or replace function private.create_manual_subdivision(
        p_region_id uuid,
        p_geometry jsonb,
        p_request_id uuid
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_user_id uuid := (
        select auth.uid()
    );
v_region extensions.geometry;
v_geometry extensions.geometry;
v_saved public.subdivisions %rowtype;
v_hash text;
v_number integer;
begin if v_user_id is null then raise exception 'Authentication is required.' using errcode = '42501';
end if;
if p_request_id is null
or p_region_id is null then raise exception 'MANUAL_INPUT_INVALID' using errcode = '23514';
end if;
select region.geom into v_region
from public.regions region
    join public.region_sets region_set on region_set.id = region.region_set_id
    join public.profiles profile on profile.id = v_user_id
    and profile.role = 'lider_cidade'
    and profile.city_id = region_set.city_id
where region.id = p_region_id
    and region_set.status = 'published';
if v_region is null then raise exception 'Only the city leader can create subdivisions in the published map.' using errcode = '42501';
end if;
if jsonb_typeof(p_geometry) is distinct
from 'object'
    or p_geometry ? 'crs'
    or octet_length(p_geometry::text) > 1048576 then raise exception 'MANUAL_INPUT_INVALID' using errcode = '23514';
end if;
v_hash := md5(p_geometry::text);
perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_id::text, 0)
);
select * into v_saved
from public.subdivisions
where manual_request_id = p_request_id;
if found then if v_saved.region_id <> p_region_id
or v_saved.manual_created_by <> v_user_id
or v_saved.manual_input_hash is distinct
from v_hash then raise exception 'MANUAL_REQUEST_CONFLICT' using errcode = '23514';
end if;
else
select region.geom into v_region
from public.regions region
    join public.region_sets region_set on region_set.id = region.region_set_id
where region.id = p_region_id
    and region_set.status = 'published' for
update of region;
if v_region is null then raise exception 'The selected region is no longer published.' using errcode = '40001';
end if;
if (
    select count(*)
    from public.subdivisions
    where region_id = p_region_id
) >= 50 then raise exception 'MANUAL_LIMIT_EXCEEDED' using errcode = '23514';
end if;
begin v_geometry := extensions.st_setsrid(
    extensions.st_geomfromgeojson(p_geometry::text),
    4326
);
exception
when others then raise exception 'MANUAL_GEOMETRY_INVALID' using errcode = '23514';
end;
if extensions.st_geometrytype(v_geometry) not in ('ST_Polygon', 'ST_MultiPolygon')
or extensions.st_ndims(v_geometry) <> 2
or not extensions.st_isvalid(v_geometry)
or extensions.st_isempty(v_geometry)
or extensions.st_npoints(v_geometry) > 10000
or exists (
    select 1
    from extensions.st_dumppoints(v_geometry) point
    where extensions.st_x(point.geom) not between -180 and 180
        or extensions.st_y(point.geom) not between -90 and 90
) then raise exception 'MANUAL_GEOMETRY_INVALID' using errcode = '23514';
end if;
begin v_geometry := extensions.st_multi(
    extensions.st_collectionextract(
        extensions.st_intersection(
            extensions.st_transform(v_geometry, 31982),
            extensions.st_transform(v_region, 31982)
        ),
        3
    )
);
exception
when others then raise exception 'MANUAL_GEOMETRY_INVALID' using errcode = '23514';
end;
if extensions.st_isempty(v_geometry)
or not extensions.st_isvalid(v_geometry)
or extensions.st_area(v_geometry) <= 0
or extensions.st_npoints(v_geometry) > 10000 then raise exception 'MANUAL_GEOMETRY_INVALID' using errcode = '23514';
end if;
select coalesce(max(subdivision_number), 0) + 1 into v_number
from public.subdivisions
where region_id = p_region_id;
insert into public.subdivisions(
        region_id,
        subdivision_number,
        geom,
        origin,
        manual_request_id,
        manual_created_by,
        manual_input_hash
    )
values (
        p_region_id,
        v_number,
        extensions.st_transform(v_geometry, 4326),
        'manual',
        p_request_id,
        v_user_id,
        v_hash
    )
returning * into v_saved;
end if;
return jsonb_build_object(
    'id',
    v_saved.id,
    'regionId',
    v_saved.region_id,
    'number',
    v_saved.subdivision_number,
    'geometry',
    extensions.st_asgeojson(v_saved.geom, 15)::jsonb,
    'areaSquareMeters',
    extensions.st_area(extensions.st_transform(v_saved.geom, 31982))
);
end;
$$;
revoke all on function private.create_manual_subdivision(uuid, jsonb, uuid)
from public,
    anon,
    authenticated;
grant execute on function private.create_manual_subdivision(uuid, jsonb, uuid) to authenticated;
create or replace function public.create_manual_subdivision(
        p_region_id uuid,
        p_geometry jsonb,
        p_request_id uuid
    ) returns jsonb language sql security invoker
set search_path = '' as $$
select private.create_manual_subdivision(p_region_id, p_geometry, p_request_id);
$$;
revoke all on function public.create_manual_subdivision(uuid, jsonb, uuid)
from public,
    anon,
    authenticated;
grant execute on function public.create_manual_subdivision(uuid, jsonb, uuid) to authenticated;
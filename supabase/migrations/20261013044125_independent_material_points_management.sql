create table public.material_points (
    id uuid primary key default gen_random_uuid(),
    city_id uuid not null references public.cities (id),
    name text not null check (
        char_length(btrim(name)) between 2 and 120
    ),
    material_type text not null check (
        char_length(btrim(material_type)) between 2 and 120
    ),
    topic text not null check (
        char_length(btrim(topic)) between 2 and 160
    ),
    address text not null check (
        char_length(btrim(address)) between 3 and 240
    ),
    location extensions.geometry(Point, 4326) not null,
    created_by uuid not null references public.profiles (id),
    updated_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (extensions.st_srid(location) = 4326),
    check (
        extensions.st_x(location) between -180 and 180
        and extensions.st_y(location) between -90 and 90
    )
);
create table public.pickup_windows (
    id uuid primary key default gen_random_uuid(),
    material_point_id uuid not null references public.material_points (id) on delete cascade,
    day_of_week smallint not null check (
        day_of_week between 0 and 6
    ),
    starts_at time without time zone not null,
    ends_at time without time zone not null,
    created_at timestamptz not null default now(),
    check (ends_at > starts_at)
);
create index material_points_city_name_idx on public.material_points (city_id, name);
create index material_points_location_gist_idx on public.material_points using gist (location);
create index pickup_windows_point_day_start_idx on public.pickup_windows (material_point_id, day_of_week, starts_at);
alter table public.material_points enable row level security;
alter table public.pickup_windows enable row level security;
revoke all on table public.material_points,
public.pickup_windows
from anon,
    authenticated,
    service_role;
grant select on table public.material_points,
    public.pickup_windows to authenticated;
create policy "authenticated users read Maringa material points" on public.material_points for
select to authenticated using (
        city_id = '41152000-0000-4000-8000-000000000001'::uuid
    );
create policy "authenticated users read pickup windows for Maringa points" on public.pickup_windows for
select to authenticated using (
        exists (
            select 1
            from public.material_points as material_point
            where material_point.id = material_point_id
                and material_point.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        )
    );
create or replace function private.save_material_point(
        p_point_id uuid,
        p_name text,
        p_material_type text,
        p_topic text,
        p_address text,
        p_longitude double precision,
        p_latitude double precision,
        p_windows jsonb
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_point extensions.geometry(Point, 4326);
v_boundary extensions.geometry;
v_point_id uuid;
v_window record;
v_day_of_week smallint;
v_starts_at time without time zone;
v_ends_at time without time zone;
begin if v_current_user_id is null then raise exception 'Authentication is required to manage material points.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can manage material points.' using errcode = '42501';
end if;
if p_name is null
or char_length(btrim(p_name)) not between 2 and 120
or p_material_type is null
or char_length(btrim(p_material_type)) not between 2 and 120
or p_topic is null
or char_length(btrim(p_topic)) not between 2 and 160
or p_address is null
or char_length(btrim(p_address)) not between 3 and 240 then raise exception 'Name, material, topic and address are required.' using errcode = '23514';
end if;
if p_longitude is null
or p_latitude is null
or p_longitude not between -180 and 180
or p_latitude not between -90 and 90 then raise exception 'Valid WGS84 coordinates are required.' using errcode = '23514';
end if;
if jsonb_typeof(p_windows) is distinct
from 'array' then raise exception 'Pickup windows must be a JSON array.' using errcode = '23514';
end if;
if jsonb_array_length(p_windows) not between 1 and 100 then raise exception 'At least one and at most 100 pickup windows are required.' using errcode = '23514';
end if;
for v_window in
select item.value
from jsonb_array_elements(p_windows) as item(value) loop if jsonb_typeof(v_window.value) is distinct
from 'object'
    or jsonb_typeof(v_window.value->'dayOfWeek') is distinct
from 'number'
    or jsonb_typeof(v_window.value->'startsAt') is distinct
from 'string'
    or jsonb_typeof(v_window.value->'endsAt') is distinct
from 'string'
    or (v_window.value->>'startsAt') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    or (v_window.value->>'endsAt') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Pickup windows require a weekday and HH:mm start/end times.' using errcode = '23514';
end if;
v_day_of_week := (v_window.value->>'dayOfWeek')::smallint;
v_starts_at := (v_window.value->>'startsAt')::time;
v_ends_at := (v_window.value->>'endsAt')::time;
if v_day_of_week not between 0 and 6
or v_ends_at <= v_starts_at then raise exception 'Pickup window day or end time is invalid.' using errcode = '23514';
end if;
end loop;
if exists (
    select 1
    from (
            select item.ordinality,
                (item.value->>'dayOfWeek')::smallint as day_of_week,
                (item.value->>'startsAt')::time as starts_at,
                (item.value->>'endsAt')::time as ends_at
            from jsonb_array_elements(p_windows) with ordinality as item(value, ordinality)
        ) as first_window
        join (
            select item.ordinality,
                (item.value->>'dayOfWeek')::smallint as day_of_week,
                (item.value->>'startsAt')::time as starts_at,
                (item.value->>'endsAt')::time as ends_at
            from jsonb_array_elements(p_windows) with ordinality as item(value, ordinality)
        ) as second_window on first_window.day_of_week = second_window.day_of_week
        and first_window.ordinality < second_window.ordinality
        and first_window.starts_at < second_window.ends_at
        and second_window.starts_at < first_window.ends_at
) then raise exception 'Pickup windows on the same weekday cannot overlap.' using errcode = '23514';
end if;
v_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
);
select extensions.st_unaryunion(extensions.st_collect(perimeter.geom)) into v_boundary
from public.urban_perimeters as perimeter;
if not extensions.st_covers(v_boundary, v_point) then raise exception 'Material point must be inside the Maringa urban perimeter.' using errcode = '23514';
end if;
if p_point_id is null then
insert into public.material_points (
        city_id,
        name,
        material_type,
        topic,
        address,
        location,
        created_by,
        updated_by
    )
values (
        v_city_id,
        btrim(p_name),
        btrim(p_material_type),
        btrim(p_topic),
        btrim(p_address),
        v_point,
        v_current_user_id,
        v_current_user_id
    )
returning id into v_point_id;
else perform material_point.id
from public.material_points as material_point
where material_point.id = p_point_id
    and material_point.city_id = v_city_id for
update;
if not found then raise exception 'Material point was not found in Maringa.' using errcode = 'P0002';
end if;
update public.material_points
set name = btrim(p_name),
    material_type = btrim(p_material_type),
    topic = btrim(p_topic),
    address = btrim(p_address),
    location = v_point,
    updated_by = v_current_user_id,
    updated_at = now()
where id = p_point_id
returning id into v_point_id;
delete from public.pickup_windows
where material_point_id = v_point_id;
end if;
for v_window in
select item.value
from jsonb_array_elements(p_windows) as item(value) loop
insert into public.pickup_windows (
        material_point_id,
        day_of_week,
        starts_at,
        ends_at
    )
values (
        v_point_id,
        (v_window.value->>'dayOfWeek')::smallint,
        (v_window.value->>'startsAt')::time,
        (v_window.value->>'endsAt')::time
    );
end loop;
return jsonb_build_object('id', v_point_id);
end;
$$;
revoke all on function private.save_material_point(
    uuid,
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    jsonb
)
from public,
    anon,
    authenticated;
grant execute on function private.save_material_point(
        uuid,
        text,
        text,
        text,
        text,
        double precision,
        double precision,
        jsonb
    ) to authenticated;
create or replace function public.save_material_point(
        p_point_id uuid,
        p_name text,
        p_material_type text,
        p_topic text,
        p_address text,
        p_longitude double precision,
        p_latitude double precision,
        p_windows jsonb
    ) returns jsonb language sql security invoker
set search_path = '' as $$
select private.save_material_point(
        p_point_id,
        p_name,
        p_material_type,
        p_topic,
        p_address,
        p_longitude,
        p_latitude,
        p_windows
    );
$$;
revoke all on function public.save_material_point(
    uuid,
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    jsonb
)
from public,
    anon,
    authenticated;
grant execute on function public.save_material_point(
        uuid,
        text,
        text,
        text,
        text,
        double precision,
        double precision,
        jsonb
    ) to authenticated;
create or replace function private.delete_material_point(p_point_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_deleted_id uuid;
begin if v_current_user_id is null then raise exception 'Authentication is required to delete material points.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can delete material points.' using errcode = '42501';
end if;
delete from public.material_points
where id = p_point_id
    and city_id = v_city_id
returning id into v_deleted_id;
if not found then raise exception 'Material point was not found in Maringa.' using errcode = 'P0002';
end if;
return jsonb_build_object('id', v_deleted_id, 'deleted', true);
end;
$$;
revoke all on function private.delete_material_point(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.delete_material_point(uuid) to authenticated;
create or replace function public.delete_material_point(p_point_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.delete_material_point(p_point_id);
$$;
revoke all on function public.delete_material_point(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.delete_material_point(uuid) to authenticated;
create or replace function public.list_material_points() returns jsonb language sql stable security invoker
set search_path = '' as $$
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                material_point.id,
                'name',
                material_point.name,
                'materialType',
                material_point.material_type,
                'topic',
                material_point.topic,
                'address',
                material_point.address,
                'location',
                extensions.st_asgeojson(material_point.location, 8)::jsonb,
                'pickupWindows',
                coalesce(
                    (
                        select jsonb_agg(
                                jsonb_build_object(
                                    'dayOfWeek',
                                    pickup_window.day_of_week,
                                    'startsAt',
                                    to_char(pickup_window.starts_at, 'HH24:MI'),
                                    'endsAt',
                                    to_char(pickup_window.ends_at, 'HH24:MI')
                                )
                                order by pickup_window.day_of_week,
                                    pickup_window.starts_at
                            )
                        from public.pickup_windows as pickup_window
                        where pickup_window.material_point_id = material_point.id
                    ),
                    '[]'::jsonb
                )
            )
            order by material_point.name,
                material_point.id
        ),
        '[]'::jsonb
    )
from public.material_points as material_point
where material_point.city_id = '41152000-0000-4000-8000-000000000001'::uuid;
$$;
revoke all on function public.list_material_points()
from public,
    anon,
    authenticated;
grant execute on function public.list_material_points() to authenticated;
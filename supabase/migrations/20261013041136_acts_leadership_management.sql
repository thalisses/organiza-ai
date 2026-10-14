create table public.acts (
    id uuid primary key default gen_random_uuid(),
    city_id uuid not null references public.cities (id),
    title text not null check (
        char_length(btrim(title)) between 3 and 120
    ),
    category text not null check (
        category in (
            'leaflet_distribution',
            'poster_pasting',
            'meeting',
            'public_rally',
            'training',
            'other'
        )
    ),
    other_detail text,
    scope_type text generated always as (
        case
            when subdivision_id is null then 'city'
            else 'subdivision'
        end
    ) stored,
    subdivision_id uuid references public.subdivisions (id) on delete restrict,
    starts_at timestamptz not null,
    meeting_point extensions.geometry(Point, 4326) not null,
    meeting_address text not null check (
        char_length(btrim(meeting_address)) between 3 and 240
    ),
    status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
    created_by uuid not null references public.profiles (id),
    updated_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (
            category = 'other'
            and other_detail is not null
            and char_length(btrim(other_detail)) between 2 and 80
        )
        or (
            category <> 'other'
            and other_detail is null
        )
    ),
    check (extensions.st_srid(meeting_point) = 4326),
    check (
        extensions.st_x(meeting_point) between -180 and 180
        and extensions.st_y(meeting_point) between -90 and 90
    )
);
create index acts_city_starts_at_idx on public.acts (city_id, starts_at);
create index acts_subdivision_starts_at_idx on public.acts (subdivision_id, starts_at)
where subdivision_id is not null;
create index acts_meeting_point_gist_idx on public.acts using gist (meeting_point);
alter table public.acts enable row level security;
revoke all on table public.acts
from anon,
    authenticated,
    service_role;
grant select on table public.acts to authenticated;
create policy "authenticated users can read Maringa acts" on public.acts for
select to authenticated using (
        city_id = '41152000-0000-4000-8000-000000000001'::uuid
    );
create or replace function private.list_manageable_act_subdivisions() returns jsonb language plpgsql stable security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_subdivisions jsonb;
begin
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_current_user_id is null
or v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid
or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can manage subdivision acts.' using errcode = '42501';
end if;
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                subdivision.id,
                'regionNumber',
                region.region_number,
                'subdivisionNumber',
                subdivision.subdivision_number
            )
            order by region.region_number,
                subdivision.subdivision_number
        ),
        '[]'::jsonb
    ) into v_subdivisions
from public.subdivisions as subdivision
    join public.regions as region on region.id = subdivision.region_id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region_set.city_id = v_city_id
    and region_set.status = 'published'
    and (
        v_role = 'lider_cidade'
        or exists (
            select 1
            from public.sector_leader_regions as assignment
            where assignment.region_id = region.id
                and assignment.sector_leader_id = v_current_user_id
        )
    );
return v_subdivisions;
end;
$$;
revoke all on function private.list_manageable_act_subdivisions()
from public,
    anon,
    authenticated;
grant execute on function private.list_manageable_act_subdivisions() to authenticated;
create or replace function public.list_manageable_act_subdivisions() returns jsonb language sql security invoker
set search_path = '' as $$
select private.list_manageable_act_subdivisions();
$$;
revoke all on function public.list_manageable_act_subdivisions()
from public,
    anon,
    authenticated;
grant execute on function public.list_manageable_act_subdivisions() to authenticated;
create or replace function private.save_act(
        p_act_id uuid,
        p_title text,
        p_category text,
        p_other_detail text,
        p_starts_at timestamptz,
        p_longitude double precision,
        p_latitude double precision,
        p_meeting_address text,
        p_subdivision_id uuid
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_point extensions.geometry(Point, 4326);
v_boundary extensions.geometry;
v_region_id uuid;
v_region_set_city_id uuid;
v_region_set_status text;
v_existing_subdivision_id uuid;
v_existing_status text;
v_act_id uuid;
begin if v_current_user_id is null then raise exception 'Authentication is required to manage acts.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid
or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can manage acts.' using errcode = '42501';
end if;
if p_title is null
or char_length(btrim(p_title)) not between 3 and 120 then raise exception 'Act title must contain between 3 and 120 characters.' using errcode = '23514';
end if;
if p_category not in (
    'leaflet_distribution',
    'poster_pasting',
    'meeting',
    'public_rally',
    'training',
    'other'
) then raise exception 'Act category is not supported.' using errcode = '23514';
end if;
if p_category = 'other' then if p_other_detail is null
or char_length(btrim(p_other_detail)) not between 2 and 80 then raise exception 'Other acts require a short category detail.' using errcode = '23514';
end if;
elsif p_other_detail is not null then raise exception 'Category detail is only valid for other acts.' using errcode = '23514';
end if;
if p_starts_at is null
or p_meeting_address is null
or char_length(btrim(p_meeting_address)) not between 3 and 240
or p_longitude is null
or p_latitude is null
or p_longitude not between -180 and 180
or p_latitude not between -90 and 90 then raise exception 'Act date, address and valid coordinates are required.' using errcode = '23514';
end if;
v_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
);
select extensions.st_unaryunion(extensions.st_collect(perimeter.geom)) into v_boundary
from public.urban_perimeters as perimeter;
if not extensions.st_covers(v_boundary, v_point) then raise exception 'Meeting point must be inside the Maringa urban perimeter.' using errcode = '23514';
end if;
if p_subdivision_id is null then if v_role <> 'lider_cidade' then raise exception 'Only the city leader can create city-wide acts.' using errcode = '42501';
end if;
else
select region.id,
    region_set.city_id,
    region_set.status into v_region_id,
    v_region_set_city_id,
    v_region_set_status
from public.subdivisions as subdivision
    join public.regions as region on region.id = subdivision.region_id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where subdivision.id = p_subdivision_id;
if not found
or v_region_set_city_id <> v_city_id
or v_region_set_status <> 'published' then raise exception 'Subdivision must belong to the published Maringa map.' using errcode = '23514';
end if;
if v_role = 'lider_setor'
and not exists (
    select 1
    from public.sector_leader_regions as assignment
    where assignment.sector_leader_id = v_current_user_id
        and assignment.region_id = v_region_id
) then raise exception 'Sector leaders can manage acts only in assigned regions.' using errcode = '42501';
end if;
end if;
if p_act_id is null then
insert into public.acts (
        city_id,
        title,
        category,
        other_detail,
        starts_at,
        meeting_point,
        meeting_address,
        subdivision_id,
        created_by,
        updated_by
    )
values (
        v_city_id,
        btrim(p_title),
        p_category,
        nullif(btrim(p_other_detail), ''),
        p_starts_at,
        v_point,
        btrim(p_meeting_address),
        p_subdivision_id,
        v_current_user_id,
        v_current_user_id
    )
returning id into v_act_id;
else
select act.subdivision_id,
    act.status into v_existing_subdivision_id,
    v_existing_status
from public.acts as act
where act.id = p_act_id
    and act.city_id = v_city_id for
update;
if not found then raise exception 'Act was not found in Maringa.' using errcode = 'P0002';
end if;
if v_role = 'lider_setor'
and (
    v_existing_subdivision_id is null
    or not exists (
        select 1
        from public.subdivisions as existing_subdivision
            join public.sector_leader_regions as assignment on assignment.region_id = existing_subdivision.region_id
        where existing_subdivision.id = v_existing_subdivision_id
            and assignment.sector_leader_id = v_current_user_id
    )
) then raise exception 'Sector leaders can edit acts only in assigned regions.' using errcode = '42501';
end if;
update public.acts
set title = btrim(p_title),
    category = p_category,
    other_detail = nullif(btrim(p_other_detail), ''),
    starts_at = p_starts_at,
    meeting_point = v_point,
    meeting_address = btrim(p_meeting_address),
    subdivision_id = p_subdivision_id,
    updated_by = v_current_user_id,
    updated_at = now()
where id = p_act_id
returning id into v_act_id;
end if;
return jsonb_build_object('id', v_act_id);
end;
$$;
revoke all on function private.save_act(
    uuid,
    text,
    text,
    text,
    timestamptz,
    double precision,
    double precision,
    text,
    uuid
)
from public,
    anon,
    authenticated;
grant execute on function private.save_act(
        uuid,
        text,
        text,
        text,
        timestamptz,
        double precision,
        double precision,
        text,
        uuid
    ) to authenticated;
create or replace function public.save_act(
        p_act_id uuid,
        p_title text,
        p_category text,
        p_other_detail text,
        p_starts_at timestamptz,
        p_longitude double precision,
        p_latitude double precision,
        p_meeting_address text,
        p_subdivision_id uuid
    ) returns jsonb language sql security invoker
set search_path = '' as $$
select private.save_act(
        p_act_id,
        p_title,
        p_category,
        p_other_detail,
        p_starts_at,
        p_longitude,
        p_latitude,
        p_meeting_address,
        p_subdivision_id
    );
$$;
revoke all on function public.save_act(
    uuid,
    text,
    text,
    text,
    timestamptz,
    double precision,
    double precision,
    text,
    uuid
)
from public,
    anon,
    authenticated;
grant execute on function public.save_act(
        uuid,
        text,
        text,
        text,
        timestamptz,
        double precision,
        double precision,
        text,
        uuid
    ) to authenticated;
create or replace function private.cancel_act(p_act_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_subdivision_id uuid;
v_status text;
begin if v_current_user_id is null then raise exception 'Authentication is required to cancel acts.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid
or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can cancel acts.' using errcode = '42501';
end if;
select act.subdivision_id,
    act.status into v_subdivision_id,
    v_status
from public.acts as act
where act.id = p_act_id
    and act.city_id = v_city_id for
update;
if not found then raise exception 'Act was not found in Maringa.' using errcode = 'P0002';
end if;
if v_role = 'lider_setor'
and (
    v_subdivision_id is null
    or not exists (
        select 1
        from public.subdivisions as subdivision
            join public.sector_leader_regions as assignment on assignment.region_id = subdivision.region_id
        where subdivision.id = v_subdivision_id
            and assignment.sector_leader_id = v_current_user_id
    )
) then raise exception 'Sector leaders can cancel acts only in assigned regions.' using errcode = '42501';
end if;
if v_status = 'scheduled' then
update public.acts
set status = 'cancelled',
    updated_by = v_current_user_id,
    updated_at = now()
where id = p_act_id;
end if;
return jsonb_build_object('id', p_act_id, 'status', 'cancelled');
end;
$$;
revoke all on function private.cancel_act(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.cancel_act(uuid) to authenticated;
create or replace function public.cancel_act(p_act_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.cancel_act(p_act_id);
$$;
revoke all on function public.cancel_act(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.cancel_act(uuid) to authenticated;
create or replace function public.list_acts() returns jsonb language sql stable security invoker
set search_path = '' as $$
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                act.id,
                'title',
                act.title,
                'category',
                act.category,
                'otherDetail',
                act.other_detail,
                'startsAt',
                act.starts_at,
                'meetingLocation',
                extensions.st_asgeojson(act.meeting_point, 8)::jsonb,
                'meetingAddress',
                act.meeting_address,
                'subdivisionId',
                act.subdivision_id,
                'scope',
                act.scope_type,
                'status',
                act.status
            )
            order by act.starts_at,
                act.id
        ),
        '[]'::jsonb
    )
from public.acts as act
where act.city_id = '41152000-0000-4000-8000-000000000001'::uuid;
$$;
revoke all on function public.list_acts()
from public,
    anon,
    authenticated;
grant execute on function public.list_acts() to authenticated;
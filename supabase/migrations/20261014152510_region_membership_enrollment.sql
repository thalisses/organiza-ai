create table public.region_memberships (
    id uuid primary key default gen_random_uuid(),
    participant_id uuid not null references public.profiles (id),
    region_id uuid not null references public.regions (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    released_at timestamptz
);
create unique index region_memberships_one_active_region_per_participant_idx on public.region_memberships (participant_id, region_id)
where released_at is null;
create index region_memberships_participant_idx on public.region_memberships (participant_id);
create index region_memberships_region_active_idx on public.region_memberships (region_id)
where released_at is null;
alter table public.region_memberships enable row level security;
revoke all on table public.region_memberships
from anon,
    authenticated,
    service_role;
grant select on table public.region_memberships to authenticated;
create policy "participants read their own region memberships" on public.region_memberships for
select to authenticated using (
        participant_id = (
            select auth.uid()
        )
    );
create or replace function private.require_published_region_membership() returns trigger language plpgsql security definer
set search_path = '' as $$
declare v_region_set_status text;
v_participant_role text;
begin if new.released_at is not null then return new;
end if;
select region_set.status into v_region_set_status
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region.id = new.region_id for share of region_set;
if v_region_set_status is distinct
from 'published' then raise exception 'Region memberships can only target a published map division.' using errcode = '23514';
end if;
select profile.role into v_participant_role
from public.profiles as profile
where profile.id = new.participant_id
    and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid;
if v_participant_role is distinct
from 'participante' then raise exception 'Only Maringá participants can hold active region memberships.' using errcode = '23514';
end if;
new.updated_at := now();
return new;
end;
$$;
revoke all on function private.require_published_region_membership()
from public,
    anon,
    authenticated;
create trigger require_published_region_membership before
insert
    or
update of participant_id,
    region_id,
    released_at on public.region_memberships for each row execute function private.require_published_region_membership();
create or replace function private.release_region_memberships_on_archive() returns trigger language plpgsql security definer
set search_path = '' as $$ begin if old.status = 'published'
    and new.status = 'archived' then
update public.region_memberships as membership
set released_at = now(),
    updated_at = now()
where membership.released_at is null
    and membership.region_id in (
        select region.id
        from public.regions as region
        where region.region_set_id = old.id
    );
end if;
return new;
end;
$$;
revoke all on function private.release_region_memberships_on_archive()
from public,
    anon,
    authenticated;
create trigger release_region_memberships_on_archive
after
update of status on public.region_sets for each row execute function private.release_region_memberships_on_archive();
create or replace function private.set_my_region_memberships(p_region_ids uuid []) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_published_region_set_id uuid;
v_region_ids jsonb;
begin if v_current_user_id is null then raise exception 'Authentication is required to join map divisions.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id for
update;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role is distinct
from 'participante' then raise exception 'Only Maringá participants can manage their own map division memberships.' using errcode = '42501';
end if;
if p_region_ids is null
or cardinality(p_region_ids) > 50
or cardinality(p_region_ids) <> (
    select count(distinct region_id)::integer
    from unnest(p_region_ids) as selected(region_id)
) then raise exception 'Map division memberships must contain at most 50 unique region IDs.' using errcode = '23514';
end if;
select region_set.id into v_published_region_set_id
from public.region_sets as region_set
where region_set.city_id = v_city_id
    and region_set.status = 'published' for share;
if v_published_region_set_id is null then raise exception 'There is no published region map available for enrollment.' using errcode = '23514';
end if;
if (
    select count(distinct region.id)::integer
    from unnest(p_region_ids) as selected(region_id)
        join public.regions as region on region.id = selected.region_id
        and region.region_set_id = v_published_region_set_id
) <> cardinality(p_region_ids) then raise exception 'Every selected division must belong to the published map.' using errcode = '23514';
end if;
update public.region_memberships as membership
set released_at = now(),
    updated_at = now()
where membership.participant_id = v_current_user_id
    and membership.released_at is null
    and not (membership.region_id = any(p_region_ids));
insert into public.region_memberships (participant_id, region_id)
select v_current_user_id,
    selected.region_id
from unnest(p_region_ids) as selected(region_id) on conflict (participant_id, region_id)
where released_at is null do nothing;
select coalesce(
        jsonb_agg(
            membership.region_id
            order by region.region_number
        ),
        '[]'::jsonb
    ) into v_region_ids
from public.region_memberships as membership
    join public.regions as region on region.id = membership.region_id
where membership.participant_id = v_current_user_id
    and membership.released_at is null
    and region.region_set_id = v_published_region_set_id;
return v_region_ids;
end;
$$;
revoke all on function private.set_my_region_memberships(uuid [])
from public,
    anon,
    authenticated;
grant execute on function private.set_my_region_memberships(uuid []) to authenticated;
create or replace function public.set_my_region_memberships(p_region_ids uuid []) returns jsonb language sql security invoker
set search_path = '' as $$
select private.set_my_region_memberships(p_region_ids);
$$;
revoke all on function public.set_my_region_memberships(uuid [])
from public,
    anon,
    authenticated;
grant execute on function public.set_my_region_memberships(uuid []) to authenticated;
create or replace function private.get_my_active_region_memberships() returns jsonb language sql stable security definer
set search_path = '' as $$
select coalesce(
        jsonb_agg(
            membership.region_id
            order by region.region_number
        ),
        '[]'::jsonb
    )
from public.region_memberships as membership
    join public.regions as region on region.id = membership.region_id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where membership.participant_id = (
        select auth.uid()
    )
    and membership.released_at is null
    and region_set.status = 'published';
$$;
revoke all on function private.get_my_active_region_memberships()
from public,
    anon,
    authenticated;
grant execute on function private.get_my_active_region_memberships() to authenticated;
create or replace function public.get_my_active_region_memberships() returns jsonb language sql stable security invoker
set search_path = '' as $$
select private.get_my_active_region_memberships();
$$;
revoke all on function public.get_my_active_region_memberships()
from public,
    anon,
    authenticated;
grant execute on function public.get_my_active_region_memberships() to authenticated;
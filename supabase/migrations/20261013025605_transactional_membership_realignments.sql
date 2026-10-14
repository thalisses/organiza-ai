alter table public.region_sets drop constraint region_sets_check;
alter table public.region_sets
add constraint region_sets_publication_timestamp_check check (
        (
            status = 'draft'
            and published_at is null
        )
        or (
            status in ('published', 'archived')
            and published_at is not null
        )
    );
create table public.subdivision_memberships (
    id uuid primary key default gen_random_uuid(),
    participant_id uuid not null references public.profiles (id),
    subdivision_id uuid not null references public.subdivisions (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    released_at timestamptz
);
create unique index subdivision_memberships_one_active_per_participant_idx on public.subdivision_memberships (participant_id)
where released_at is null;
create index subdivision_memberships_subdivision_active_idx on public.subdivision_memberships (subdivision_id)
where released_at is null;
alter table public.subdivision_memberships enable row level security;
revoke all on table public.subdivision_memberships
from anon,
    authenticated,
    service_role;
grant select on table public.subdivision_memberships to authenticated;
create policy "participants read own membership and city leaders read city memberships" on public.subdivision_memberships for
select to authenticated using (
        participant_id = (
            select auth.uid()
        )
        or exists (
            select 1
            from public.profiles as profile
            where profile.id = (
                    select auth.uid()
                )
                and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and profile.role = 'lider_cidade'
        )
    );
create or replace function private.require_published_subdivision_membership() returns trigger language plpgsql security definer
set search_path = '' as $$
declare parent_status text;
participant_role text;
begin if new.released_at is not null then return new;
end if;
select region_set.status into parent_status
from public.subdivisions as subdivision
    join public.regions as region on region.id = subdivision.region_id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where subdivision.id = new.subdivision_id for share of region_set;
if parent_status is distinct
from 'published' then raise exception 'Memberships can only target a published subdivision.' using errcode = '23514';
end if;
select profile.role into participant_role
from public.profiles as profile
where profile.id = new.participant_id
    and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid;
if participant_role is distinct
from 'participante' then raise exception 'Only Maringá participants can hold active subdivision memberships.' using errcode = '23514';
end if;
new.updated_at := now();
return new;
end;
$$;
revoke all on function private.require_published_subdivision_membership()
from public,
    anon,
    authenticated;
create trigger require_published_subdivision_membership before
insert
    or
update of participant_id,
    subdivision_id,
    released_at on public.subdivision_memberships for each row execute function private.require_published_subdivision_membership();
create table private.subdivision_membership_realignments (
    id uuid primary key default gen_random_uuid(),
    membership_id uuid not null references public.subdivision_memberships (id),
    new_membership_id uuid not null references public.subdivision_memberships (id),
    from_subdivision_id uuid not null references public.subdivisions (id),
    to_subdivision_id uuid not null references public.subdivisions (id),
    from_region_set_id uuid not null references public.region_sets (id),
    to_region_set_id uuid not null references public.region_sets (id),
    changed_by uuid not null references public.profiles (id),
    changed_at timestamptz not null default now()
);
revoke all on table private.subdivision_membership_realignments
from public,
    anon,
    authenticated;
create or replace function private.publish_region_partition_with_realignment(
        p_region_set_id uuid,
        p_membership_reassignments jsonb
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_draft_status text;
v_existing_published_id uuid;
v_active_membership_count integer;
v_mapping_membership_ids uuid [] := array []::uuid [];
v_mapping_target_subdivision_ids uuid [] := array []::uuid [];
v_mapping_source_subdivision_ids uuid [] := array []::uuid [];
v_mapping_participant_ids uuid [] := array []::uuid [];
v_item record;
v_membership record;
v_membership_id uuid;
v_target_subdivision_id uuid;
v_participant_id uuid;
v_new_membership_id uuid;
v_publish_result jsonb;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can replace a published map.' using errcode = '42501';
end if;
if jsonb_typeof(p_membership_reassignments) is distinct
from 'array' then raise exception 'Membership realignments must be a JSON array.' using errcode = '23514';
end if;
if octet_length(p_membership_reassignments::text) > 1048576
or jsonb_array_length(p_membership_reassignments) > 10000 then raise exception 'Membership realignments must be an array of at most 10,000 rows and 1 MiB.' using errcode = '23514';
end if;
select region_set.city_id,
    region_set.status into v_city_id,
    v_draft_status
from public.region_sets as region_set
where region_set.id = p_region_set_id for
update;
if v_draft_status is distinct
from 'draft'
    or v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid then raise exception 'A Maringá draft region set is required.' using errcode = '23514';
end if;
select region_set.id into v_existing_published_id
from public.region_sets as region_set
where region_set.city_id = v_city_id
    and region_set.status = 'published' for
update;
if v_existing_published_id is null then if jsonb_array_length(p_membership_reassignments) <> 0 then raise exception 'No active map memberships require realignment.' using errcode = '23514';
end if;
else perform membership.id
from public.subdivision_memberships as membership
    join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
    join public.regions as region on region.id = subdivision.region_id
where region.region_set_id = v_existing_published_id
    and membership.released_at is null for
update of membership;
select count(*)::integer into v_active_membership_count
from public.subdivision_memberships as membership
    join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
    join public.regions as region on region.id = subdivision.region_id
where region.region_set_id = v_existing_published_id
    and membership.released_at is null;
if jsonb_array_length(p_membership_reassignments) <> v_active_membership_count then raise exception 'Every active membership on the published map must be realigned in this operation.' using errcode = '23514';
end if;
for v_item in
select item.value
from jsonb_array_elements(p_membership_reassignments) as item(value) loop if jsonb_typeof(v_item.value) is distinct
from 'object'
    or jsonb_typeof(v_item.value->'membershipId') is distinct
from 'string'
    or jsonb_typeof(v_item.value->'subdivisionId') is distinct
from 'string' then raise exception 'Each realignment must contain membershipId and subdivisionId UUIDs.' using errcode = '23514';
end if;
begin v_membership_id := (v_item.value->>'membershipId')::uuid;
v_target_subdivision_id := (v_item.value->>'subdivisionId')::uuid;
exception
when others then raise exception 'A membership realignment contains an invalid UUID.' using errcode = '22023';
end;
if v_membership_id = any(v_mapping_membership_ids) then raise exception 'Each active membership must be realigned exactly once.' using errcode = '23514';
end if;
select membership.id,
    membership.subdivision_id into v_membership
from public.subdivision_memberships as membership
    join public.subdivisions as old_subdivision on old_subdivision.id = membership.subdivision_id
    join public.regions as old_region on old_region.id = old_subdivision.region_id
where membership.id = v_membership_id
    and membership.released_at is null
    and old_region.region_set_id = v_existing_published_id;
if v_membership.id is null then raise exception 'The realignment list does not match active published memberships.' using errcode = '23514';
end if;
if not exists (
    select 1
    from public.subdivisions as target_subdivision
        join public.regions as target_region on target_region.id = target_subdivision.region_id
    where target_subdivision.id = v_target_subdivision_id
        and target_region.region_set_id = p_region_set_id
) then raise exception 'Every realignment destination must belong to the new draft.' using errcode = '23514';
end if;
v_mapping_membership_ids := array_append(v_mapping_membership_ids, v_membership_id);
v_mapping_target_subdivision_ids := array_append(
    v_mapping_target_subdivision_ids,
    v_target_subdivision_id
);
v_mapping_source_subdivision_ids := array_append(
    v_mapping_source_subdivision_ids,
    v_membership.subdivision_id
);
select membership.participant_id into v_participant_id
from public.subdivision_memberships as membership
where membership.id = v_membership_id;
v_mapping_participant_ids := array_append(v_mapping_participant_ids, v_participant_id);
end loop;
update public.region_sets
set status = 'archived',
    updated_at = now()
where id = v_existing_published_id;
end if;
v_publish_result := private.publish_region_partition(p_region_set_id);
if cardinality(v_mapping_membership_ids) > 0 then for v_item in 1..cardinality(v_mapping_membership_ids) loop
update public.subdivision_memberships
set released_at = now(),
    updated_at = now()
where id = v_mapping_membership_ids [v_item];
insert into public.subdivision_memberships (participant_id, subdivision_id)
values (
        v_mapping_participant_ids [v_item],
        v_mapping_target_subdivision_ids [v_item]
    )
returning id into v_new_membership_id;
insert into private.subdivision_membership_realignments (
        membership_id,
        new_membership_id,
        from_subdivision_id,
        to_subdivision_id,
        from_region_set_id,
        to_region_set_id,
        changed_by
    )
values (
        v_mapping_membership_ids [v_item],
        v_new_membership_id,
        v_mapping_source_subdivision_ids [v_item],
        v_mapping_target_subdivision_ids [v_item],
        v_existing_published_id,
        p_region_set_id,
        v_current_user_id
    );
end loop;
end if;
return v_publish_result || jsonb_build_object(
    'realignedMembershipCount',
    cardinality(v_mapping_membership_ids)
);
end;
$$;
revoke all on function private.publish_region_partition_with_realignment(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function private.publish_region_partition_with_realignment(uuid, jsonb) to authenticated;
create or replace function public.publish_region_partition(
        p_region_set_id uuid,
        p_membership_reassignments jsonb
    ) returns jsonb language sql security invoker
set search_path = '' as $$
select private.publish_region_partition_with_realignment(p_region_set_id, p_membership_reassignments);
$$;
revoke all on function public.publish_region_partition(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function public.publish_region_partition(uuid, jsonb) to authenticated;
create or replace function private.save_published_default_subdivision_edits(p_region_id uuid, p_subdivisions jsonb) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_region_set_id uuid;
v_published_at timestamptz;
v_edit_report jsonb;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can edit default subdivisions.' using errcode = '42501';
end if;
select region_set.id,
    region_set.published_at into v_region_set_id,
    v_published_at
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region.id = p_region_id
    and region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and region_set.status = 'published'
    and region_set.is_system_default for
update of region_set,
    region;
if v_region_set_id is null then raise exception 'Published default region was not found.' using errcode = 'P0002';
end if;
if exists (
    select 1
    from public.region_sets as region_set
    where region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and region_set.status = 'draft'
) then raise exception 'A region replacement draft must be resolved before editing default subdivisions.' using errcode = '23514';
end if;
if exists (
    select 1
    from public.subdivision_memberships as membership
        join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
    where subdivision.region_id = p_region_id
) then raise exception 'Default subdivisions cannot be edited after membership history exists.' using errcode = '23514';
end if;
update public.region_sets
set status = 'draft',
    published_at = null,
    updated_at = now()
where id = v_region_set_id;
v_edit_report := private.save_city_leader_subdivision_edits(p_region_id, p_subdivisions);
update public.region_sets
set status = 'published',
    published_at = v_published_at,
    updated_at = now()
where id = v_region_set_id;
return v_edit_report;
end;
$$;
revoke all on function private.save_published_default_subdivision_edits(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function private.save_published_default_subdivision_edits(uuid, jsonb) to authenticated;
create or replace function public.save_subdivision_edits(p_region_id uuid, p_subdivisions jsonb) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare v_status text;
v_is_system_default boolean;
begin
select region_set.status,
    region_set.is_system_default into v_status,
    v_is_system_default
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region.id = p_region_id;
if v_status = 'published'
and v_is_system_default then return private.save_published_default_subdivision_edits(p_region_id, p_subdivisions);
end if;
return private.save_city_leader_subdivision_edits(p_region_id, p_subdivisions);
end;
$$;
revoke all on function public.save_subdivision_edits(uuid, jsonb)
from public,
    anon,
    authenticated;
grant execute on function public.save_subdivision_edits(uuid, jsonb) to authenticated;
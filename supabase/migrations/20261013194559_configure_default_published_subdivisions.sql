create or replace function private.generate_published_default_subdivision_drafts(
        p_region_set_id uuid,
        p_region_number integer,
        p_target_count integer
    ) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_region_set_id uuid;
v_region_id uuid;
v_published_at timestamptz;
v_generation_report jsonb;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can configure default subdivisions.' using errcode = '42501';
end if;
select region_set.id,
    region_set.published_at into v_region_set_id,
    v_published_at
from public.region_sets as region_set
where region_set.id = p_region_set_id
    and region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and region_set.status = 'published'
    and region_set.is_system_default for
update;
if v_region_set_id is null then raise exception 'Published default region set was not found.' using errcode = 'P0002';
end if;
if exists (
    select 1
    from public.region_sets as region_set
    where region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and region_set.status = 'draft'
) then raise exception 'A region replacement draft must be resolved before configuring default subdivisions.' using errcode = '23514';
end if;
select region.id into v_region_id
from public.regions as region
where region.region_set_id = v_region_set_id
    and region.region_number = p_region_number for
update;
if v_region_id is null then raise exception 'Default region was not found.' using errcode = 'P0002';
end if;
if exists (
    select 1
    from public.subdivision_memberships as membership
        join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
    where subdivision.region_id = v_region_id
) then raise exception 'Default subdivisions cannot be changed after membership history exists.' using errcode = '23514';
end if;
update public.region_sets
set status = 'draft',
    published_at = null,
    updated_at = now()
where id = v_region_set_id;
v_generation_report := private.generate_subdivision_drafts(
    v_region_set_id,
    p_region_number,
    p_target_count
);
update public.region_sets
set status = 'published',
    published_at = v_published_at,
    updated_at = now()
where id = v_region_set_id;
return v_generation_report;
end;
$$;
revoke all on function private.generate_published_default_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
grant execute on function private.generate_published_default_subdivision_drafts(uuid, integer, integer) to authenticated;
create or replace function public.generate_subdivision_drafts(
        p_region_set_id uuid,
        p_region_number integer,
        p_target_count integer
    ) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare generation_report jsonb;
subdivision_payload jsonb;
v_region_id uuid;
v_status text;
v_is_system_default boolean;
begin
select region_set.status,
    region_set.is_system_default into v_status,
    v_is_system_default
from public.region_sets as region_set
where region_set.id = p_region_set_id;
if v_status = 'published'
and v_is_system_default then generation_report := private.generate_published_default_subdivision_drafts(
    p_region_set_id,
    p_region_number,
    p_target_count
);
else generation_report := private.generate_subdivision_drafts(
    p_region_set_id,
    p_region_number,
    p_target_count
);
end if;
v_region_id := (generation_report->>'regionId')::uuid;
select coalesce(
        jsonb_agg(
            item.value || jsonb_build_object('id', subdivision.id)
            order by subdivision.subdivision_number
        ),
        '[]'::jsonb
    ) into subdivision_payload
from jsonb_array_elements(generation_report->'subdivisions') as item(value)
    join public.subdivisions as subdivision on subdivision.region_id = v_region_id
    and subdivision.subdivision_number = (item.value->>'number')::integer;
return generation_report || jsonb_build_object('subdivisions', subdivision_payload);
end;
$$;
revoke all on function public.generate_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
grant execute on function public.generate_subdivision_drafts(uuid, integer, integer) to authenticated;
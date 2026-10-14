revoke all on function public.generate_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
revoke all on function private.generate_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
revoke all on function private.generate_published_default_subdivision_drafts(uuid, integer, integer)
from public,
    anon,
    authenticated;
revoke all on function private.generate_balanced_subdivisions(extensions.geometry, integer)
from public,
    anon,
    authenticated;
create or replace function private.clear_automatic_subdivisions() returns integer language plpgsql security definer
set search_path = '' as $$
declare v_city_id uuid;
v_region record;
v_matches integer;
v_removed integer;
begin
select city_id into v_city_id
from public.profiles
where id =(
        select auth.uid()
    )
    and role = 'lider_cidade';
if v_city_id is null then raise exception 'Only the city leader can remove automatic subdivisions.' using errcode = '42501';
end if;
perform region.id
from public.regions region
    join public.region_sets region_set on region_set.id = region.region_set_id
where region_set.city_id = v_city_id
order by region.id for
update of region;
for v_region in
select region.id,
    region.geom,
    (
        select count(*)::integer
        from public.subdivisions
        where region_id = region.id
            and origin <> 'manual'
    ) as total
from public.regions region
    join public.region_sets region_set on region_set.id = region.region_set_id
where region_set.city_id = v_city_id
    and exists(
        select 1
        from public.subdivisions
        where region_id = region.id
            and origin = 'unknown'
    ) loop begin
select count(*)::integer into v_matches
from private.generate_balanced_subdivisions(v_region.geom, v_region.total) generated
    join public.subdivisions subdivision on subdivision.region_id = v_region.id
    and subdivision.subdivision_number = generated.subdivision_number
    and subdivision.origin <> 'manual'
    and extensions.st_equals(subdivision.geom, generated.subdivision_geometry);
exception
when others then raise exception 'LEGACY_ORIGIN_UNKNOWN' using errcode = '23514';
end;
if v_matches <> v_region.total then raise exception 'LEGACY_ORIGIN_UNKNOWN' using errcode = '23514';
end if;
update public.subdivisions
set origin = 'automatic'
where region_id = v_region.id
    and origin = 'unknown';
end loop;
if exists(
    select 1
    from public.subdivision_memberships membership
        join public.subdivisions subdivision on subdivision.id = membership.subdivision_id
        join public.regions region on region.id = subdivision.region_id
        join public.region_sets region_set on region_set.id = region.region_set_id
    where region_set.city_id = v_city_id
        and subdivision.origin = 'automatic'
)
or exists(
    select 1
    from public.acts act
        join public.subdivisions subdivision on subdivision.id = act.subdivision_id
        join public.regions region on region.id = subdivision.region_id
        join public.region_sets region_set on region_set.id = region.region_set_id
    where region_set.city_id = v_city_id
        and subdivision.origin = 'automatic'
)
or exists(
    select 1
    from private.subdivision_membership_realignments history
        join public.subdivisions subdivision on subdivision.id in (
            history.from_subdivision_id,
            history.to_subdivision_id
        )
        join public.regions region on region.id = subdivision.region_id
        join public.region_sets region_set on region_set.id = region.region_set_id
    where region_set.city_id = v_city_id
        and subdivision.origin = 'automatic'
) then raise exception 'AUTOMATIC_AREA_REFERENCED' using errcode = '23514';
end if;
delete from public.subdivisions subdivision using public.regions region,
    public.region_sets region_set
where subdivision.region_id = region.id
    and region.region_set_id = region_set.id
    and region_set.city_id = v_city_id
    and subdivision.origin = 'automatic';
get diagnostics v_removed = row_count;
return v_removed;
end;
$$;
revoke all on function private.clear_automatic_subdivisions()
from public,
    anon,
    authenticated;
grant execute on function private.clear_automatic_subdivisions() to authenticated;
create or replace function public.clear_automatic_subdivisions() returns integer language sql security invoker
set search_path = '' as $$
select private.clear_automatic_subdivisions();
$$;
revoke all on function public.clear_automatic_subdivisions()
from public,
    anon,
    authenticated;
grant execute on function public.clear_automatic_subdivisions() to authenticated;
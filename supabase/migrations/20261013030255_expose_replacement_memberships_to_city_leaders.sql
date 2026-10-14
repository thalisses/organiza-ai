create or replace function public.get_visible_region_set() returns jsonb language plpgsql stable security invoker
set search_path = '' as $$
declare visible_set record;
region_payload jsonb;
published_region_set_id uuid;
begin
select region_set.id,
    region_set.city_id,
    region_set.status,
    region_set.target_region_count,
    region_set.published_at into visible_set
from public.region_sets as region_set
where region_set.status in ('draft', 'published')
order by case
        when region_set.status = 'draft' then 0
        else 1
    end
limit 1;
if not found then return null;
end if;
select region_set.id into published_region_set_id
from public.region_sets as region_set
where region_set.city_id = visible_set.city_id
    and region_set.status = 'published';
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                region.id,
                'number',
                region.region_number,
                'color',
                region.color,
                'geometry',
                extensions.st_asgeojson(region.geom, 15)::jsonb,
                'subdivisions',
                coalesce(
                    (
                        select jsonb_agg(
                                jsonb_build_object(
                                    'id',
                                    subdivision.id,
                                    'number',
                                    subdivision.subdivision_number,
                                    'geometry',
                                    extensions.st_asgeojson(subdivision.geom, 15)::jsonb
                                )
                                order by subdivision.subdivision_number
                            )
                        from public.subdivisions as subdivision
                        where subdivision.region_id = region.id
                    ),
                    '[]'::jsonb
                )
            )
            order by region.region_number
        ),
        '[]'::jsonb
    ) into region_payload
from public.regions as region
where region.region_set_id = visible_set.id;
return jsonb_build_object(
    'regionSetId',
    visible_set.id,
    'status',
    visible_set.status,
    'publishedAt',
    visible_set.published_at,
    'publishedRegionSetId',
    published_region_set_id,
    'targetRegionCount',
    visible_set.target_region_count,
    'regions',
    region_payload
);
end;
$$;
revoke all on function public.get_visible_region_set()
from public,
    anon;
grant execute on function public.get_visible_region_set() to authenticated;
create or replace function public.generate_subdivision_drafts(
        p_region_set_id uuid,
        p_region_number integer,
        p_target_count integer
    ) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare generation_report jsonb;
subdivision_payload jsonb;
v_region_id uuid;
begin generation_report := private.generate_subdivision_drafts(
    p_region_set_id,
    p_region_number,
    p_target_count
);
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
create or replace function public.get_active_subdivision_memberships() returns jsonb language plpgsql stable security invoker
set search_path = '' as $$
declare membership_payload jsonb;
begin if not exists (
    select 1
    from public.profiles as profile
    where profile.id = (
            select auth.uid()
        )
        and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
        and profile.role = 'lider_cidade'
) then raise exception 'Only the city leader can view active memberships for map replacement.' using errcode = '42501';
end if;
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                membership.id,
                'participantId',
                participant.id,
                'participantName',
                participant.name,
                'subdivisionId',
                subdivision.id,
                'regionNumber',
                region.region_number,
                'subdivisionNumber',
                subdivision.subdivision_number
            )
            order by participant.name,
                membership.id
        ),
        '[]'::jsonb
    ) into membership_payload
from public.subdivision_memberships as membership
    join public.profiles as participant on participant.id = membership.participant_id
    join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
    join public.regions as region on region.id = subdivision.region_id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where membership.released_at is null
    and region_set.status = 'published';
return membership_payload;
end;
$$;
revoke all on function public.get_active_subdivision_memberships()
from public,
    anon,
    authenticated;
grant execute on function public.get_active_subdivision_memberships() to authenticated;
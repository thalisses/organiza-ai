create or replace function private.get_act_attendees(p_act_id uuid) returns jsonb language plpgsql stable security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_act_city_id uuid;
v_act_subdivision_id uuid;
v_attendees jsonb;
begin if v_current_user_id is null then raise exception 'Authentication is required to view attendee rosters.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role not in ('lider_cidade', 'lider_setor') then raise exception 'Only Maringa leaders can view attendee rosters.' using errcode = '42501';
end if;
select act.city_id,
    act.subdivision_id into v_act_city_id,
    v_act_subdivision_id
from public.acts as act
where act.id = p_act_id;
if not found
or v_act_city_id <> v_city_id then raise exception 'Act was not found in Maringa.' using errcode = 'P0002';
end if;
if v_role = 'lider_setor'
and (
    v_act_subdivision_id is null
    or not exists (
        select 1
        from public.subdivisions as subdivision
            join public.sector_leader_regions as assignment on assignment.region_id = subdivision.region_id
        where subdivision.id = v_act_subdivision_id
            and assignment.sector_leader_id = v_current_user_id
    )
) then raise exception 'Sector leaders can view attendee rosters only for assigned regions.' using errcode = '42501';
end if;
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'registrationId',
                registration.id,
                'participantName',
                participant.name,
                'whatsappE164',
                participant.whatsapp_e164,
                'registeredAt',
                registration.registered_at
            )
            order by participant.name,
                registration.registered_at
        ),
        '[]'::jsonb
    ) into v_attendees
from public.act_registrations as registration
    join public.profiles as participant on participant.id = registration.participant_id
where registration.act_id = p_act_id
    and registration.cancelled_at is null;
return v_attendees;
end;
$$;
revoke all on function private.get_act_attendees(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.get_act_attendees(uuid) to authenticated;
create or replace function public.get_act_attendees(p_act_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.get_act_attendees(p_act_id);
$$;
revoke all on function public.get_act_attendees(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.get_act_attendees(uuid) to authenticated;
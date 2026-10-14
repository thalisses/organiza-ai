create table public.act_registrations (
    id uuid primary key default gen_random_uuid(),
    act_id uuid not null references public.acts (id) on delete restrict,
    participant_id uuid not null references public.profiles (id) on delete cascade,
    registered_at timestamptz not null default now(),
    cancelled_at timestamptz
);
create unique index act_registrations_one_active_per_act_participant_idx on public.act_registrations (act_id, participant_id)
where cancelled_at is null;
create index act_registrations_participant_idx on public.act_registrations (participant_id, registered_at desc);
alter table public.act_registrations enable row level security;
revoke all on table public.act_registrations
from anon,
    authenticated,
    service_role;
grant select on table public.act_registrations to authenticated;
create policy "participants read only their own act registrations" on public.act_registrations for
select to authenticated using (
        participant_id = (
            select auth.uid()
        )
    );
create or replace function private.register_for_act(p_act_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_act_city_id uuid;
v_act_status text;
v_act_starts_at timestamptz;
v_registration_id uuid;
begin if v_current_user_id is null then raise exception 'Authentication is required to register for an act.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role is distinct
from 'participante' then raise exception 'Only Maringa participants can register for acts.' using errcode = '42501';
end if;
select act.city_id,
    act.status,
    act.starts_at into v_act_city_id,
    v_act_status,
    v_act_starts_at
from public.acts as act
where act.id = p_act_id for share;
if not found
or v_act_city_id <> v_city_id then raise exception 'Act was not found in Maringa.' using errcode = 'P0002';
end if;
if v_act_status <> 'scheduled'
or v_act_starts_at <= now() then raise exception 'Registration is available only for upcoming scheduled acts.' using errcode = '23514';
end if;
select registration.id into v_registration_id
from public.act_registrations as registration
where registration.act_id = p_act_id
    and registration.participant_id = v_current_user_id
    and registration.cancelled_at is null for
update;
if found then return jsonb_build_object(
    'registrationId',
    v_registration_id,
    'actId',
    p_act_id,
    'status',
    'registered',
    'changed',
    false
);
end if;
insert into public.act_registrations (act_id, participant_id)
values (p_act_id, v_current_user_id) on conflict (act_id, participant_id)
where cancelled_at is null do nothing
returning id into v_registration_id;
if v_registration_id is null then
select registration.id into v_registration_id
from public.act_registrations as registration
where registration.act_id = p_act_id
    and registration.participant_id = v_current_user_id
    and registration.cancelled_at is null;
end if;
return jsonb_build_object(
    'registrationId',
    v_registration_id,
    'actId',
    p_act_id,
    'status',
    'registered',
    'changed',
    true
);
end;
$$;
revoke all on function private.register_for_act(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.register_for_act(uuid) to authenticated;
create or replace function public.register_for_act(p_act_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.register_for_act(p_act_id);
$$;
revoke all on function public.register_for_act(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.register_for_act(uuid) to authenticated;
create or replace function private.cancel_my_act_registration(p_act_id uuid) returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid;
v_role text;
v_registration_id uuid;
v_starts_at timestamptz;
begin if v_current_user_id is null then raise exception 'Authentication is required to cancel an act registration.' using errcode = '42501';
end if;
select profile.city_id,
    profile.role into v_city_id,
    v_role
from public.profiles as profile
where profile.id = v_current_user_id;
if v_city_id is distinct
from '41152000-0000-4000-8000-000000000001'::uuid
    or v_role is distinct
from 'participante' then raise exception 'Only Maringa participants can cancel their own act registrations.' using errcode = '42501';
end if;
select registration.id,
    act.starts_at into v_registration_id,
    v_starts_at
from public.act_registrations as registration
    join public.acts as act on act.id = registration.act_id
where registration.act_id = p_act_id
    and registration.participant_id = v_current_user_id
    and registration.cancelled_at is null for
update of registration,
    act;
if not found then raise exception 'Active registration was not found.' using errcode = 'P0002';
end if;
if v_starts_at <= now() then raise exception 'Registration can only be cancelled before the act starts.' using errcode = '23514';
end if;
update public.act_registrations
set cancelled_at = now()
where id = v_registration_id;
return jsonb_build_object(
    'registrationId',
    v_registration_id,
    'actId',
    p_act_id,
    'status',
    'cancelled'
);
end;
$$;
revoke all on function private.cancel_my_act_registration(uuid)
from public,
    anon,
    authenticated;
grant execute on function private.cancel_my_act_registration(uuid) to authenticated;
create or replace function public.cancel_my_act_registration(p_act_id uuid) returns jsonb language sql security invoker
set search_path = '' as $$
select private.cancel_my_act_registration(p_act_id);
$$;
revoke all on function public.cancel_my_act_registration(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.cancel_my_act_registration(uuid) to authenticated;
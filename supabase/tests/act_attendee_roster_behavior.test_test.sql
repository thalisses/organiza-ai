begin;
delete from public.act_registrations as registration using public.acts as act,
    public.subdivisions as subdivision,
    public.regions as region,
    public.region_sets as region_set
where registration.act_id = act.id
    and act.subdivision_id = subdivision.id
    and subdivision.region_id = region.id
    and region.region_set_id = region_set.id
    and region_set.is_system_default;
delete from public.acts as act using public.subdivisions as subdivision,
    public.regions as region,
    public.region_sets as region_set
where act.subdivision_id = subdivision.id
    and subdivision.region_id = region.id
    and region.region_set_id = region_set.id
    and region_set.is_system_default;
delete from private.subdivision_membership_realignments as realignment
where realignment.from_region_set_id in (
        select id
        from public.region_sets
        where is_system_default
    )
    or realignment.to_region_set_id in (
        select id
        from public.region_sets
        where is_system_default
    );
delete from public.subdivision_memberships as membership using public.subdivisions as subdivision,
    public.regions as region,
    public.region_sets as region_set
where membership.subdivision_id = subdivision.id
    and subdivision.region_id = region.id
    and region.region_set_id = region_set.id
    and region_set.is_system_default;
delete from public.region_sets
where is_system_default;
select plan(10);
insert into auth.users (id, email, raw_user_meta_data)
values (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        'act-roster-city@example.test',
        '{"name":"Roster City Leader","whatsapp_e164":"+5511999996801","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
        'act-roster-assigned@example.test',
        '{"name":"Roster Assigned Sector","whatsapp_e164":"+5511999996802","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
        'act-roster-unassigned@example.test',
        '{"name":"Roster Unassigned Sector","whatsapp_e164":"+5511999996803","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
        'act-roster-participant-one@example.test',
        '{"name":"Roster Participant One","whatsapp_e164":"+5511999996804","availability_windows":[{"day_of_week":4,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
        'act-roster-participant-two@example.test',
        '{"name":"Roster Participant Two","whatsapp_e164":"+5511999996805","availability_windows":[{"day_of_week":5,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.profiles
set role = 'lider_setor'
where id in (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'
    );
create temporary table roster_test_regions as
select generated.subdivision_number::smallint as region_number,
    generated.subdivision_geometry as geom
from (
        select extensions.st_unaryunion(extensions.st_collect(geom)) as geom
        from public.urban_perimeters
    ) as boundary
    cross join lateral private.generate_balanced_subdivisions(boundary.geom, 2) as generated;
insert into public.region_sets (
        id,
        city_id,
        status,
        target_region_count,
        created_by,
        published_at
    )
values (
        '99999999-9999-4999-8999-999999999991',
        '41152000-0000-4000-8000-000000000001'::uuid,
        'published',
        2,
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        now()
    );
insert into public.regions (region_set_id, region_number, color, geom)
select '99999999-9999-4999-8999-999999999991'::uuid,
    region.region_number,
    case
        when region.region_number = 1 then '#123456'
        else '#654321'
    end,
    region.geom
from roster_test_regions as region;
insert into public.subdivisions (region_id, subdivision_number, geom)
select region.id,
    1,
    region.geom
from public.regions as region
where region.region_set_id = '99999999-9999-4999-8999-999999999991'::uuid;
insert into public.sector_leader_regions (sector_leader_id, region_id, assigned_by)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    region.id,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
from public.regions as region
where region.region_set_id = '99999999-9999-4999-8999-999999999991'::uuid
    and region.region_number = 1;
create temporary table roster_test_point as
select extensions.st_pointonsurface(
        extensions.st_unaryunion(extensions.st_collect(geom))
    ) as geom
from public.urban_perimeters;
insert into public.acts (
        id,
        city_id,
        title,
        category,
        starts_at,
        meeting_point,
        meeting_address,
        subdivision_id,
        created_by,
        updated_by
    )
select act.id,
    '41152000-0000-4000-8000-000000000001'::uuid,
    act.title,
    'meeting',
    now() + interval '2 hours',
    point.geom,
    'Praça da Catedral',
    act.subdivision_id,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
from roster_test_point as point
    cross join (
        values (
                '12121212-1212-4212-8212-121212121201'::uuid,
                'City roster act',
                null::uuid
            ),
            (
                '12121212-1212-4212-8212-121212121202'::uuid,
                'Assigned region act',
                (
                    select subdivision.id
                    from public.subdivisions as subdivision
                        join public.regions as region on region.id = subdivision.region_id
                    where region.region_number = 1
                )
            ),
            (
                '12121212-1212-4212-8212-121212121203'::uuid,
                'Unassigned region act',
                (
                    select subdivision.id
                    from public.subdivisions as subdivision
                        join public.regions as region on region.id = subdivision.region_id
                    where region.region_number = 2
                )
            )
    ) as act(id, title, subdivision_id);
insert into public.act_registrations (act_id, participant_id)
values (
        '12121212-1212-4212-8212-121212121201',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'
    ),
    (
        '12121212-1212-4212-8212-121212121201',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'
    ),
    (
        '12121212-1212-4212-8212-121212121202',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'
    ),
    (
        '12121212-1212-4212-8212-121212121202',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'
    ),
    (
        '12121212-1212-4212-8212-121212121203',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select is(
        jsonb_array_length(
            public.get_act_attendees('12121212-1212-4212-8212-121212121201')
        ),
        2,
        'city leader can read every Maringa act roster'
    );
select ok(
        (
            select bool_and(
                    item.value ? 'participantName'
                    and item.value ? 'whatsappE164'
                )
            from jsonb_array_elements(
                    public.get_act_attendees('12121212-1212-4212-8212-121212121201')
                ) as item(value)
        ),
        'authorized roster contains participant name and normalized WhatsApp only'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select is(
        jsonb_array_length(
            public.get_act_attendees('12121212-1212-4212-8212-121212121202')
        ),
        2,
        'assigned sector leader can read the roster for an assigned subdivision act'
    );
select throws_ok(
        $$select public.get_act_attendees('12121212-1212-4212-8212-121212121201') $$,
        '42501',
        null,
        'assigned sector leader cannot read city-wide rosters'
    );
select throws_ok(
        $$select public.get_act_attendees('12121212-1212-4212-8212-121212121203') $$,
        '42501',
        null,
        'assigned sector leader cannot read another region roster'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';
select throws_ok(
        $$select public.get_act_attendees('12121212-1212-4212-8212-121212121202') $$,
        '42501',
        null,
        'unassigned sector leader cannot read an assigned region roster'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4';
select throws_ok(
        $$select public.get_act_attendees('12121212-1212-4212-8212-121212121202') $$,
        '42501',
        null,
        'participants cannot read any attendee roster'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'
        ),
        0::bigint,
        'participants cannot read registrations belonging to another person'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = auth.uid()
        ),
        3::bigint,
        'participants can read only their own registrations'
    );
select public.cancel_my_act_registration('12121212-1212-4212-8212-121212121202');
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select is(
        jsonb_array_length(
            public.get_act_attendees('12121212-1212-4212-8212-121212121202')
        ),
        1,
        'rosters include only active registrations after a participant cancels'
    );
select *
from finish();
rollback;
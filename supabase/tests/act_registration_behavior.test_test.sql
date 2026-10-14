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
select plan(25);
insert into auth.users (id, email, raw_user_meta_data)
values (
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'act-registration-city@example.test',
        '{"name":"Registration City Leader","whatsapp_e164":"+5511999996701","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
        'act-registration-one@example.test',
        '{"name":"Registration Participant One","whatsapp_e164":"+5511999996702","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
        'act-registration-two@example.test',
        '{"name":"Registration Participant Two","whatsapp_e164":"+5511999996703","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
create temporary table act_registration_boundary as
select extensions.st_multi(
        extensions.st_collectionextract(
            extensions.st_unaryunion(extensions.st_collect(geom)),
            3
        )
    ) as geom
from public.urban_perimeters;
create temporary table act_registration_point as
select extensions.st_pointonsurface(geom) as geom
from act_registration_boundary;
insert into public.region_sets (
        id,
        city_id,
        status,
        target_region_count,
        created_by,
        published_at
    )
values (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        '41152000-0000-4000-8000-000000000001'::uuid,
        'published',
        1,
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        now()
    );
insert into public.regions (region_set_id, region_number, color, geom)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
    1,
    '#123456',
    geom
from act_registration_boundary;
insert into public.subdivisions (region_id, subdivision_number, geom)
select region.id,
    1,
    region.geom
from public.regions as region
where region.region_set_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'City Act One',
    'meeting',
    now() + interval '2 hours',
    point.geom,
    'Praça da Catedral',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'scheduled'
from act_registration_point as point;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Subdivision Act',
    'training',
    now() + interval '3 hours',
    point.geom,
    'Rua A, 100',
    (
        select subdivision.id
        from public.subdivisions as subdivision
            join public.regions as region on region.id = subdivision.region_id
        where region.region_set_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid
    ),
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'scheduled'
from act_registration_point as point;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Other Participant Act',
    'public_rally',
    now() + interval '4 hours',
    point.geom,
    'Rua B, 200',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'scheduled'
from act_registration_point as point;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Cancelled Act',
    'meeting',
    now() + interval '2 days',
    point.geom,
    'Rua C, 300',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cancelled'
from act_registration_point as point;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd5',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Past Act',
    'meeting',
    now() - interval '1 minute',
    point.geom,
    'Rua D, 400',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'scheduled'
from act_registration_point as point;
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
        updated_by,
        status
    )
select 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6',
    '41152000-0000-4000-8000-000000000001'::uuid,
    'Upcoming Cancel Boundary Act',
    'meeting',
    now() + interval '5 hours',
    point.geom,
    'Rua E, 500',
    null,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'scheduled'
from act_registration_point as point;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'changed'
        )::boolean,
        true,
        'participant can register for a city-wide act'
    );
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'changed'
        )::boolean,
        false,
        'repeated registration for the same act is idempotent'
    );
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd2')->>'changed'
        )::boolean,
        true,
        'participant can register for a subdivision act outside any personal subdivision assignment'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = auth.uid()
        ),
        2::bigint,
        'participant can register for multiple acts'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
        ),
        0::bigint,
        'participant cannot read another participant registrations'
    );
select throws_ok(
        $$insert into public.act_registrations (act_id, participant_id)
        values (
                'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
                'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
            ) $$,
            '42501',
            null,
            'participant cannot bypass registration checks with direct insert'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'changed'
        )::boolean,
        true,
        'a second participant can register for an act without a capacity limit'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
                and cancelled_at is null
        ),
        2::bigint,
        'multiple participants can remain registered for the same act'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd3')->>'changed'
        )::boolean,
        true,
        'second participant can register for another act'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select throws_ok(
        $$select public.cancel_my_act_registration('dddddddd-dddd-4ddd-8ddd-ddddddddddd3') $$,
        'P0002',
        null,
        'participant cannot cancel another participants registration'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'
                and participant_id = auth.uid()
                and cancelled_at is null
        ),
        1::bigint,
        'failed cancellation leaves the other registration active'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select is(
        (
            public.cancel_my_act_registration('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'status'
        ),
        'cancelled',
        'participant can cancel their own registration before the act starts'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = auth.uid()
                and act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
                and cancelled_at is not null
        ),
        1::bigint,
        'cancelled registration remains in history'
    );
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'changed'
        )::boolean,
        true,
        'participant can register again after cancelling'
    );
select results_eq(
        $$select count(*)::text || ':' || count(*) filter (
            where cancelled_at is null
        )::text
        from public.act_registrations
        where participant_id = auth.uid()
            and act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' $$,
            array ['2:1']::text [],
            're-registration preserves one cancelled row and one active row'
    );
select throws_ok(
        $$select public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd4') $$,
        '23514',
        null,
        'participant cannot register for a cancelled act'
    );
select throws_ok(
        $$select public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd5') $$,
        '23514',
        null,
        'participant cannot register for an act that already started'
    );
select is(
        (
            public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd6')->>'changed'
        )::boolean,
        true,
        'participant can register for an upcoming act before its start'
    );
reset role;
update public.acts
set starts_at = now() - interval '1 minute'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6';
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select throws_ok(
        $$select public.cancel_my_act_registration('dddddddd-dddd-4ddd-8ddd-ddddddddddd6') $$,
        '23514',
        null,
        'participant cannot cancel an act registration after its start time'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where participant_id = auth.uid()
                and act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6'
                and cancelled_at is null
        ),
        1::bigint,
        'late cancellation leaves the active registration unchanged'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select throws_ok(
        $$select public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1') $$,
        '42501',
        null,
        'city leaders cannot use participant registration operations'
    );
set local request.jwt.claim.sub = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
select throws_ok(
        $$select public.register_for_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1') $$,
        '42501',
        null,
        'authenticated users without a participant profile cannot register'
    );
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select is(
        (
            public.cancel_act('dddddddd-dddd-4ddd-8ddd-ddddddddddd1')->>'status'
        ),
        'cancelled',
        'city leader can cancel an act with existing registrations'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
                and cancelled_at is null
        ),
        2::bigint,
        'cancelling the act does not delete existing participant registrations'
    );
select is(
        (
            select count(*)::bigint
            from public.act_registrations
            where act_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
        ),
        3::bigint,
        'act cancellation preserves both active registrations and prior registration history'
    );
reset role;
select *
from finish();
rollback;
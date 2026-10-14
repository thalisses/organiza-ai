begin;
select plan(15);
select has_function(
        'public',
        'set_my_region_memberships',
        array ['uuid[] '],
    ' participants can manage their map division memberships '
);
select has_function(
    ' public ',
    ' get_my_active_region_memberships ',
    array []::text [],
    ' participants can read their map division memberships '
);
select ok(
    has_function_privilege(
        ' authenticated ',
        ' public.set_my_region_memberships(uuid []) ',
        ' execute '
    )
    and not has_function_privilege(
        ' anon ',
        ' public.set_my_region_memberships(uuid []) ',
        ' execute '
    ),
    ' only authenticated users can manage map division memberships '
);

insert into auth.users (id, email, raw_user_meta_data)
values
    (
        ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1 ',
        ' region - membership - leader @example.test ',
        ' { "name" :"Region Membership Leader",
        "whatsapp_e164" :"+5511999996501",
        "availability_windows" :[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}] } '::jsonb
    ),
    (
        ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2 ',
        ' region - membership - participant @example.test ',
        ' { "name" :"Region Membership Participant",
        "whatsapp_e164" :"+5511999996502",
        "availability_windows" :[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}] } '::jsonb
    );
update public.profiles
set role = ' lider_cidade '
where id = ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1 ';

update public.region_sets
set status = ' archived '
where city_id = ' 41152000 -0000 -4000 -8000 -000000000001 '
    and status = ' published ';
insert into public.region_sets (
    id,
    city_id,
    status,
    target_region_count,
    created_by,
    published_at
)
values (
    ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10 ',
    ' 41152000 -0000 -4000 -8000 -000000000001 ',
    ' published ',
    2,
    ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1 ',
    now()
);
insert into public.regions (id, region_set_id, region_number, name, color, geom)
values
    (
        ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11 ',
        ' eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10 ',
        1,
        ' GT UEM ',
        ' #FFEA00',
        extensions.st_multi(
            extensions.st_geomfromtext(
                'POLYGON((-51.95 -23.42,-51.94 -23.42,-51.94 -23.41,-51.95 -23.41,-51.95 -23.42))',
                4326
            )
        )
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10',
        2,
        'GT Monções',
        '#7CB342',
        extensions.st_multi(
            extensions.st_geomfromtext(
                'POLYGON((-51.96 -23.42,-51.95 -23.42,-51.95 -23.41,-51.96 -23.41,-51.96 -23.42))',
                4326
            )
        )
    );
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select throws_ok(
        $$select public.set_my_region_memberships(
            array ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11']::uuid []
        ) $$,
        '42501',
        null,
        'city leaders cannot enroll themselves in map divisions'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select throws_ok(
        $$insert into public.region_memberships (participant_id, region_id)
        values (
                auth.uid(),
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'
            ) $$,
            '42501',
            null,
            'participants cannot bypass membership validation with direct inserts'
    );
select is(
        public.set_my_region_memberships(
            array [
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12'
    ]::uuid []
        ),
        jsonb_build_array(
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12'
        ),
        'participants can enroll in multiple divisions from the published map'
    );
select is(
        public.get_my_active_region_memberships(),
        jsonb_build_array(
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
            'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12'
        ),
        'participants can read all their active divisions'
    );
select is(
        (
            select count(*)::integer
            from public.region_memberships
            where participant_id = auth.uid()
                and released_at is null
        ),
        2,
        'multiple map divisions remain independently active'
    );
select throws_ok(
        $$select public.set_my_region_memberships(
            array ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99']::uuid []
        ) $$,
        '23514',
        null,
        'participants cannot enroll in divisions outside the published map'
    );
select is(
        public.set_my_region_memberships(
            array ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12']::uuid []
        ),
        jsonb_build_array('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12'),
        'participants can remove one division while keeping another'
    );
select is(
        (
            select count(*)::integer
            from public.region_memberships
            where participant_id = auth.uid()
                and released_at is not null
        ),
        1,
        'removed division memberships remain as history'
    );
select is(
        public.set_my_region_memberships(array []::uuid []),
        '[]'::jsonb,
        'participants can clear all map division memberships'
    );
select is(
        (
            select count(*)::integer
            from public.region_memberships
            where participant_id = auth.uid()
                and released_at is null
        ),
        0,
        'clearing leaves no active map division memberships'
    );
select public.set_my_region_memberships(
        array ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11']::uuid []
    );
reset role;
update public.region_sets
set status = 'archived'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10';
select is(
        (
            select count(*)::integer
            from public.region_memberships
            where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
                and released_at is null
        ),
        0,
        'archiving a map releases its active division memberships'
    );
select is(
        (
            select count(*)::integer
            from public.region_memberships
            where participant_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
                and released_at is not null
        ),
        3,
        'archiving preserves division enrollment history'
    );
select *
from finish();
rollback;
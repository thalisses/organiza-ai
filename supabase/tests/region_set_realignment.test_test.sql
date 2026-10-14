begin;
create function pg_temp.prepare_subdivision_fixture(p_set uuid, p_number integer, p_count integer) returns jsonb language sql security definer
set search_path = '' as $$
select public.generate_subdivision_drafts(p_set, p_number, p_count);
$$;
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
select plan(21);
select has_table(
        'public',
        'subdivision_memberships',
        'participants can be realigned during published-map replacement'
    );
select ok(
        to_regprocedure('public.publish_region_partition(uuid,jsonb)') is not null,
        'published map replacement accepts an explicit membership mapping'
    );
select ok(
        to_regclass(
            'public.subdivision_memberships_one_active_per_participant_idx'
        ) is not null,
        'a participant can hold only one active subdivision membership'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'realignment-city-leader@example.test',
        '{"name":"City Leader","whatsapp_e164":"+5511999996401","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
        'realignment-participant-one@example.test',
        '{"name":"Participant One","whatsapp_e164":"+5511999996402","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
        'realignment-participant-two@example.test',
        '{"name":"Participant Two","whatsapp_e164":"+5511999996403","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select ok(
        public.save_region_partition(
            jsonb_build_array(
                (
                    select extensions.st_asgeojson(
                            extensions.st_unaryunion(extensions.st_collect(geom)),
                            15
                        )::jsonb
                    from public.urban_perimeters
                )
            ),
            1,
            array ['#123456']::text []
        ) is not null,
        'city leader creates initial region draft'
    );
select pg_temp.prepare_subdivision_fixture(
        (
            select id
            from public.region_sets
            where status = 'draft'
        ),
        1,
        2
    );
select is(
        (
            public.publish_region_partition(
                (
                    select id
                    from public.region_sets
                    where status = 'draft'
                )
            )->>'status'
        ),
        'published',
        'city leader publishes initial map before memberships exist'
    );
reset role;
insert into public.subdivision_memberships (participant_id, subdivision_id)
values (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
        (
            select id
            from public.subdivisions
            where subdivision_number = 1
        )
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
        (
            select id
            from public.subdivisions
            where subdivision_number = 2
        )
    );
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select public.save_region_partition(
        jsonb_build_array(
            (
                select extensions.st_asgeojson(
                        extensions.st_unaryunion(extensions.st_collect(geom)),
                        15
                    )::jsonb
                from public.urban_perimeters
            )
        ),
        1,
        array ['#654321']::text []
    );
select pg_temp.prepare_subdivision_fixture(
        (
            select id
            from public.region_sets
            where status = 'draft'
        ),
        1,
        2
    );
select is(
        (
            public.get_visible_region_set()->>'publishedRegionSetId'
        )::uuid,
        (
            select id
            from public.region_sets
            where status = 'published'
        ),
        'a city leader can identify the active publication while a replacement draft is loaded'
    );
select is(
        jsonb_array_length(public.get_active_subdivision_memberships()),
        2,
        'city leader can load every active membership with current area labels'
    );
select throws_ok(
        $$select public.publish_region_partition(
            (
                select id
                from public.region_sets
                where status = 'draft'
            ),
            '[]'::jsonb
        ) $$,
        '23514',
        null,
        'replacement is blocked when active memberships are omitted'
    );
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where status = 'published'
        ),
        1::bigint,
        'incomplete realignment leaves the old map published'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivision_memberships
            where released_at is null
        ),
        2::bigint,
        'incomplete realignment leaves every active membership unchanged'
    );
select throws_ok(
        $$select public.publish_region_partition(
            (
                select id
                from public.region_sets
                where status = 'draft'
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'membershipId',
                    (
                        select id
                        from public.subdivision_memberships
                        where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'
                    ),
                    'subdivisionId',
                    (
                        select subdivision_id
                        from public.subdivision_memberships
                        where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'
                    )
                ),
                jsonb_build_object(
                    'membershipId',
                    (
                        select id
                        from public.subdivision_memberships
                        where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'
                    ),
                    'subdivisionId',
                    (
                        select subdivision_id
                        from public.subdivision_memberships
                        where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'
                    )
                )
            )
        ) $$,
        '23514',
        null,
        'replacement is blocked when a destination belongs to the old map'
    );
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where status = 'published'
        ),
        1::bigint,
        'an invalid destination leaves the old map published'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivision_memberships
            where released_at is null
        ),
        2::bigint,
        'an invalid destination leaves all memberships active and unchanged'
    );
select is(
        (
            public.publish_region_partition(
                (
                    select id
                    from public.region_sets
                    where status = 'draft'
                ),
                jsonb_build_array(
                    jsonb_build_object(
                        'membershipId',
                        (
                            select id
                            from public.subdivision_memberships
                            where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'
                        ),
                        'subdivisionId',
                        (
                            select subdivision.id
                            from public.subdivisions as subdivision
                                join public.regions as region on region.id = subdivision.region_id
                                join public.region_sets as region_set on region_set.id = region.region_set_id
                            where region_set.status = 'draft'
                                and subdivision.subdivision_number = 1
                        )
                    ),
                    jsonb_build_object(
                        'membershipId',
                        (
                            select id
                            from public.subdivision_memberships
                            where participant_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'
                        ),
                        'subdivisionId',
                        (
                            select subdivision.id
                            from public.subdivisions as subdivision
                                join public.regions as region on region.id = subdivision.region_id
                                join public.region_sets as region_set on region_set.id = region.region_set_id
                            where region_set.status = 'draft'
                                and subdivision.subdivision_number = 2
                        )
                    )
                )
            )->>'status'
        ),
        'published',
        'complete membership mapping atomically publishes the replacement map'
    );
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where status = 'published'
        ),
        1::bigint,
        'only the replacement map remains published'
    );
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where status = 'archived'
                and published_at is not null
        ),
        1::bigint,
        'previous publication is archived with its publication timestamp preserved'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivision_memberships as membership
                join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where membership.released_at is null
                and region_set.status = 'published'
        ),
        2::bigint,
        'all active memberships now target the replacement map'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivision_memberships
            where released_at is not null
        ),
        2::bigint,
        'old membership rows are released instead of overwritten'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from private.subdivision_membership_realignments
        ),
        2::bigint,
        'each reassignment is recorded in the audit table'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
select throws_ok(
        $$select public.get_active_subdivision_memberships() $$,
        '42501',
        null,
        'participants cannot enumerate memberships for map replacement'
    );
select results_eq(
        $$select count(*)::bigint
        from public.subdivision_memberships
        where participant_id = auth.uid()
            and released_at is null $$,
            array [1::bigint],
            'participants retain exactly one active membership after replacement'
    );
select *
from finish();
rollback;
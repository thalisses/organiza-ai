begin;
select plan(15);
select ok(
        to_regprocedure(
            'public.create_manual_subdivision(uuid,jsonb,uuid)'
        ) is not null,
        'a city leader can create one immediately available manual subdivision'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.create_manual_subdivision(uuid,jsonb,uuid)',
            'execute'
        ),
        'anonymous callers cannot create subdivisions'
    );
insert into auth.users(id, email, raw_user_meta_data)
values (
        'dededede-dede-4ede-8ede-dedededed001',
        'manual-leader@example.test',
        '{"name":"Manual Leader","whatsapp_e164":"+5511999998101","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    ),
    (
        'dededede-dede-4ede-8ede-dedededed002',
        'manual-participant@example.test',
        '{"name":"Manual Participant","whatsapp_e164":"+5511999998102","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    );
update public.profiles
set role = 'lider_cidade'
where id = 'dededede-dede-4ede-8ede-dedededed001';
update public.region_sets
set status = 'archived'
where status = 'published';
insert into public.region_sets(
        id,
        city_id,
        created_by,
        target_region_count,
        status,
        published_at
    )
values (
        'dededede-dede-4ede-8ede-dedededed003',
        '41152000-0000-4000-8000-000000000001',
        'dededede-dede-4ede-8ede-dedededed001',
        1,
        'published',
        now()
    );
insert into public.regions(id, region_set_id, region_number, color, geom)
values (
        'dededede-dede-4ede-8ede-dedededed004',
        'dededede-dede-4ede-8ede-dedededed003',
        1,
        '#FFEA00',
        extensions.st_multi(
            extensions.st_transform(
                extensions.st_geomfromtext(
                    'POLYGON((400000 7400000,400100 7400000,400100 7400100,400000 7400100,400000 7400000))',
                    31982
                ),
                4326
            )
        )
    );
create function pg_temp.manual_polygon(p_wkt text) returns jsonb language sql as $$
select extensions.st_asgeojson(
        extensions.st_transform(extensions.st_geomfromtext(p_wkt, 31982), 4326),
        15
    )::jsonb;
$$;
set local role authenticated;
set local request.jwt.claim.sub = 'dededede-dede-4ede-8ede-dedededed001';
create temporary table manual_first as
select public.create_manual_subdivision(
        'dededede-dede-4ede-8ede-dedededed004',
        pg_temp.manual_polygon(
            'POLYGON((400010 7400010,400060 7400010,400060 7400060,400010 7400060,400010 7400010))'
        ),
        'dededede-dede-4ede-8ede-dedededed010'
    ) as report;
select is(
        (
            select origin
            from public.subdivisions
            where id =(
                    select (report->>'id')::uuid
                    from manual_first
                )
        ),
        'manual',
        'origin is controlled by the server'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where region_id = 'dededede-dede-4ede-8ede-dedededed004'
        ),
        1,
        'the first area persists without waiting for a complete partition'
    );
select is(
        (
            public.create_manual_subdivision(
                'dededede-dede-4ede-8ede-dedededed004',
                pg_temp.manual_polygon(
                    'POLYGON((400010 7400010,400060 7400010,400060 7400060,400010 7400060,400010 7400010))'
                ),
                'dededede-dede-4ede-8ede-dedededed010'
            )->>'id'
        ),
(
            select report->>'id'
            from manual_first
        ),
        'retry returns the original ID'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where region_id = 'dededede-dede-4ede-8ede-dedededed004'
        ),
        1,
        'retry does not duplicate a subdivision'
    );
select throws_ok(
        $test$select public.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            pg_temp.manual_polygon(
                'POLYGON((400020 7400020,400070 7400020,400070 7400070,400020 7400070,400020 7400020))'
            ),
            'dededede-dede-4ede-8ede-dedededed010'
        ) $test$,
        '23514',
        'MANUAL_REQUEST_CONFLICT',
        'a reused key cannot change the original intent'
    );
select lives_ok(
        $test$select public.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            pg_temp.manual_polygon(
                'POLYGON((400020 7400020,400070 7400020,400070 7400070,400020 7400070,400020 7400020))'
            ),
            'dededede-dede-4ede-8ede-dedededed011'
        ) $test$,
        'a second overlapping area is accepted'
    );
create temporary table manual_clipped as
select public.create_manual_subdivision(
        'dededede-dede-4ede-8ede-dedededed004',
        pg_temp.manual_polygon(
            'POLYGON((400090 7400020,400120 7400020,400120 7400080,400090 7400080,400090 7400020))'
        ),
        'dededede-dede-4ede-8ede-dedededed012'
    ) as report;
select ok(
        (
            select abs((report->>'areaSquareMeters')::numeric -600) < 0.01
            from manual_clipped
        ),
        'the stored area is clipped to the selected region'
    );
select throws_ok(
        $test$select public.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            pg_temp.manual_polygon(
                'POLYGON((400110 7400020,400120 7400020,400120 7400080,400110 7400080,400110 7400020))'
            ),
            'dededede-dede-4ede-8ede-dedededed013'
        ) $test$,
        '23514',
        'MANUAL_GEOMETRY_INVALID',
        'empty clipping cannot create an area'
    );
select throws_ok(
        $test$select public.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            pg_temp.manual_polygon(
                'POLYGON((400010 7400010,400060 7400060,400010 7400060,400060 7400010,400010 7400010))'
            ),
            'dededede-dede-4ede-8ede-dedededed014'
        ) $test$,
        '23514',
        'MANUAL_GEOMETRY_INVALID',
        'self-intersections are rejected'
    );
set local request.jwt.claim.sub = 'dededede-dede-4ede-8ede-dedededed002';
select throws_ok(
        $test$select public.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            '{}',
            'dededede-dede-4ede-8ede-dedededed015'
        ) $test$,
        '42501',
        null,
        'participants cannot create subdivisions'
    );
select throws_ok(
        $test$select private.create_manual_subdivision(
            'dededede-dede-4ede-8ede-dedededed004',
            '{}',
            'dededede-dede-4ede-8ede-dedededed015'
        ) $test$,
        '42501',
        null,
        'the private entry point enforces the same authorization'
    );
select lives_ok(
        $test$select public.set_my_subdivision_membership(
            (
                select (report->>'id')::uuid
                from manual_first
            )
        ) $test$,
        'participants can enroll immediately without publishing'
    );
select is(
        (
            public.get_my_active_subdivision_membership()->>'subdivisionId'
        ),
(
            select report->>'id'
            from manual_first
        ),
        'enrollment uses the saved subdivision ID'
    );
select *
from finish();
rollback;
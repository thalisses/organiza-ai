begin;
select plan(16);
select ok(
        to_regprocedure(
            'public.validate_region_partition(jsonb,integer)'
        ) is not null,
        'city leaders have a server-side region partition validator'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.validate_region_partition(jsonb,integer)',
            'execute'
        ),
        'authenticated users can invoke the validator'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.validate_region_partition(jsonb,integer)',
            'execute'
        ),
        'anonymous users cannot invoke the validator'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        '77777777-7777-4777-8777-777777777777',
        'region-participant@example.test',
        '{"name":"Participante Região","whatsapp_e164":"+5511999977001","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        '88888888-8888-4888-8888-888888888888',
        'region-city-leader@example.test',
        '{"name":"Liderança Região","whatsapp_e164":"+5511999977002","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = '88888888-8888-4888-8888-888888888888';
set local role anon;
select throws_ok(
        $$select public.validate_region_partition('[]'::jsonb, 1) $$,
        '42501',
        null,
        'anonymous users are denied before geometry validation'
    );
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';
select throws_ok(
        $$select public.validate_region_partition('[]'::jsonb, 1) $$,
        '42501',
        null,
        'participants cannot validate or publish a region partition'
    );
set local request.jwt.claim.sub = '88888888-8888-4888-8888-888888888888';
select is(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            (
                                select extensions.st_asgeojson(
                                        extensions.st_unaryunion(extensions.st_collect(geom)),
                                        15
                                    )::jsonb
                                from public.urban_perimeters
                            )
                        ),
                        1
                    )->>'passesValidation'
                )::boolean
        ),
        true,
        'a city leader can validate the exact full urban boundary as one balanced region'
    );
select is(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            (
                                select extensions.st_asgeojson(
                                        extensions.st_unaryunion(extensions.st_collect(geom)),
                                        15
                                    )::jsonb
                                from public.urban_perimeters
                            )
                        ),
                        1
                    )->>'maximumDeviationPercent'
                )::numeric
        ),
        0::numeric,
        'a region matching the complete boundary has zero area deviation'
    );
select is(
        (
            select count(*)::bigint
            from public.urban_perimeters
        ),
        7::bigint,
        'the validation preview does not modify the official perimeter source'
    );
select is(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            extensions.st_asgeojson(
                                extensions.st_setsrid(
                                    extensions.st_makeenvelope(-50, -22, -49, -21),
                                    4326
                                )
                            )::jsonb
                        ),
                        1
                    )->>'allContained'
                )::boolean
        ),
        false,
        'a region outside all official urban perimeters fails containment'
    );
select is(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            (
                                select extensions.st_asgeojson(
                                        extensions.st_unaryunion(extensions.st_collect(geom)),
                                        15
                                    )::jsonb
                                from public.urban_perimeters
                            ),
                            (
                                select extensions.st_asgeojson(
                                        extensions.st_unaryunion(extensions.st_collect(geom)),
                                        15
                                    )::jsonb
                                from public.urban_perimeters
                            )
                        ),
                        2
                    )->>'hasOverlaps'
                )::boolean
        ),
        true,
        'duplicate full-boundary regions are rejected for overlap'
    );
select ok(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            extensions.st_asgeojson(
                                extensions.st_difference(
                                    urban.geom,
                                    extensions.st_transform(
                                        extensions.st_buffer(
                                            extensions.st_transform(extensions.st_pointonsurface(urban.geom), 31982),
                                            5
                                        ),
                                        4326
                                    )
                                ),
                                15
                            )::jsonb
                        ),
                        1
                    )->>'coverageDifferenceSquareMeters'
                )::numeric > 0.01
            from (
                    select extensions.st_unaryunion(extensions.st_collect(geom)) as geom
                    from public.urban_perimeters
                ) as urban
        ),
        'a gap inside an otherwise balanced region is reported in square meters'
    );
select throws_ok(
        $$select public.validate_region_partition(
            '[{"type":"Polygon","coordinates":[[[0,0],[2,2],[0,2],[2,0],[0,0]]]}]'::jsonb,
            1
        ) $$,
        '23514',
        null,
        'invalid self-intersecting GeoJSON is rejected'
    );
select is(
        (
            select (
                    public.validate_region_partition(
                        jsonb_build_array(
                            (
                                select extensions.st_asgeojson(
                                        extensions.st_unaryunion(extensions.st_collect(geom)),
                                        15
                                    )::jsonb
                                from public.urban_perimeters
                            )
                        ),
                        2
                    )->>'draftCountMatchesTarget'
                )::boolean
        ),
        false,
        'a region count mismatch fails the pre-publication check'
    );
select throws_ok(
        $$select public.validate_region_partition(
            (
                select jsonb_agg(
                        '{"type":"Polygon","coordinates":[[[-52,-23],[-51.999,-23],[-51.999,-22.999],[-52,-22.999],[-52,-23]]]} '::jsonb
                    )
                from generate_series(1, 51)
            ),
            50
        ) $$,
        '23514',
        null,
        'payloads with more than fifty region geometries are rejected'
    );
select throws_ok(
        $$select public.validate_region_partition(
            jsonb_build_array(
                jsonb_build_object('padding', repeat('x', 1048576))
            ),
            1
        ) $$,
        '23514',
        null,
        'payloads larger than one MiB are rejected before parsing'
    );
select throws_ok(
        $$select public.validate_region_partition(
            jsonb_build_array(
                (
                    select extensions.st_asgeojson(
                            extensions.st_transform(
                                extensions.st_buffer(
                                    extensions.st_transform(
                                        extensions.st_setsrid(extensions.st_point(-51.9, -23.4), 4326),
                                        31982
                                    ),
                                    10,
                                    2500
                                ),
                                4326
                            ),
                            15
                        )::jsonb
                )
            ),
            1
        ) $$,
        '23514',
        null,
        'regions larger than ten thousand vertices are rejected'
    );
select *
from finish();
rollback;
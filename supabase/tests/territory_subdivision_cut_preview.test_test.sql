begin;
select plan(25);
select ok(
        to_regprocedure(
            'public.preview_subdivision_cuts(uuid,text,jsonb)'
        ) is not null,
        'the server exposes a read-only cut preview'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.preview_subdivision_cuts(uuid,text,jsonb)',
            'execute'
        ),
        'anonymous callers cannot execute the preview'
    );
insert into auth.users(id, email, raw_user_meta_data)
values (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01',
        'cut-leader@example.test',
        '{"name":"Cut Leader","whatsapp_e164":"+5511999998001","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    ),
    (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02',
        'cut-sector@example.test',
        '{"name":"Cut Sector","whatsapp_e164":"+5511999998002","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    );
update public.profiles
set role = 'lider_cidade'
where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01';
update public.profiles
set role = 'lider_setor'
where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02';
update public.region_sets
set status = 'archived',
    published_at = null
where status = 'draft';
insert into public.region_sets(id, city_id, created_by, target_region_count)
values (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd03',
        '41152000-0000-4000-8000-000000000001',
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01',
        1
    );
insert into public.regions(id, region_set_id, region_number, color, geom)
values (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd03',
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
create function pg_temp.cut_line(p_wkt text) returns jsonb language sql as $$
select extensions.st_asgeojson(
        extensions.st_transform(extensions.st_geomfromtext(p_wkt, 31982), 4326),
        15
    )::jsonb;
$$;
set local role authenticated;
set local request.jwt.claim.sub = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01';
create temporary table cut_base as
select public.preview_subdivision_cuts(
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        null,
        '[]'
    ) as report;
select is(
        (
            select jsonb_array_length(report->'subdivisions')
            from cut_base
        ),
        1,
        'a region without subdivisions starts as one root area'
    );
create temporary table cut_preview as
select public.preview_subdivision_cuts(
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        report->>'baseToken',
        jsonb_build_array(
            jsonb_build_object(
                'targetRef',
                'root',
                'line',
                pg_temp.cut_line('LINESTRING(400030 7400000,400030 7400100)')
            )
        )
    ) as report
from cut_base;
select is(
        (
            select jsonb_array_length(report->'subdivisions')
            from cut_preview
        ),
        2,
        'a manual cut creates two canonical areas'
    );
select ok(
        (
            select (report->'subdivisions'->0->>'deviationPercent')::numeric > 15
            from cut_preview
        ),
        'manual previews allow unequal areas'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where region_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04'
        ),
        0,
        'the preview does not persist subdivisions'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            (
                select report->>'baseToken'
                from cut_base
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'targetRef',
                    'root',
                    'line',
                    pg_temp.cut_line(
                        'LINESTRING(400000 7400000,400100 7400100,400000 7400100,400100 7400000)'
                    )
                )
            )
        ) $test$,
        '23514',
        'CUT_INVALID',
        'self-crossing lines are rejected'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            (
                select report->>'baseToken'
                from cut_base
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'targetRef',
                    'root',
                    'line',
                    pg_temp.cut_line(
                        'LINESTRING(400000 7400050,400050 7400110,400100 7400050)'
                    )
                )
            )
        ) $test$,
        '23514',
        'CUT_OUTSIDE_TARGET',
        'a line leaving the target reports the specific reason'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            (
                select report->>'baseToken'
                from cut_base
            ),
            '[{"targetRef":"missing","line":{}}]'
        ) $test$,
        '23514',
        'CUT_TARGET_NOT_FOUND',
        'a foreign or missing target is rejected'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            'old-token',
            '[]'
        ) $test$,
        '40001',
        'DRAFT_CONFLICT',
        'a stale state token is rejected'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            null,
            '{}'
        ) $test$,
        '23514',
        'CUT_INVALID',
        'non-array cut input is rejected'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            null,
            '[{"targetRef":"root","line":{}}]'
        ) $test$,
        '40001',
        'DRAFT_CONFLICT',
        'cuts require a state token even when called directly'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            (
                select report->>'baseToken'
                from cut_base
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'targetRef',
                    'root',
                    'line',
                    pg_temp.cut_line('LINESTRING(400030 7400002,400030 7400098)')
                )
            )
        ) $test$,
        '23514',
        'CUT_ENDPOINTS_OFF_BOUNDARY',
        'endpoints beyond the cap report the specific reason'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            (
                select report->>'baseToken'
                from cut_base
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'targetRef',
                    'root',
                    'line',
                    pg_temp.cut_line('LINESTRING(400000 7400000,400100 7400000)')
                )
            )
        ) $test$,
        '23514',
        'CUT_FOLLOWS_BOUNDARY',
        'a line following the border reports the specific reason'
    );
select is(
        (
            select jsonb_array_length(
                    public.preview_subdivision_cuts(
                        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
                        report->>'baseToken',
                        jsonb_build_array(
                            jsonb_build_object(
                                'targetRef',
                                'root',
                                'line',
                                pg_temp.cut_line('LINESTRING(400030 7400000,400030 7400100)')
                            ),
                            jsonb_build_object(
                                'targetRef',
                                'root/1',
                                'line',
                                pg_temp.cut_line('LINESTRING(400000 7400050,400030 7400050)')
                            ),
                            jsonb_build_object(
                                'targetRef',
                                'root/2',
                                'line',
                                pg_temp.cut_line('LINESTRING(400030 7400050,400100 7400050)')
                            )
                        )
                    )->'subdivisions'
                )
            from cut_base
        ),
        4,
        'the server replays three successive cuts into four areas'
    );
reset role;
insert into public.subdivisions(id, region_id, subdivision_number, geom)
values (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd05',
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        1,
        extensions.st_multi(
            extensions.st_transform(
                extensions.st_geomfromtext(
                    'POLYGON((400000 7400000,400050 7400000,400050 7400100,400000 7400100,400000 7400000))',
                    31982
                ),
                4326
            )
        )
    ),
    (
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd06',
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        2,
        extensions.st_multi(
            extensions.st_transform(
                extensions.st_geomfromtext(
                    'POLYGON((400050 7400000,400100 7400000,400100 7400100,400050 7400100,400050 7400000))',
                    31982
                ),
                4326
            )
        )
    );
set local role authenticated;
create temporary table replacement_base as
select public.preview_subdivision_cuts('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04', null, '[]') as report;
create temporary table replacement_preview as
select public.preview_subdivision_cuts(
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        report->>'baseToken',
        jsonb_build_array(
            jsonb_build_object(
                'targetRef',
                'region',
                'line',
                pg_temp.cut_line('LINESTRING(400000 7400050,400100 7400050)')
            )
        )
    ) as report
from replacement_base;
select is(
        (
            select jsonb_array_length(report->'subdivisions')
            from replacement_preview
        ),
        2,
        'a region-wide cut replaces the automatic partition instead of adding to it'
    );
select ok(
        (
            select bool_and(value->>'ref' in ('region/1', 'region/2'))
            from replacement_preview,
                jsonb_array_elements(report->'subdivisions')
        ),
        'new areas come from the region contour even when the cut crosses automatic borders'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where region_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04'
        ),
        2,
        'replacing the partition in preview leaves the persisted subdivisions intact'
    );
set local request.jwt.claim.sub = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02';
set local request.jwt.claim.sub = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01';
create temporary table manual_area_preview as
select public.preview_subdivision_cuts(
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
        report->>'baseToken',
        jsonb_build_array(
            jsonb_build_object(
                'targetRef',
                'region',
                'mode',
                'area',
                'line',
                pg_temp.cut_line(
                    'LINESTRING(400020 7400020,400080 7400020,400080 7400080,400020 7400080)'
                )
            )
        )
    ) as report
from replacement_base;
select is(
        (
            select jsonb_array_length(report->'subdivisions')
            from manual_area_preview
        ),
        3,
        'a manual area may overlap existing subdivisions without removing them'
    );
select ok(
        (
            select extensions.st_covers(
                    region.geom,
                    extensions.st_setsrid(
                        extensions.st_geomfromgeojson((report->'subdivisions'->2->'geometry')::text),
                        4326
                    )
                )
            from manual_area_preview,
                public.regions region
            where region.id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04'
        ),
        'the manual area stays inside its selected region'
    );
create temporary table clipped_manual_preview as
select public.preview_subdivision_cuts(
        'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
(
            select report->>'baseToken'
            from replacement_base
        ),
        jsonb_build_array(
            jsonb_build_object(
                'targetRef',
                'region',
                'mode',
                'area',
                'line',
                pg_temp.cut_line(
                    'LINESTRING(400090 7400020,400120 7400020,400120 7400080,400090 7400080)'
                )
            )
        )
    ) as report;
select ok(
        (
            select abs(
                    (report->'subdivisions'->2->>'areaSquareMeters')::numeric -600
                ) < 0.01
            from clipped_manual_preview
        ),
        'manual selection outside the region is clipped to its contour'
    );
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
(
                select report->>'baseToken'
                from replacement_base
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'targetRef',
                    'region',
                    'mode',
                    'area',
                    'line',
                    pg_temp.cut_line(
                        'LINESTRING(400110 7400020,400120 7400020,400120 7400080,400110 7400080)'
                    )
                )
            )
        ) $test$,
        '23514',
        'CUT_INVALID',
        'an area entirely outside the selected region cannot create a subdivision'
    );
set local request.jwt.claim.sub = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02';
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            null,
            '[]'
        ) $test$,
        '42501',
        null,
        'sector leaders cannot preview administrative cuts'
    );
reset role;
update public.profiles
set role = 'participante'
where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02';
set local role authenticated;
select throws_ok(
        $test$select public.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            null,
            '[]'
        ) $test$,
        '42501',
        null,
        'participants cannot preview administrative cuts'
    );
select throws_ok(
        $test$select private.preview_subdivision_cuts(
            'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd04',
            null,
            '[]'
        ) $test$,
        '42501',
        null,
        'direct private calls cannot bypass profile authorization'
    );
select *
from finish();
rollback;
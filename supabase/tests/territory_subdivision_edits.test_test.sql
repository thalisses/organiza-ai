begin;
create function pg_temp.prepare_subdivision_fixture(p_set uuid, p_number integer, p_count integer) returns jsonb language sql security definer
set search_path = '' as $$
select public.generate_subdivision_drafts(p_set, p_number, p_count);
$$;
select plan(14);
select ok(
        to_regprocedure('public.save_subdivision_edits(uuid,jsonb)') is not null,
        'the server exposes a subdivision vertex-edit save function'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.save_subdivision_edits(uuid,jsonb)',
            'execute'
        ),
        'authenticated leaders can invoke the edit function'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.save_subdivision_edits(uuid,jsonb)',
            'execute'
        ),
        'anonymous users cannot edit subdivisions'
    );
select ok(
        not has_table_privilege('authenticated', 'public.subdivisions', 'update'),
        'authenticated users cannot bypass the vertex-edit validator with direct updates'
    );
select ok(
        not has_function_privilege(
            'authenticated',
            'private.save_subdivision_edits(uuid,jsonb)',
            'execute'
        ),
        'authenticated users cannot bypass city-leader authorization through the private function'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'edit-city-leader@example.test',
        '{"name":"Liderança Edição","whatsapp_e164":"+5511999996201","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        'edit-assigned-sector@example.test',
        '{"name":"Setor Atribuído","whatsapp_e164":"+5511999996202","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
        'edit-unassigned-sector@example.test',
        '{"name":"Setor Não Atribuído","whatsapp_e164":"+5511999996203","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
        'edit-participant@example.test',
        '{"name":"Participante Edição","whatsapp_e164":"+5511999996204","availability_windows":[{"day_of_week":4,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
update public.profiles
set role = 'lider_setor'
where id in (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
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
        'city leader creates a draft parent for subdivision editing'
    );
select pg_temp.prepare_subdivision_fixture(
        (
            select id
            from public.region_sets
            where status = 'draft'
                and created_by = auth.uid()
        ),
        1,
        2
    );
reset role;
create temporary table subdivision_edit_fixture as
select region.id as region_id,
    jsonb_agg(
        jsonb_build_object(
            'number',
            subdivision.subdivision_number,
            'geometry',
            extensions.st_asgeojson(subdivision.geom, 15)::jsonb
        )
        order by subdivision.subdivision_number
    ) as geometries
from public.regions as region
    join public.subdivisions as subdivision on subdivision.region_id = region.id
    join public.region_sets as region_set on region_set.id = region.region_set_id
where region_set.status = 'draft'
group by region.id;
grant select on subdivision_edit_fixture to authenticated;
create temporary table original_subdivision_ids as
select id,
    subdivision_number
from public.subdivisions
where region_id = (
        select region_id
        from subdivision_edit_fixture
    );
grant select on original_subdivision_ids to authenticated;
insert into public.sector_leader_regions (sector_leader_id, region_id, assigned_by)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    fixture.region_id,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
from subdivision_edit_fixture as fixture;
set local role anon;
select throws_ok(
        $$select public.save_subdivision_edits(
            '00000000-0000-4000-8000-000000000001',
            '[]'::jsonb
        ) $$,
        '42501',
        null,
        'anonymous users cannot save subdivision edits'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
select throws_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from subdivision_edit_fixture
            ),
            (
                select geometries
                from subdivision_edit_fixture
            )
        ) $$,
        '42501',
        null,
        'participants cannot save subdivision edits'
    );
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
select throws_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from subdivision_edit_fixture
            ),
            (
                select geometries
                from subdivision_edit_fixture
            )
        ) $$,
        '42501',
        null,
        'unassigned sector leaders cannot save subdivision edits'
    );
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
select throws_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from subdivision_edit_fixture
            ),
            (
                select geometries
                from subdivision_edit_fixture
            )
        ) $$,
        '42501',
        null,
        'assigned sector leaders cannot edit subdivisions'
    );
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
select is(
        (
            public.save_subdivision_edits(
                (
                    select region_id
                    from subdivision_edit_fixture
                ),
                (
                    select geometries
                    from subdivision_edit_fixture
                )
            )->>'subdivisionCount'
        )::integer,
        2,
        'city leaders can save parent-validated subdivision edits'
    );
reset role;
select results_eq(
        $$select subdivision.id::text
        from public.subdivisions as subdivision
        where subdivision.region_id = (
                select region_id
                from subdivision_edit_fixture
            )
        order by subdivision.subdivision_number $$,
            $$select id::text
        from original_subdivision_ids
        order by subdivision_number $$,
            'saving edits preserves subdivision IDs'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
select throws_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from subdivision_edit_fixture
            ),
            (
                select jsonb_agg(
                        jsonb_build_object(
                            'number',
                            subdivision.subdivision_number,
                            'geometry',
                            extensions.st_asgeojson(
                                extensions.st_transform(
                                    extensions.st_translate(
                                        extensions.st_transform(subdivision.geom, 31982),
                                        100000,
                                        0
                                    ),
                                    4326
                                ),
                                15
                            )::jsonb
                        )
                        order by subdivision.subdivision_number
                    )
                from public.subdivisions as subdivision
                where subdivision.region_id = (
                        select region_id
                        from subdivision_edit_fixture
                    )
            )
        ) $$,
        '23514',
        null,
        'edited vertices outside the parent region are rejected'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions
            where region_id = (
                    select region_id
                    from subdivision_edit_fixture
                )
        ),
        2::bigint,
        'a rejected vertex edit leaves the previous subdivision set intact'
    );
select *
from finish();
rollback;
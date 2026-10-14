begin;
create function pg_temp.prepare_subdivision_fixture(p_set uuid, p_number integer, p_count integer) returns jsonb language sql security definer
set search_path = '' as $$
select public.generate_subdivision_drafts(p_set, p_number, p_count);
$$;
select plan(15);
select ok(
        to_regprocedure(
            'public.generate_subdivision_drafts(uuid,integer,integer)'
        ) is not null,
        'city leaders can generate subdivision drafts within a saved region'
    );
select ok(
        not has_function_privilege(
            'authenticated',
            'public.generate_subdivision_drafts(uuid,integer,integer)',
            'execute'
        ),
        'authenticated users cannot invoke the retired generator'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.generate_subdivision_drafts(uuid,integer,integer)',
            'execute'
        ),
        'anonymous users cannot invoke the generator'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        '99999999-9999-4999-8999-999999999981',
        'subdivision-participant@example.test',
        '{"name":"Participante Subdivisão","whatsapp_e164":"+5511999996981","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        '99999999-9999-4999-8999-999999999982',
        'subdivision-city-leader@example.test',
        '{"name":"Liderança Subdivisão","whatsapp_e164":"+5511999996982","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = '99999999-9999-4999-8999-999999999982';
set local role anon;
select throws_ok(
        $$select public.generate_subdivision_drafts('00000000-0000-4000-8000-000000000001', 1, 5) $$,
        '42501',
        null,
        'anonymous users are denied'
    );
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999981';
select throws_ok(
        $$select public.generate_subdivision_drafts('00000000-0000-4000-8000-000000000001', 1, 5) $$,
        '42501',
        null,
        'participants cannot generate subdivisions'
    );
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999982';
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
        'city leader saves the parent region draft before generating children'
    );
create temporary table test_parent as
select region_set.id as region_set_id,
    region.id as region_id,
    region.geom
from public.region_sets as region_set
    join public.regions as region on region.region_set_id = region_set.id
where region_set.status = 'draft'
    and region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and region.region_number = 1;
select is(
        (
            pg_temp.prepare_subdivision_fixture(
                (
                    select region_set_id
                    from test_parent
                ),
                1,
                5
            )->>'targetSubdivisionCount'
        )::integer,
        5,
        'the generator returns the requested target count'
    );
select ok(
        (
            select bool_and(item.value ? 'id')
            from jsonb_array_elements(
                    pg_temp.prepare_subdivision_fixture(
                        (
                            select region_set_id
                            from test_parent
                        ),
                        1,
                        5
                    )->'subdivisions'
                ) as item(value)
        ),
        'the generator returns stable subdivision IDs for membership realignment'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions
            where region_id = (
                    select region_id
                    from test_parent
                )
        ),
        5::bigint,
        'five generated subdivisions are persisted'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions as subdivision
            where subdivision.region_id = (
                    select region_id
                    from test_parent
                )
                and (
                    not extensions.st_isvalid(subdivision.geom)
                    or extensions.st_srid(subdivision.geom) <> 4326
                )
        ),
        0::bigint,
        'all generated subdivisions are valid WGS84 geometries'
    );
select ok(
        (
            select max(
                    abs(
                        extensions.st_area(extensions.st_transform(subdivision.geom, 31982)) / (
                            extensions.st_area(extensions.st_transform(parent.geom, 31982)) / 5
                        ) - 1
                    )
                ) * 100 <= 15
            from public.subdivisions as subdivision
                cross join test_parent as parent
            where subdivision.region_id = parent.region_id
        ),
        'each generated subdivision remains within plus or minus fifteen percent of its parent mean'
    );
select ok(
        (
            select bool_and(
                    extensions.st_area(
                        extensions.st_difference(
                            extensions.st_transform(subdivision.geom, 31982),
                            extensions.st_transform(parent.geom, 31982)
                        )
                    ) <= 0.01
                )
            from public.subdivisions as subdivision
                cross join test_parent as parent
            where subdivision.region_id = parent.region_id
        ),
        'all generated subdivisions remain inside their parent region'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions as first_child
                join public.subdivisions as second_child on first_child.region_id = second_child.region_id
                and first_child.subdivision_number < second_child.subdivision_number
            where first_child.region_id = (
                    select region_id
                    from test_parent
                )
                and extensions.st_area(
                    extensions.st_intersection(
                        extensions.st_transform(first_child.geom, 31982),
                        extensions.st_transform(second_child.geom, 31982)
                    )
                ) > 0.01
        ),
        0::bigint,
        'generated subdivisions do not overlap by area'
    );
select is(
        (
            select extensions.st_area(
                    extensions.st_symdifference(
                        extensions.st_transform(parent.geom, 31982),
                        extensions.st_unaryunion(
                            extensions.st_collect(extensions.st_transform(subdivision.geom, 31982))
                        )
                    )
                )
            from public.subdivisions as subdivision
                cross join test_parent as parent
            where subdivision.region_id = parent.region_id
            group by parent.geom
        ),
        0::double precision,
        'generated subdivisions cover the complete parent geometry'
    );
reset role;
create temporary table original_subdivision_ids as
select id,
    subdivision_number
from public.subdivisions
where region_id = (
        select region_id
        from test_parent
    );
grant select on original_subdivision_ids to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999982';
select pg_temp.prepare_subdivision_fixture(
        (
            select region_set_id
            from test_parent
        ),
        1,
        5
    );
select results_eq(
        $$select count(*)::bigint
        from original_subdivision_ids as original
        where not exists (
                select 1
                from public.subdivisions as current
                where current.id = original.id
                    and current.subdivision_number = original.subdivision_number
            ) $$,
            array [0::bigint],
            'regenerating subdivisions preserves IDs by subdivision number'
    );
select *
from finish();
rollback;
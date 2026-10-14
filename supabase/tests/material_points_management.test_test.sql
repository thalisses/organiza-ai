begin;
select plan(23);
select has_table(
        'public',
        'material_points',
        'material points are persisted independently of territories'
    );
select has_table(
        'public',
        'pickup_windows',
        'material pickup windows are persisted'
    );
select ok(
        to_regprocedure(
            'public.save_material_point(uuid,text,text,text,text,double precision,double precision,jsonb)'
        ) is not null,
        'leaders can save or update a material point'
    );
select ok(
        to_regprocedure('public.delete_material_point(uuid)') is not null,
        'leaders can delete a material point and its windows'
    );
select ok(
        to_regprocedure('public.list_material_points()') is not null,
        'authenticated users can read material points and windows'
    );
select ok(
        (
            select relrowsecurity
            from pg_class
            where oid = to_regclass('public.material_points')
        ),
        'material points have RLS enabled'
    );
select ok(
        (
            select relrowsecurity
            from pg_class
            where oid = to_regclass('public.pickup_windows')
        ),
        'pickup windows have RLS enabled'
    );
select ok(
        has_table_privilege(
            'authenticated',
            'public.material_points',
            'select'
        )
        and not has_table_privilege(
            'authenticated',
            'public.material_points',
            'insert'
        )
        and not has_table_privilege(
            'authenticated',
            'public.material_points',
            'update'
        )
        and not has_table_privilege(
            'authenticated',
            'public.material_points',
            'delete'
        )
        and has_table_privilege(
            'authenticated',
            'public.pickup_windows',
            'select'
        )
        and not has_table_privilege(
            'authenticated',
            'public.pickup_windows',
            'insert'
        ),
        'clients read points/windows but write only through validated RPCs'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.save_material_point(uuid,text,text,text,text,double precision,double precision,jsonb)',
            'execute'
        )
        and not has_function_privilege(
            'anon',
            'public.save_material_point(uuid,text,text,text,text,double precision,double precision,jsonb)',
            'execute'
        ),
        'material point writes are limited to authenticated requests'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'material-city-leader@example.test',
        '{"name":"Material City Leader","whatsapp_e164":"+5511999996901","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
        'material-sector-leader@example.test',
        '{"name":"Material Sector Leader","whatsapp_e164":"+5511999996902","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
        'material-participant@example.test',
        '{"name":"Material Participant","whatsapp_e164":"+5511999996903","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
update public.profiles
set role = 'lider_setor'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
create temporary table material_point_test_location as
select extensions.st_pointonsurface(
        extensions.st_unaryunion(extensions.st_collect(geom))
    ) as geom
from public.urban_perimeters;
grant select on material_point_test_location to authenticated;
create temporary table material_point_test_ids (label text primary key, id uuid not null);
grant select,
    insert on material_point_test_ids to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
insert into material_point_test_ids (label, id)
select 'city-point',
    (
        public.save_material_point(
            null,
            'Ponto Central',
            'Panfletos',
            'Mobilização territorial',
            'Praça da Catedral, s/n',
            extensions.st_x(location.geom),
            extensions.st_y(location.geom),
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    1,
                    'startsAt',
                    '09:00',
                    'endsAt',
                    '11:00'
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    1,
                    'startsAt',
                    '14:00',
                    'endsAt',
                    '16:00'
                )
            )
        )->>'id'
    )::uuid
from material_point_test_location as location;
select is(
        (
            select count(*)::bigint
            from public.pickup_windows
            where material_point_id = (
                    select id
                    from material_point_test_ids
                    where label = 'city-point'
                )
        ),
        2::bigint,
        'city leader can create multiple non-overlapping windows on the same weekday'
    );
select throws_ok(
        $$select public.save_material_point(
            null,
            'Ponto Sobreposto',
            'Cartazes',
            'Ato',
            'Rua A, 10',
            (
                select extensions.st_x(geom)
                from material_point_test_location
            ),
            (
                select extensions.st_y(geom)
                from material_point_test_location
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    2,
                    'startsAt',
                    '09:00',
                    'endsAt',
                    '11:00'
                ),
                jsonb_build_object(
                    'dayOfWeek',
                    2,
                    'startsAt',
                    '10:30',
                    'endsAt',
                    '12:00'
                )
            )
        ) $$,
        '23514',
        null,
        'overlapping pickup windows are rejected'
    );
select throws_ok(
        $$select public.save_material_point(
            null,
            'Ponto Fora',
            'Cartazes',
            'Ato',
            'Origem inválida',
            0,
            0,
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    1,
                    'startsAt',
                    '09:00',
                    'endsAt',
                    '10:00'
                )
            )
        ) $$,
        '23514',
        null,
        'material point outside the official urban perimeter is rejected'
    );
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
insert into material_point_test_ids (label, id)
select 'sector-point',
    (
        public.save_material_point(
            null,
            'Ponto Setor',
            'Lambe-lambe',
            'Mobilização',
            'Rua B, 20',
            extensions.st_x(location.geom),
            extensions.st_y(location.geom),
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    3,
                    'startsAt',
                    '18:00',
                    'endsAt',
                    '20:00'
                )
            )
        )->>'id'
    )::uuid
from material_point_test_location as location;
select is(
        (
            select count(*)::bigint
            from public.material_points
        ),
        2::bigint,
        'sector leaders can manage points independently of their region assignments'
    );
select is(
        (
            public.save_material_point(
                (
                    select id
                    from material_point_test_ids
                    where label = 'city-point'
                ),
                'Ponto Central Atualizado',
                'Panfletos',
                'Mobilização de bairro',
                'Praça da Catedral, lado sul',
                (
                    select extensions.st_x(geom)
                    from material_point_test_location
                ),
                (
                    select extensions.st_y(geom)
                    from material_point_test_location
                ),
                jsonb_build_array(
                    jsonb_build_object(
                        'dayOfWeek',
                        1,
                        'startsAt',
                        '10:00',
                        'endsAt',
                        '12:00'
                    )
                )
            )->>'id'
        )::uuid,
        (
            select id
            from material_point_test_ids
            where label = 'city-point'
        ),
        'sector leader can edit any point regardless of region assignment'
    );
select is(
        (
            select material_type
            from public.material_points
            where id = (
                    select id
                    from material_point_test_ids
                    where label = 'city-point'
                )
        ),
        'Panfletos',
        'editing updates free-text material details'
    );
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3';
select is(
        jsonb_array_length(public.list_material_points()),
        2,
        'participants can read material points and their windows'
    );
select throws_ok(
        $$select public.save_material_point(
            null,
            'Ponto Participante',
            'Cartazes',
            'Ato',
            'Rua C, 30',
            (
                select extensions.st_x(geom)
                from material_point_test_location
            ),
            (
                select extensions.st_y(geom)
                from material_point_test_location
            ),
            jsonb_build_array(
                jsonb_build_object(
                    'dayOfWeek',
                    4,
                    'startsAt',
                    '09:00',
                    'endsAt',
                    '10:00'
                )
            )
        ) $$,
        '42501',
        null,
        'participants cannot create material points'
    );
select throws_ok(
        $$select public.delete_material_point(
            (
                select id
                from material_point_test_ids
                where label = 'city-point'
            )
        ) $$,
        '42501',
        null,
        'participants cannot delete material points'
    );
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select is(
        (
            public.delete_material_point(
                (
                    select id
                    from material_point_test_ids
                    where label = 'city-point'
                )
            )->>'deleted'
        )::boolean,
        true,
        'city leader can delete a material point'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.pickup_windows
            where material_point_id = (
                    select id
                    from material_point_test_ids
                    where label = 'city-point'
                )
        ),
        0::bigint,
        'deleting a material point cascades to all pickup windows'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
select is(
        (
            public.delete_material_point(
                (
                    select id
                    from material_point_test_ids
                    where label = 'sector-point'
                )
            )->>'deleted'
        )::boolean,
        true,
        'sector leader can delete material points'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.material_points
        ),
        0::bigint,
        'city and sector leaders can remove points without territory assignments'
    );
set local role anon;
select throws_ok(
        $$select public.list_material_points() $$,
        '42501',
        null,
        'anonymous users cannot read material points'
    );
reset role;
select *
from finish();
rollback;
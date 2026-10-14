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
select plan(34);
select ok(
        to_regclass('public.acts') is not null,
        'acts are persisted in the database'
    );
select ok(
        to_regprocedure(
            'public.save_act(uuid,text,text,text,timestamptz,double precision,double precision,text,uuid)'
        ) is not null,
        'act leaders can create or update through a validated database function'
    );
select ok(
        to_regprocedure('public.cancel_act(uuid)') is not null,
        'act leaders can cancel without deleting the act'
    );
select ok(
        to_regprocedure('public.list_manageable_act_subdivisions()') is not null,
        'act editors can load only subdivision scopes they are allowed to manage'
    );
select ok(
        to_regprocedure('public.list_acts()') is not null,
        'authenticated users can read the public Maringa act agenda'
    );
select ok(
        (
            select relrowsecurity
            from pg_class
            where oid = to_regclass('public.acts')
        ),
        'act rows are protected by RLS'
    );
select ok(
        has_table_privilege('authenticated', 'public.acts', 'select')
        and not has_table_privilege('authenticated', 'public.acts', 'insert')
        and not has_table_privilege('authenticated', 'public.acts', 'update')
        and not has_table_privilege('authenticated', 'public.acts', 'delete'),
        'authenticated users can read acts but must use management RPCs to write'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.save_act(uuid,text,text,text,timestamptz,double precision,double precision,text,uuid)',
            'execute'
        )
        and not has_function_privilege(
            'anon',
            'public.save_act(uuid,text,text,text,timestamptz,double precision,double precision,text,uuid)',
            'execute'
        )
        and has_function_privilege(
            'authenticated',
            'public.cancel_act(uuid)',
            'execute'
        )
        and not has_function_privilege('anon', 'public.cancel_act(uuid)', 'execute'),
        'act management RPCs are available only to authenticated requests'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'act-city-leader@example.test',
        '{"name":"Act City Leader","whatsapp_e164":"+5511999996601","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        'act-assigned-sector@example.test',
        '{"name":"Act Assigned Sector","whatsapp_e164":"+5511999996602","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
        'act-unassigned-sector@example.test',
        '{"name":"Act Unassigned Sector","whatsapp_e164":"+5511999996603","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        'act-participant@example.test',
        '{"name":"Act Participant","whatsapp_e164":"+5511999996604","availability_windows":[{"day_of_week":4,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
update public.profiles
set role = 'lider_setor'
where id in (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
    );
create temporary table act_test_regions as
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
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        '41152000-0000-4000-8000-000000000001'::uuid,
        'published',
        2,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        now()
    );
insert into public.regions (region_set_id, region_number, color, geom)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
    region.region_number,
    case
        when region.region_number = 1 then '#123456'
        else '#654321'
    end,
    region.geom
from act_test_regions as region;
insert into public.subdivisions (region_id, subdivision_number, geom)
select region.id,
    1,
    region.geom
from public.regions as region
where region.region_set_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid;
insert into public.sector_leader_regions (sector_leader_id, region_id, assigned_by)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    region.id,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
from public.regions as region
where region.region_set_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid
    and region.region_number = 1;
create temporary table act_test_rows (label text primary key, id uuid not null);
grant select,
    insert on act_test_rows to authenticated;
create temporary table act_test_location as
select extensions.st_x(point.geom) as longitude,
    extensions.st_y(point.geom) as latitude
from (
        select extensions.st_pointonsurface(
                extensions.st_unaryunion(extensions.st_collect(geom))
            ) as geom
        from public.urban_perimeters
    ) as point;
grant select on act_test_location to authenticated;
set local role anon;
select throws_ok(
        $$select *
        from public.acts $$,
            '42501',
            null,
            'anonymous users cannot read acts'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
select throws_ok(
        $$select public.save_act(
            null,
            'Orphan Profile Act',
            'meeting',
            null,
            '2026-10-20 18:00:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Praça da Catedral',
            null
        ) $$,
        '42501',
        null,
        'authenticated users without a city profile cannot manage acts'
    );
select throws_ok(
        $$select public.list_manageable_act_subdivisions() $$,
        '42501',
        null,
        'authenticated users without a city profile cannot enumerate act scopes'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select throws_ok(
        $$select public.save_act(
            null,
            'Outside Meeting',
            'meeting',
            null,
            '2026-10-19 10:00:00-03',
            0,
            0,
            'Fora da cidade',
            null
        ) $$,
        '23514',
        null,
        'city leaders cannot publish a meeting point outside the urban perimeter'
    );
select throws_ok(
        $$select public.save_act(
            null,
            'Other Without Detail',
            'other',
            null,
            '2026-10-19 11:00:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Centro',
            null
        ) $$,
        '23514',
        null,
        'other category requires its short detail'
    );
insert into act_test_rows (label, id)
select 'city',
    (
        public.save_act(
            null,
            'City-wide Rally',
            'public_rally',
            null,
            '2026-10-20 18:00:00-03',
            location.longitude,
            location.latitude,
            'Praça da Catedral',
            null
        )->>'id'
    )::uuid
from act_test_location as location;
select is(
        (
            select act.scope_type
            from public.acts as act
                join act_test_rows as saved on saved.id = act.id
            where saved.label = 'city'
        ),
        'city',
        'city leader can create a city-wide act'
    );
set local request.jwt.claim.sub = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
select throws_ok(
        $$select public.cancel_act(
            (
                select id
                from act_test_rows
                where label = 'city'
            )
        ) $$,
        '42501',
        null,
        'authenticated users without a city profile cannot cancel acts'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
insert into act_test_rows (label, id)
select 'city-subdivision',
    (
        public.save_act(
            null,
            'City Subdivision Training',
            'training',
            null,
            '2026-10-21 10:00:00-03',
            location.longitude,
            location.latitude,
            'Rua 1, 100',
            (
                select subdivision.id
                from public.subdivisions as subdivision
                    join public.regions as region on region.id = subdivision.region_id
                where region.region_number = 1
            )
        )->>'id'
    )::uuid
from act_test_location as location;
select is(
        (
            select act.scope_type
            from public.acts as act
                join act_test_rows as saved on saved.id = act.id
            where saved.label = 'city-subdivision'
        ),
        'subdivision',
        'city leader can create an act for any published subdivision'
    );
select is(
        (
            public.save_act(
                (
                    select id
                    from act_test_rows
                    where label = 'city'
                ),
                'Updated City Rally',
                'public_rally',
                null,
                '2026-10-20 18:30:00-03',
                (
                    select longitude
                    from act_test_location
                ),
                (
                    select latitude
                    from act_test_location
                ),
                'Praça da Catedral, portão sul',
                null
            )->>'id'
        )::uuid,
        (
            select id
            from act_test_rows
            where label = 'city'
        ),
        'city leader can edit a city-wide act'
    );
select is(
        jsonb_array_length(public.list_manageable_act_subdivisions()),
        2,
        'city leader can manage every subdivision scope'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
insert into act_test_rows (label, id)
select 'sector-assigned',
    (
        public.save_act(
            null,
            'Assigned Leaflet Distribution',
            'leaflet_distribution',
            null,
            '2026-10-22 14:00:00-03',
            location.longitude,
            location.latitude,
            'Rua 2, 200',
            (
                select subdivision.id
                from public.subdivisions as subdivision
                    join public.regions as region on region.id = subdivision.region_id
                where region.region_number = 1
            )
        )->>'id'
    )::uuid
from act_test_location as location;
select is(
        jsonb_array_length(public.list_manageable_act_subdivisions()),
        1,
        'assigned sector leader can manage subdivisions in assigned regions only'
    );
select throws_ok(
        $$select public.save_act(
            null,
            'Unassigned Meeting',
            'meeting',
            null,
            '2026-10-22 15:00:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Rua 3, 300',
            (
                select subdivision.id
                from public.subdivisions as subdivision
                    join public.regions as region on region.id = subdivision.region_id
                where region.region_number = 2
            )
        ) $$,
        '42501',
        null,
        'assigned sector leader cannot create an act in an unassigned region'
    );
select throws_ok(
        $$select public.save_act(
            null,
            'Sector City Rally',
            'public_rally',
            null,
            '2026-10-22 16:00:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Praça da Catedral',
            null
        ) $$,
        '42501',
        null,
        'sector leader cannot create a city-wide act'
    );
select is(
        (
            public.save_act(
                (
                    select id
                    from act_test_rows
                    where label = 'sector-assigned'
                ),
                'Edited Assigned Distribution',
                'leaflet_distribution',
                null,
                '2026-10-22 14:30:00-03',
                (
                    select longitude
                    from act_test_location
                ),
                (
                    select latitude
                    from act_test_location
                ),
                'Rua 2, 200',
                (
                    select subdivision.id
                    from public.subdivisions as subdivision
                        join public.regions as region on region.id = subdivision.region_id
                    where region.region_number = 1
                )
            )->>'id'
        )::uuid,
        (
            select id
            from act_test_rows
            where label = 'sector-assigned'
        ),
        'assigned sector leader can edit an act in their region'
    );
select throws_ok(
        $$select public.save_act(
            (
                select id
                from act_test_rows
                where label = 'city'
            ),
            'Sector Edits City Act',
            'public_rally',
            null,
            '2026-10-20 18:30:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Praça da Catedral',
            null
        ) $$,
        '42501',
        null,
        'sector leader cannot edit a city-wide act'
    );
select is(
        (
            public.cancel_act(
                (
                    select id
                    from act_test_rows
                    where label = 'sector-assigned'
                )
            )->>'status'
        ),
        'cancelled',
        'assigned sector leader can cancel an act in their region'
    );
select throws_ok(
        $$select public.cancel_act(
            (
                select id
                from act_test_rows
                where label = 'city'
            )
        ) $$,
        '42501',
        null,
        'sector leader cannot cancel a city-wide act'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
select is(
        jsonb_array_length(public.list_manageable_act_subdivisions()),
        0,
        'unassigned sector leader receives no manageable subdivisions'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
select throws_ok(
        $$select public.save_act(
            null,
            'Participant Rally',
            'public_rally',
            null,
            '2026-10-22 18:00:00-03',
            (
                select longitude
                from act_test_location
            ),
            (
                select latitude
                from act_test_location
            ),
            'Praça da Catedral',
            null
        ) $$,
        '42501',
        null,
        'participants cannot create acts'
    );
select is(
        jsonb_array_length(public.list_acts()),
        3,
        'participants can read city and subdivision acts including cancelled acts'
    );
select throws_ok(
        $$insert into public.acts (
            city_id,
            title,
            category,
            starts_at,
            meeting_point,
            meeting_address,
            created_by,
            updated_by
        )
        values (
                '41152000-0000-4000-8000-000000000001',
                'Direct Insert',
                'meeting',
                now(),
                extensions.st_setsrid(extensions.st_makepoint(0, 0), 4326),
                'Address',
                'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
                'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
            ) $$,
            '42501',
            null,
            'participants cannot bypass act validation with direct inserts'
    );
select throws_ok(
        $$update public.acts
        set title = 'Direct Update'
        where id = (
                select id
                from act_test_rows
                where label = 'city'
            ) $$,
            '42501',
            null,
            'participants cannot update acts directly'
    );
select throws_ok(
        $$delete
        from public.acts
        where id = (
                select id
                from act_test_rows
                where label = 'city'
            ) $$,
            '42501',
            null,
            'participants cannot delete acts'
    );
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select is(
        (
            public.cancel_act(
                (
                    select id
                    from act_test_rows
                    where label = 'city'
                )
            )->>'status'
        ),
        'cancelled',
        'city leader can cancel a city-wide act'
    );
select is(
        (
            select act.status
            from public.acts as act
                join act_test_rows as saved on saved.id = act.id
            where saved.label = 'city'
        ),
        'cancelled',
        'cancelling changes status without deleting the act record'
    );
select ok(
        (
            select act.updated_at >= act.created_at
            from public.acts as act
                join act_test_rows as saved on saved.id = act.id
            where saved.label = 'city'
        ),
        'city act retains its audit timestamps after cancellation'
    );
reset role;
select *
from finish();
rollback;
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
select plan(17);
select ok(
        to_regprocedure('public.ensure_maringa_default_regions()') is not null,
        'authenticated city members can initialize the default Maringá regions'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.ensure_maringa_default_regions()',
            'execute'
        ),
        'authenticated users can invoke the initializer'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.ensure_maringa_default_regions()',
            'execute'
        ),
        'anonymous users cannot invoke the initializer'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
        'default-regions-participant@example.test',
        '{"name":"Pessoa Seed","whatsapp_e164":"+5511999996401","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
        'default-regions-leader@example.test',
        '{"name":"Liderança Seed","whatsapp_e164":"+5511999996402","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select is(
        (
            public.ensure_maringa_default_regions()->>'initialized'
        )::boolean,
        true,
        'the first map load publishes the default regions'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and status = 'published'
        ),
        1::bigint,
        'one default map is published'
    );
select ok(
        (
            select is_system_default
            from public.region_sets
            where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and status = 'published'
        ),
        'the published set is marked as a system default'
    );
select ok(
        (
            select created_by is null
            from public.region_sets
            where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and status = 'published'
        ),
        'system initialization does not attribute the map to a participant'
    );
select is(
        (
            select target_region_count::integer
            from public.region_sets
            where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and status = 'published'
        ),
        4,
        'the default map contains four regions'
    );
select is(
        (
            select array_agg(
                    name
                    order by region_number
                )
            from public.regions
            where region_set_id = (
                    select id
                    from public.region_sets
                    where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                        and status = 'published'
                )
        ),
        array [
            'GT Unicesumar e região',
            'GT Monções e região',
            'GT ALVORADA MORANGUEIRA',
            'GT UEM, Vila esperança e região'
        ]::text [],
        'the KML region names are preserved in order'
    );
select is(
        (
            select array_agg(
                    color
                    order by region_number
                )
            from public.regions
            where region_set_id = (
                    select id
                    from public.region_sets
                    where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                        and status = 'published'
                )
        ),
        array ['#0288D1', '#7CB342', '#F48FB1', '#FFEA00']::text [],
        'the KML region colors are preserved in order'
    );
select ok(
        not exists (
            with expected(region_number, geom) as (
                values (
                        1,
                        extensions.st_geomfromtext(
                            'POLYGON((-51.931156 -23.4117595,-51.9329472 -23.4130378,-51.9329758 -23.415637,-51.9365521 -23.415742,-51.939642 -23.4156633,-51.9396706 -23.4171203,-51.9398995 -23.4190369,-51.9400568 -23.4253507,-51.9433756 -23.4254557,-51.9444056 -23.4345911,-51.9438334 -23.4355361,-51.9456644 -23.440996,-51.9422312 -23.4587392,-51.9123049 -23.4603139,-51.9017763 -23.4455108,-51.8904467 -23.4387911,-51.8874396 -23.4317116,-51.9075812 -23.4210009,-51.931156 -23.4117595))',
                            4326
                        )
                    ),
                    (
                        2,
                        extensions.st_geomfromtext(
                            'POLYGON((-51.9534371 -23.4225775,-51.9545815 -23.4159617,-51.9655678 -23.4191646,-51.9716618 -23.4183245,-51.9753239 -23.4239952,-51.9749234 -23.4330257,-51.9868825 -23.4511374,-51.9616196 -23.4574365,-51.9422312 -23.4587392,-51.9456644 -23.440996,-51.9438334 -23.4355361,-51.9444056 -23.4345911,-51.9439385 -23.4277229,-51.9466279 -23.4268829,-51.9534371 -23.4225775))',
                            4326
                        )
                    ),
                    (
                        3,
                        extensions.st_geomfromtext(
                            'POLYGON((-51.9128455 -23.3798297,-51.9270362 -23.3976861,-51.931156 -23.4117595,-51.9075812 -23.4210009,-51.8874396 -23.4317116,-51.8773688 -23.4027275,-51.8810309 -23.3981063,-51.9128455 -23.3798297))',
                            4326
                        )
                    ),
                    (
                        4,
                        extensions.st_geomfromtext(
                            'POLYGON((-51.9151402 -23.3788277,-51.9230367 -23.3721046,-51.9317342 -23.37284,-51.9493581 -23.379563,-51.9578267 -23.3800882,-51.9614888 -23.3811387,-51.9880391 -23.4098125,-51.9771672 -23.4178988,-51.9655678 -23.4191646,-51.9545815 -23.4159617,-51.9534371 -23.4225775,-51.9439385 -23.4277229,-51.9433756 -23.4254557,-51.9400568 -23.4253507,-51.939642 -23.4156633,-51.9329758 -23.415637,-51.9329472 -23.4130378,-51.931156 -23.4117595,-51.9270362 -23.3976861,-51.9128455 -23.3798297,-51.9151402 -23.3788277))',
                            4326
                        )
                    )
            )
            select 1
            from expected
                join public.regions as region on region.region_number = expected.region_number
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.is_system_default
                and not extensions.st_equals(region.geom, expected.geom)
        ),
        'stored region geometries preserve the KML outlines'
    );
select ok(
        (
            select bool_and(
                    extensions.st_isvalid(region.geom)
                    and extensions.st_covers(boundary.geom, region.geom)
                )
            from public.regions as region
                join public.region_sets as region_set on region_set.id = region.region_set_id
                cross join lateral (
                    select extensions.st_unaryunion(extensions.st_collect(perimeter.geom)) as geom
                    from public.urban_perimeters as perimeter
                    where perimeter.city_id = region_set.city_id
                ) as boundary
            where region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and region_set.status = 'published'
        ),
        'every default polygon is valid and contained by the official urban boundary'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions as subdivision
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and region_set.status = 'published'
        ),
        0::bigint,
        'the default map is published without subdivisions'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select is(
        (
            public.ensure_maringa_default_regions()->>'initialized'
        )::boolean,
        false,
        'initialization is idempotent when a published map exists'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.region_sets
            where city_id = '41152000-0000-4000-8000-000000000001'::uuid
                and status in ('draft', 'published')
        ),
        1::bigint,
        'repeated initialization does not duplicate the map'
    );
delete from public.region_sets
where city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and status = 'published';
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
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
        array ['#123456']::text []
    );
reset role;
create temporary table preexisting_draft as
select id
from public.region_sets
where city_id = '41152000-0000-4000-8000-000000000001'::uuid
    and status = 'draft';
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
select is(
        (
            public.ensure_maringa_default_regions()->>'initialized'
        )::boolean,
        false,
        'initialization does not seed over a city leader draft'
    );
reset role;
select is(
        (
            select count(*)::bigint
            from public.region_sets as region_set
                join preexisting_draft as original on original.id = region_set.id
            where region_set.status = 'draft'
        ),
        1::bigint,
        'the existing draft remains unchanged'
    );
select *
from finish();
rollback;
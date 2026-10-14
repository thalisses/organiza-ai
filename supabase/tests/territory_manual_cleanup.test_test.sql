begin;
select plan(12);
select ok(
        to_regprocedure('public.clear_automatic_subdivisions()') is not null,
        'the cleanup is explicit and separate from rendering or bootstrap'
    );
select ok(
        not has_function_privilege(
            'authenticated',
            'public.generate_subdivision_drafts(uuid,integer,integer)',
            'execute'
        ),
        'the retired public generator cannot be called directly'
    );
select ok(
        not has_function_privilege(
            'authenticated',
            'private.generate_subdivision_drafts(uuid,integer,integer)',
            'execute'
        ),
        'the private writer cannot bypass retirement'
    );
insert into auth.users(id, email, raw_user_meta_data)
values (
        'efefefef-efef-4fef-8fef-efefefefe001',
        'cleanup-leader@example.test',
        '{"name":"Cleanup Leader","whatsapp_e164":"+5511999998201","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    ),
    (
        'efefefef-efef-4fef-8fef-efefefefe002',
        'cleanup-participant@example.test',
        '{"name":"Cleanup Participant","whatsapp_e164":"+5511999998202","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'
    );
update public.profiles
set role = 'lider_cidade'
where id = 'efefefef-efef-4fef-8fef-efefefefe001';
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
        'efefefef-efef-4fef-8fef-efefefefe003',
        '41152000-0000-4000-8000-000000000001',
        'efefefef-efef-4fef-8fef-efefefefe001',
        2,
        'published',
        now()
    );
insert into public.regions(id, region_set_id, region_number, color, geom)
values (
        'efefefef-efef-4fef-8fef-efefefefe004',
        'efefefef-efef-4fef-8fef-efefefefe003',
        1,
        '#FFEA00',
        extensions.st_multi(
            extensions.st_geomfromtext(
                'POLYGON((-51.95 -23.4,-51.94 -23.4,-51.94 -23.39,-51.95 -23.39,-51.95 -23.4))',
                4326
            )
        )
    ),
    (
        'efefefef-efef-4fef-8fef-efefefefe005',
        'efefefef-efef-4fef-8fef-efefefefe003',
        2,
        '#7CB342',
        extensions.st_multi(
            extensions.st_geomfromtext(
                'POLYGON((-51.93 -23.4,-51.92 -23.4,-51.92 -23.39,-51.93 -23.39,-51.93 -23.4))',
                4326
            )
        )
    );
insert into public.subdivisions(id, region_id, subdivision_number, geom, origin)
select 'efefefef-efef-4fef-8fef-efefefefe006',
    id,
    1,
    geom,
    'automatic'
from public.regions
where id = 'efefefef-efef-4fef-8fef-efefefefe004';
insert into public.subdivisions(id, region_id, subdivision_number, geom, origin)
select 'efefefef-efef-4fef-8fef-efefefefe007',
    id,
    1,
    geom,
    'automatic'
from public.regions
where id = 'efefefef-efef-4fef-8fef-efefefefe005';
insert into public.subdivisions(id, region_id, subdivision_number, geom, origin)
select 'efefefef-efef-4fef-8fef-efefefefe008',
    id,
    2,
    geom,
    'manual'
from public.regions
where id = 'efefefef-efef-4fef-8fef-efefefefe004';
insert into public.subdivision_memberships(id, participant_id, subdivision_id)
values (
        'efefefef-efef-4fef-8fef-efefefefe009',
        'efefefef-efef-4fef-8fef-efefefefe002',
        'efefefef-efef-4fef-8fef-efefefefe006'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'efefefef-efef-4fef-8fef-efefefefe001';
select throws_ok(
        'select public.clear_automatic_subdivisions()',
        '23514',
        'AUTOMATIC_AREA_REFERENCED',
        'a referenced area blocks the whole cleanup'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where id in (
                    'efefefef-efef-4fef-8fef-efefefefe006',
                    'efefefef-efef-4fef-8fef-efefefefe007'
                )
        ),
        2,
        'failed cleanup preserves automatic areas from every region'
    );
reset role;
delete from public.subdivision_memberships
where id = 'efefefef-efef-4fef-8fef-efefefefe009';
set local role authenticated;
select lives_ok(
        'select public.clear_automatic_subdivisions()',
        'cleanup succeeds after references have been resolved'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where region_id in (
                    'efefefef-efef-4fef-8fef-efefefefe004',
                    'efefefef-efef-4fef-8fef-efefefefe005'
                )
                and origin = 'automatic'
        ),
        0,
        'automatic areas from both regions are removed'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where id = 'efefefef-efef-4fef-8fef-efefefefe008'
        ),
        1,
        'manual areas preserve their IDs'
    );
select is(
        public.clear_automatic_subdivisions(),
        0,
        'repeating cleanup removes nothing'
    );
reset role;
insert into public.subdivisions(region_id, subdivision_number, geom, origin)
values (
        'efefefef-efef-4fef-8fef-efefefefe005',
        3,
        extensions.st_multi(
            extensions.st_geomfromtext(
                'POLYGON((-51.93 -23.4,-51.925 -23.4,-51.925 -23.395,-51.93 -23.4))',
                4326
            )
        ),
        'unknown'
    );
insert into public.subdivisions(id, region_id, subdivision_number, geom, origin)
select 'efefefef-efef-4fef-8fef-efefefefe010',
    id,
    3,
    geom,
    'automatic'
from public.regions
where id = 'efefefef-efef-4fef-8fef-efefefefe004';
set local role authenticated;
select throws_ok(
        'select public.clear_automatic_subdivisions()',
        '23514',
        'LEGACY_ORIGIN_UNKNOWN',
        'unknown geometry is not silently treated as automatic'
    );
select is(
        (
            select count(*)::integer
            from public.subdivisions
            where id = 'efefefef-efef-4fef-8fef-efefefefe010'
        ),
        1,
        'ambiguous origin blocks all removals atomically'
    );
set local request.jwt.claim.sub = 'efefefef-efef-4fef-8fef-efefefefe002';
select throws_ok(
        'select public.clear_automatic_subdivisions()',
        '42501',
        null,
        'participants cannot clean administrative areas'
    );
select *
from finish();
rollback;
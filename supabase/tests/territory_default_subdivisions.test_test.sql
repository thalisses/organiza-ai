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
select plan(11);
insert into auth.users (id, email, raw_user_meta_data)
values (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
        'default-subdivision-participant@example.test',
        '{"name":"Pessoa Subdivisão Seed","whatsapp_e164":"+5511999996501","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
        'default-subdivision-leader@example.test',
        '{"name":"Liderança Subdivisão Seed","whatsapp_e164":"+5511999996502","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_cidade'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select public.ensure_maringa_default_regions();
select throws_ok(
        $$select pg_temp.prepare_subdivision_fixture(
            (
                select id
                from public.region_sets
                where is_system_default
            ),
            1,
            2
        ) $$,
        '42501',
        null,
        'participants cannot configure default subdivisions'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select lives_ok(
        $$select pg_temp.prepare_subdivision_fixture(
            (
                select id
                from public.region_sets
                where is_system_default
            ),
            1,
            2
        ) $$,
        'the city leader can generate subdivisions in a published default region'
    );
reset role;
select is(
        (
            select status
            from public.region_sets
            where is_system_default
        ),
        'published',
        'the region set remains published after subdivision generation'
    );
select is(
        (
            select count(*)::bigint
            from public.subdivisions as subdivision
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.is_system_default
                and region.region_number = 1
        ),
        2::bigint,
        'the configured subdivision count is persisted for the selected region'
    );
select ok(
        (
            select bool_and(extensions.st_isvalid(subdivision.geom))
            from public.subdivisions as subdivision
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.is_system_default
                and region.region_number = 1
        ),
        'generated subdivisions are valid geometries'
    );
select ok(
        (
            select bool_and(
                    extensions.st_area(
                        extensions.st_difference(
                            extensions.st_transform(subdivision.geom, 31982),
                            extensions.st_transform(region.geom, 31982)
                        )
                    ) <= 0.01
                )
            from public.subdivisions as subdivision
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.is_system_default
                and region.region_number = 1
        ),
        'generated subdivisions stay inside their parent within PostGIS precision'
    );
select ok(
        (
            select bool_and(
                    abs(
                        extensions.st_area(extensions.st_transform(subdivision.geom, 31982)) / (
                            extensions.st_area(extensions.st_transform(region.geom, 31982)) / 2
                        ) - 1
                    ) * 100 <= 15
                )
            from public.subdivisions as subdivision
                join public.regions as region on region.id = subdivision.region_id
                join public.region_sets as region_set on region_set.id = region.region_set_id
            where region_set.is_system_default
                and region.region_number = 1
        ),
        'generated subdivisions stay within the area tolerance'
    );
create temporary table default_subdivision_edit_input as
select region.id as region_id,
    jsonb_agg(
        jsonb_build_object(
            'number',
            subdivision.subdivision_number,
            'geometry',
            extensions.st_asgeojson(subdivision.geom, 15)::jsonb
        )
        order by subdivision.subdivision_number
    ) as subdivisions
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
    join public.subdivisions as subdivision on subdivision.region_id = region.id
where region_set.is_system_default
    and region.region_number = 1
group by region.id;
grant select on default_subdivision_edit_input to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select lives_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from default_subdivision_edit_input
            ),
            (
                select subdivisions
                from default_subdivision_edit_input
            )
        ) $$,
        'the city leader can edit generated subdivisions before enrollment'
    );
reset role;
select is(
        (
            select status
            from public.region_sets
            where is_system_default
        ),
        'published',
        'editing subdivisions preserves the published default map'
    );
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select lives_ok(
        $$select public.set_my_subdivision_membership(
            (
                select subdivision.id
                from public.subdivisions as subdivision
                    join public.regions as region on region.id = subdivision.region_id
                    join public.region_sets as region_set on region_set.id = region.region_set_id
                where region_set.is_system_default
                    and region.region_number = 1
                    and subdivision.subdivision_number = 1
            )
        ) $$,
        'participants can enroll after the city leader creates valid subdivisions'
    );
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select throws_ok(
        $$select public.save_subdivision_edits(
            (
                select region_id
                from default_subdivision_edit_input
            ),
            (
                select subdivisions
                from default_subdivision_edit_input
            )
        ) $$,
        '23514',
        null,
        'subdivision edits are blocked after membership history exists'
    );
select *
from finish();
rollback;
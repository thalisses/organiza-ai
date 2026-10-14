begin;
select plan(16);
select ok(
        to_regprocedure('public.set_sector_leader(uuid,boolean)') is not null,
        'the narrow sector leader assignment function exists'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.set_sector_leader(uuid,boolean)',
            'execute'
        ),
        'authenticated users can execute the role assignment function'
    );
select ok(
        not has_function_privilege(
            'anon',
            'public.set_sector_leader(uuid,boolean)',
            'execute'
        ),
        'anonymous users cannot execute the role assignment function'
    );
select ok(
        not has_column_privilege(
            'authenticated',
            'public.profiles',
            'role',
            'update'
        ),
        'authenticated users cannot update the profile role column directly'
    );
insert into auth.users (id, email, raw_user_meta_data)
values (
        '11111111-1111-4111-8111-111111111111',
        'participant@example.test',
        '{"name":"Participante Um","whatsapp_e164":"+5511999990001","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'target@example.test',
        '{"name":"Participante Dois","whatsapp_e164":"+5511999990002","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        'sector@example.test',
        '{"name":"Lider Setor","whatsapp_e164":"+5511999990003","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    ),
    (
        '44444444-4444-4444-8444-444444444444',
        'city@example.test',
        '{"name":"Lider Cidade","whatsapp_e164":"+5511999990004","availability_windows":[{"day_of_week":4,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
    );
update public.profiles
set role = 'lider_setor'
where id = '33333333-3333-4333-8333-333333333333';
update public.profiles
set role = 'lider_cidade'
where id = '44444444-4444-4444-8444-444444444444';
set local role anon;
select throws_ok(
        $$select public.set_sector_leader('22222222-2222-4222-8222-222222222222', true) $$,
        '42501',
        null,
        'anonymous users cannot assign sector leaders'
    );
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select throws_ok(
        $$select public.set_sector_leader('22222222-2222-4222-8222-222222222222', true) $$,
        '42501',
        null,
        'participants cannot assign sector leaders'
    );
reset role;
select results_eq(
        $$select role
        from public.profiles
        where id = '22222222-2222-4222-8222-222222222222' $$,
            array ['participante']::text [],
            'participant assignment attempt leaves the target as a participant'
    );
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select throws_ok(
        $$select public.set_sector_leader('22222222-2222-4222-8222-222222222222', true) $$,
        '42501',
        null,
        'sector leaders cannot assign or remove roles'
    );
select results_eq(
        $$select role
        from public.profiles
        where id = '33333333-3333-4333-8333-333333333333' $$,
            array ['lider_setor']::text [],
            'sector leader role remains unchanged after a denied attempt'
    );
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select results_eq(
        $$select public.set_sector_leader('22222222-2222-4222-8222-222222222222', true) $$,
        array ['lider_setor']::text [],
        'city leaders can promote a participant to sector leader'
    );
select results_eq(
        $$select role
        from public.profiles
        where id = '22222222-2222-4222-8222-222222222222' $$,
            array ['lider_setor']::text [],
            'the promotion is persisted on the target profile'
    );
select results_eq(
        $$select public.set_sector_leader('22222222-2222-4222-8222-222222222222', false) $$,
        array ['participante']::text [],
        'city leaders can remove a sector leader role'
    );
select results_eq(
        $$select role
        from public.profiles
        where id = '22222222-2222-4222-8222-222222222222' $$,
            array ['participante']::text [],
            'the removal is persisted on the target profile'
    );
select throws_ok(
        $$select public.set_sector_leader('44444444-4444-4444-8444-444444444444', true) $$,
        'P0002',
        null,
        'city leaders cannot alter the city leader role through the sector assignment function'
    );
select throws_ok(
        $$select public.set_sector_leader('55555555-5555-4555-8555-555555555555', true) $$,
        'P0002',
        null,
        'city leaders cannot assign a role to a nonexistent profile'
    );
select throws_ok(
        $$update public.profiles
        set role = 'participante'
        where id = '44444444-4444-4444-8444-444444444444' $$,
            '42501',
            null,
            'city leaders must use the narrow assignment function rather than direct role updates'
    );
select *
from finish();
rollback;
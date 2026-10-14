begin;
select plan(8);
select has_table(
        'public',
        'act_registrations',
        'act registrations preserve each participant response'
    );
select ok(
        to_regclass(
            'public.act_registrations_one_active_per_act_participant_idx'
        ) is not null,
        'a participant can have at most one active registration per act'
    );
select ok(
        to_regprocedure('public.register_for_act(uuid)') is not null,
        'participants can register through a validated database function'
    );
select ok(
        to_regprocedure('public.cancel_my_act_registration(uuid)') is not null,
        'participants can cancel their own registration through a database function'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.register_for_act(uuid)',
            'execute'
        )
        and not has_function_privilege(
            'anon',
            'public.register_for_act(uuid)',
            'execute'
        )
        and has_function_privilege(
            'authenticated',
            'public.cancel_my_act_registration(uuid)',
            'execute'
        )
        and not has_function_privilege(
            'anon',
            'public.cancel_my_act_registration(uuid)',
            'execute'
        ),
        'registration RPCs are available only to authenticated users'
    );
select ok(
        (
            select relrowsecurity
            from pg_class
            where oid = to_regclass('public.act_registrations')
        ),
        'act registrations are protected by RLS'
    );
select ok(
        has_table_privilege(
            'authenticated',
            'public.act_registrations',
            'select'
        )
        and not has_table_privilege(
            'authenticated',
            'public.act_registrations',
            'insert'
        )
        and not has_table_privilege(
            'authenticated',
            'public.act_registrations',
            'update'
        )
        and not has_table_privilege(
            'authenticated',
            'public.act_registrations',
            'delete'
        ),
        'participants read registrations but write only through RPCs'
    );
select ok(
        has_table_privilege('authenticated', 'public.acts', 'select'),
        'authenticated participants can discover acts before registering'
    );
select *
from finish();
rollback;
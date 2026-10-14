begin;
select plan(4);
select ok(
        to_regprocedure('public.get_act_attendees(uuid)') is not null,
        'authorized leaders can load an act attendee roster'
    );
select ok(
        has_function_privilege(
            'authenticated',
            'public.get_act_attendees(uuid)',
            'execute'
        )
        and not has_function_privilege(
            'anon',
            'public.get_act_attendees(uuid)',
            'execute'
        ),
        'attendee roster RPC is available only to authenticated users'
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
        'attendee data cannot be changed directly by clients'
    );
select ok(
        (
            select relrowsecurity
            from pg_class
            where oid = to_regclass('public.act_registrations')
        ),
        'act registration data retains row-level security'
    );
select *
from finish();
rollback;
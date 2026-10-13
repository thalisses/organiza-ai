begin;
select plan(25);

select has_table('public', 'availability_windows', 'weekly availability table exists');
select ok(
	coalesce(
		(
			select relation.relrowsecurity
			from pg_class as relation
			where relation.oid = to_regclass('public.availability_windows')
		),
		false
	),
	'availability has row-level security enabled'
);
select ok(not has_table_privilege('anon', 'public.availability_windows', 'select'), 'anon has no availability read grant');
select ok(has_table_privilege('authenticated', 'public.availability_windows', 'select'), 'authenticated can read availability');
select ok(has_table_privilege('authenticated', 'public.availability_windows', 'insert'), 'authenticated can insert availability');
select ok(has_table_privilege('authenticated', 'public.availability_windows', 'update'), 'authenticated can update availability');
select ok(has_table_privilege('authenticated', 'public.availability_windows', 'delete'), 'authenticated can delete availability');
select ok(not has_function_privilege('anon', 'public.replace_my_availability(jsonb)', 'execute'), 'anon cannot call the availability replacement function');
select ok(has_function_privilege('authenticated', 'public.replace_my_availability(jsonb)', 'execute'), 'authenticated can call the availability replacement function');

insert into auth.users (id, email, raw_user_meta_data)
values
	(
		'11111111-1111-4111-8111-111111111111',
		'participant@example.test',
		'{"name":"Participante Um","whatsapp_e164":"+5511999990001","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"},{"day_of_week":1,"starts_at":"14:00","ends_at":"18:00"}]}'::jsonb
	),
	(
		'22222222-2222-4222-8222-222222222222',
		'sector@example.test',
		'{"name":"Lider Setor","whatsapp_e164":"+5511999990002","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	),
	(
		'33333333-3333-4333-8333-333333333333',
		'city@example.test',
		'{"name":"Lider Cidade","whatsapp_e164":"+5511999990003","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	);

update public.profiles
set role = 'lider_setor'
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles
set role = 'lider_cidade'
where id = '33333333-3333-4333-8333-333333333333';

select results_eq(
	$$select starts_at::text || '-' || ends_at::text
		from public.availability_windows
		where profile_id = '11111111-1111-4111-8111-111111111111'
		order by starts_at$$,
	array['09:00:00-12:00:00', '14:00:00-18:00:00']::text[],
	'signup stores multiple recurring windows on one weekday'
);

set local role anon;
select throws_ok(
	$$select * from public.availability_windows$$,
	'42501',
	null,
	'anonymous users cannot read availability'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select results_eq(
	$$select count(*)::bigint from public.availability_windows$$,
	array[2::bigint],
	'participants can read their own availability'
);
select is_empty(
	$$select id from public.availability_windows where profile_id = '22222222-2222-4222-8222-222222222222'$$,
	'participants cannot read another user availability'
);
select results_eq(
	$$insert into public.availability_windows (profile_id, day_of_week, starts_at, ends_at)
		values ('11111111-1111-4111-8111-111111111111', 4, '10:00', '11:00')
		returning day_of_week::text$$,
	array['4']::text[],
	'participants can add their own availability'
);
select throws_ok(
	$$insert into public.availability_windows (profile_id, day_of_week, starts_at, ends_at)
		values ('22222222-2222-4222-8222-222222222222', 4, '10:00', '11:00')$$,
	'42501',
	null,
	'participants cannot add availability for another user'
);
select results_eq(
	$$update public.availability_windows
		set ends_at = '12:30'
		where profile_id = '11111111-1111-4111-8111-111111111111'
			and day_of_week = 4
		returning ends_at::text$$,
	array['12:30:00']::text[],
	'participants can edit their own availability'
);
select lives_ok(
	$$select public.replace_my_availability('[{"day_of_week":5,"starts_at":"08:00","ends_at":"10:00"},{"day_of_week":5,"starts_at":"13:00","ends_at":"17:00"}]'::jsonb)$$,
	'participants can replace their weekly availability atomically'
);
select results_eq(
	$$select starts_at::text || '-' || ends_at::text
		from public.availability_windows
		where profile_id = '11111111-1111-4111-8111-111111111111'
		order by starts_at$$,
	array['08:00:00-10:00:00', '13:00:00-17:00:00']::text[],
	'availability replacement removes stale intervals and saves all new intervals'
);
select throws_ok(
	$$select public.replace_my_availability('[]'::jsonb)$$,
	'23514',
	null,
	'availability replacement rejects an empty schedule'
);
select throws_ok(
	$$select public.replace_my_availability('[{"day_of_week":5,"starts_at":"17:00","ends_at":"09:00"}]'::jsonb)$$,
	'23514',
	null,
	'availability replacement rejects an invalid time range'
);

reset role;
select throws_ok(
	$$insert into auth.users (id, email, raw_user_meta_data)
		values ('44444444-4444-4444-8444-444444444444', 'empty@example.test',
			'{"name":"Sem agenda","whatsapp_e164":"+5511999990004","availability_windows":[]}'::jsonb)$$,
	'23514',
	null,
	'signup rejects an empty schedule in the database'
);
select throws_ok(
	$$insert into auth.users (id, email, raw_user_meta_data)
		values ('55555555-5555-4555-8555-555555555555', 'invalid@example.test',
			'{"name":"Agenda inválida","whatsapp_e164":"+5511999990005","availability_windows":[{"day_of_week":7,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb)$$,
	'23514',
	null,
	'signup rejects invalid weekday values in the database'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select results_eq(
	$$select count(*)::bigint
		from public.availability_windows
		where profile_id in (
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
			'33333333-3333-4333-8333-333333333333'
		)$$,
	array[4::bigint],
	'sector leaders can read availability for city participants'
);
select throws_ok(
	$$insert into public.availability_windows (profile_id, day_of_week, starts_at, ends_at)
		values ('11111111-1111-4111-8111-111111111111', 6, '09:00', '10:00')$$,
	'42501',
	null,
	'leaders cannot modify participant availability'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select results_eq(
	$$select count(*)::bigint
		from public.availability_windows
		where profile_id in (
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
			'33333333-3333-4333-8333-333333333333'
		)$$,
	array[4::bigint],
	'city leaders can read availability for city participants'
);

select * from finish();
rollback;
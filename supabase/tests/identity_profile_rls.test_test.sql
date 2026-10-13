begin;
select plan(22);

select has_table('public', 'cities', 'pilot cities table exists');
select has_table('public', 'profiles', 'auth-linked profile table exists');
select has_column('public', 'cities', 'slug', 'cities have stable slugs');
select has_column('public', 'profiles', 'city_id', 'profiles reference a city');
select has_column('public', 'profiles', 'whatsapp_e164', 'profiles store normalized WhatsApp');
select has_column('public', 'profiles', 'role', 'profiles store a protected role');
select ok(
	coalesce(
		(
			select relation.relrowsecurity
			from pg_class as relation
			where relation.oid = to_regclass('public.profiles')
		),
		false
	),
	'profiles have row-level security enabled'
);
select ok(
	coalesce(
		(
			select relation.relrowsecurity
			from pg_class as relation
			where relation.oid = to_regclass('public.cities')
		),
		false
	),
	'cities have row-level security enabled'
);
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no profile read grant');
select ok(not has_table_privilege('anon', 'public.cities', 'select'), 'anon has no city read grant');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated can read profiles');
select ok(has_table_privilege('authenticated', 'public.cities', 'select'), 'authenticated can read cities');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles directly');

insert into auth.users (id, email, raw_user_meta_data)
values
	(
		'11111111-1111-4111-8111-111111111111',
		'participant@example.test',
		'{"name":"Participante Um","whatsapp_e164":"+5511999990001","role":"lider_cidade","city_id":"00000000-0000-4000-8000-000000000000","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
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

set local role anon;
select throws_ok(
	$$select * from public.profiles$$,
	'42501',
	null,
	'anonymous users cannot read profiles'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select results_eq(
	$$select profile.role || ':' || city.slug
		from public.profiles as profile
		join public.cities as city on city.id = profile.city_id
		where profile.id = '11111111-1111-4111-8111-111111111111'$$,
	array['participante:maringa-pr']::text[],
	'signup trigger sets the pilot city and ignores client role metadata'
);
select is_empty(
	$$select profile.id from public.profiles as profile where profile.id = '22222222-2222-4222-8222-222222222222'$$,
	'participants cannot read another user profile'
);
select results_eq(
	$$update public.profiles
		set name = 'Nome Atualizado'
		where id = '11111111-1111-4111-8111-111111111111'
		returning name$$,
	array['Nome Atualizado']::text[],
	'participants can update their own profile fields'
);
select throws_ok(
	$$update public.profiles set role = 'lider_cidade' where id = '11111111-1111-4111-8111-111111111111'$$,
	'42501',
	null,
	'participants cannot update their role'
);
select throws_ok(
	$$update public.profiles set city_id = '00000000-0000-4000-8000-000000000000' where id = '11111111-1111-4111-8111-111111111111'$$,
	'42501',
	null,
	'participants cannot change their city'
);
select results_eq(
	$$select role from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
	array['participante']::text[],
	'denied role update leaves participant role unchanged'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select results_eq(
	$$select count(*)::bigint
		from public.profiles
		where id in (
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
			'33333333-3333-4333-8333-333333333333'
		)$$,
	array[3::bigint],
	'sector leaders can read participant profiles for coordination'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select results_eq(
	$$select whatsapp_e164 from public.profiles where id = '11111111-1111-4111-8111-111111111111'$$,
	array['+5511999990001']::text[],
	'city leaders can read participant WhatsApp numbers'
);

select * from finish();
rollback;

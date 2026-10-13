begin;
select plan(17);

select has_function('public', 'set_my_subdivision_membership', array['uuid'], 'participants can enroll or switch their own subdivision');
select has_function('public', 'get_my_active_subdivision_membership', array[]::text[], 'participants can read their own current subdivision');
select ok(
	has_function_privilege('authenticated', 'public.set_my_subdivision_membership(uuid)', 'execute')
	and not has_function_privilege('anon', 'public.set_my_subdivision_membership(uuid)', 'execute'),
	'only authenticated users can enroll'
);

insert into auth.users (id, email, raw_user_meta_data)
values
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'membership-enrollment-leader@example.test', '{"name":"Membership Leader","whatsapp_e164":"+5511999996501","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'membership-enrollment-participant@example.test', '{"name":"Membership Participant","whatsapp_e164":"+5511999996502","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'membership-enrollment-sector@example.test', '{"name":"Membership Sector Leader","whatsapp_e164":"+5511999996503","availability_windows":[{"day_of_week":3,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'membership-enrollment-other@example.test', '{"name":"Other Membership Participant","whatsapp_e164":"+5511999996504","availability_windows":[{"day_of_week":4,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb);

update public.profiles set role = 'lider_cidade'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
update public.profiles set role = 'lider_setor'
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select public.save_region_partition(
	jsonb_build_array((
		select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
		from public.urban_perimeters
	)),
	1,
	array['#123456']::text[]
);
select public.generate_subdivision_drafts(
	(select id from public.region_sets where status = 'draft'),
	1,
	2
);
select public.publish_region_partition((select id from public.region_sets where status = 'draft'));

reset role;
insert into public.subdivision_memberships (participant_id, subdivision_id)
values (
	'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
	(select id from public.subdivisions where subdivision_number = 1)
);
set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select throws_ok(
	$$select public.set_my_subdivision_membership((select id from public.subdivisions limit 1))$$,
	'42501',
	null,
	'city leaders cannot create participant memberships through the self-service operation'
);

set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';
select is(
	(public.set_my_subdivision_membership((select id from public.subdivisions where subdivision_number = 1))->>'changed')::boolean,
	true,
	'participant can enroll in a subdivision from the published map'
);
select is(
	(public.get_my_active_subdivision_membership()->>'subdivisionId')::uuid,
	(select id from public.subdivisions where subdivision_number = 1),
	'participant can read their own active membership'
);
select is(
	(public.set_my_subdivision_membership((select id from public.subdivisions where subdivision_number = 2))->>'changed')::boolean,
	true,
	'participant can switch to another subdivision in the published map'
);
select is(
	(select count(*)::bigint from public.subdivision_memberships where participant_id = auth.uid() and released_at is null),
	1::bigint,
	'switching leaves exactly one active membership'
);
select is(
	(select count(*)::bigint from public.subdivision_memberships where participant_id = auth.uid() and released_at is not null),
	1::bigint,
	'switching preserves the previous membership as history'
);
select is(
	(public.set_my_subdivision_membership((select id from public.subdivisions where subdivision_number = 2))->>'changed')::boolean,
	false,
	'reselecting the current subdivision is idempotent'
);
select is(
	(select count(*)::bigint from public.subdivision_memberships where participant_id = auth.uid()),
	2::bigint,
	'idempotent selection does not append redundant history'
);
select is(
	(select count(*)::bigint from public.subdivision_memberships),
	2::bigint,
	'participant membership reads do not expose another participant history'
);
select throws_ok(
	$$select public.set_my_subdivision_membership('ffffffff-ffff-4fff-8fff-ffffffffffff')$$,
	'23514',
	null,
	'participant cannot enroll in a subdivision outside the published map'
);
select is(
	(public.get_my_active_subdivision_membership()->>'subdivisionId')::uuid,
	(select id from public.subdivisions where subdivision_number = 2),
	'invalid destination leaves the previous active membership unchanged'
);
select throws_ok(
	$$insert into public.subdivision_memberships (participant_id, subdivision_id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', (select id from public.subdivisions where subdivision_number = 1))$$,
	'42501',
	null,
	'authenticated users cannot bypass the membership operation with direct inserts'
);
select is(
	(select count(*)::bigint from public.subdivision_memberships where participant_id = auth.uid()),
	2::bigint,
	'participants can see only their own membership history'
);

set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3';
select throws_ok(
	$$select public.set_my_subdivision_membership((select id from public.subdivisions where subdivision_number = 1))$$,
	'42501',
	null,
	'sector leaders cannot enroll through the participant self-service operation'
);

select * from finish();
rollback;

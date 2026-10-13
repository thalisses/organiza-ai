begin;
select plan(18);

select ok(
	to_regprocedure('public.publish_region_partition(uuid)') is not null,
	'the city leader can publish a completely validated region draft'
);
select ok(
	has_function_privilege('authenticated', 'public.publish_region_partition(uuid)', 'execute'),
	'authenticated users can invoke the publication workflow'
);
select ok(
	not has_function_privilege('anon', 'public.publish_region_partition(uuid)', 'execute'),
	'anonymous users cannot publish a region set'
);

insert into auth.users (id, email, raw_user_meta_data)
values
	(
		'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
		'publish-participant@example.test',
		'{"name":"Participante Publicação","whatsapp_e164":"+5511999996301","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	),
	(
		'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
		'publish-city-leader@example.test',
		'{"name":"Liderança Publicação","whatsapp_e164":"+5511999996302","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	);

update public.profiles
set role = 'lider_cidade'
where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';

set local role anon;
select throws_ok(
	$$select public.publish_region_partition('00000000-0000-4000-8000-000000000001')$$,
	'42501',
	null,
	'anonymous users cannot publish'
);

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select throws_ok(
	$$select public.publish_region_partition('00000000-0000-4000-8000-000000000001')$$,
	'42501',
	null,
	'participants cannot publish'
);

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select ok(
	public.save_region_partition(
		jsonb_build_array((
			select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
			from public.urban_perimeters
		)),
		1,
		array['#123456']::text[]
	) is not null,
	'city leader creates a valid region draft'
);
select public.generate_subdivision_drafts(
	(select id from public.region_sets where status = 'draft'),
	1,
	2
);
select is(
	(
		select public.publish_region_partition(id)->>'status'
		from public.region_sets where status = 'draft'
	),
	'published',
	'city leader publishes a complete PostGIS-validated region and subdivision set'
);
select is(
	(select count(*)::bigint from public.region_sets where status = 'published'),
	1::bigint,
	'one region set becomes published'
);
select ok(
	(select published_at is not null from public.region_sets where status = 'published'),
	'publication time is recorded'
);

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
select results_eq(
	$$select count(*)::bigint from public.region_sets where status = 'published'$$,
	array[1::bigint],
	'participants can read the published region set'
);
select results_eq(
	$$select count(*)::bigint from public.regions$$,
	array[1::bigint],
	'participants can read published regions'
);
select results_eq(
	$$select count(*)::bigint from public.subdivisions$$,
	array[2::bigint],
	'participants can read generated published subdivisions'
);
select is(
	(select public.get_visible_region_set()->>'status'),
	'published',
	'the RLS-scoped map loader returns the participant-visible publication'
);

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
select ok(
	public.save_region_partition(
		jsonb_build_array((
			select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
			from public.urban_perimeters
		)),
		1,
		array['#654321']::text[]
	) is not null,
	'city leader can prepare a future draft without replacing the current publication'
);
select is(
	(select public.get_visible_region_set()->>'status'),
	'draft',
	'city leader sees the draft ahead of the already-published set'
);
select throws_ok(
	$$select public.publish_region_partition((select id from public.region_sets where status = 'draft'))$$,
	'23514',
	null,
	'replacing an already-published map is refused pending a realignment workflow'
);
select is(
	(select count(*)::bigint from public.region_sets where status = 'published'),
	1::bigint,
	'a failed replacement leaves the current publication unchanged'
);
select is(
	(select count(*)::bigint from public.region_sets where status = 'draft'),
	1::bigint,
	'a rejected replacement draft remains available for follow-up'
);

select * from finish();
rollback;
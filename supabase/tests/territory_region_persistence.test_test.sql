begin;
select plan(21);

select has_table('public', 'region_sets', 'region sets persist draft and publication state');
select has_table('public', 'regions', 'regions persist stable ids and geometries');
select has_table('public', 'subdivisions', 'subdivisions persist stable ids under each region');
select has_table('public', 'sector_leader_regions', 'sector leaders can be associated with multiple regions');
select ok(
	to_regprocedure('public.save_region_partition(jsonb,integer,text[])') is not null,
	'city leaders can save a validated region draft'
);
select ok(
	has_function_privilege('authenticated', 'public.save_region_partition(jsonb,integer,text[])', 'execute'),
	'authenticated users can invoke the save function'
);
select ok(
	not has_function_privilege('anon', 'public.save_region_partition(jsonb,integer,text[])', 'execute'),
	'anonymous users cannot save region drafts'
);

insert into auth.users (id, email, raw_user_meta_data)
values
	(
		'99999999-9999-4999-8999-999999999991',
		'region-draft-participant@example.test',
		'{"name":"Participante Draft","whatsapp_e164":"+5511999997001","availability_windows":[{"day_of_week":1,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	),
	(
		'99999999-9999-4999-8999-999999999992',
		'region-draft-city-leader@example.test',
		'{"name":"Liderança Draft","whatsapp_e164":"+5511999997002","availability_windows":[{"day_of_week":2,"starts_at":"09:00","ends_at":"12:00"}]}'::jsonb
	);

update public.profiles
set role = 'lider_cidade'
where id = '99999999-9999-4999-8999-999999999992';

set local role anon;
select throws_ok(
	$$select * from public.region_sets$$,
	'42501',
	null,
	'anonymous users cannot read region drafts'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999991';
select throws_ok(
	$$select public.save_region_partition('[]'::jsonb, 1, array['#123456']::text[])$$,
	'42501',
	null,
	'participants cannot save region drafts'
);

set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999992';
select ok(
	public.save_region_partition(
		jsonb_build_array((
			select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
			from public.urban_perimeters
		)),
		1,
		array['#123456']::text[]
	) is not null,
	'city leaders can save a PostGIS-validated region draft'
);
select results_eq(
	$$select status from public.region_sets$$,
	array['draft']::text[],
	'saving creates a draft rather than publishing it'
);
select results_eq(
	$$select region_number::text || ':' || color from public.regions$$,
	array['1:#123456']::text[],
	'the draft stores its region number and selected color'
);
select is(
	(select count(*)::bigint from public.regions where extensions.st_srid(geom) <> 4326 or not extensions.st_isvalid(geom) or extensions.geometrytype(geom) <> 'MULTIPOLYGON'),
	0::bigint,
	'region geometries are normalized to valid MultiPolygon WGS84'
);

reset role;
create temporary table initial_region_ids as
	select id, region_number from public.regions;
grant select on initial_region_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999992';
select public.save_region_partition(
	jsonb_build_array((
		select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
		from public.urban_perimeters
	)),
	1,
	array['#654321']::text[]
);
select results_eq(
	$$select id::text from public.regions$$,
	$$select id::text from initial_region_ids$$,
	'updating a draft region preserves its stable id'
);
select results_eq(
	$$select color from public.regions$$,
	array['#654321']::text[],
	'updating a draft applies the selected color'
);

set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999991';
select results_eq(
	$$select count(*)::bigint from public.region_sets$$,
	array[0::bigint],
	'participants cannot read unpublished region drafts'
);

set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999992';
select results_eq(
	$$select count(*)::bigint from public.region_sets$$,
	array[1::bigint],
	'city leaders can read their region draft'
);
select ok(
	not has_table_privilege('authenticated', 'public.regions', 'insert'),
	'authenticated users cannot write region geometries directly'
);
select throws_ok(
	$$select public.save_region_partition(
		jsonb_build_array(extensions.st_asgeojson(extensions.st_setsrid(extensions.st_makeenvelope(-50, -22, -49, -21), 4326), 15)::jsonb),
		1,
		array['#123456']::text[]
	)$$,
	'23514',
	null,
	'out-of-boundary geometries cannot be saved as drafts'
);
select throws_ok(
	$$select public.save_region_partition(
		jsonb_build_array((
			select extensions.st_asgeojson(extensions.st_unaryunion(extensions.st_collect(geom)), 15)::jsonb
			from public.urban_perimeters
		)),
		1,
		array['not-a-color']::text[]
	)$$,
	'23514',
	null,
	'invalid colors are rejected before saving'
);
select results_eq(
	$$select count(*)::bigint from public.regions$$,
	array[1::bigint],
	'failed saves leave the existing draft unchanged'
);

select * from finish();
rollback;
begin;
select plan(9);

select has_table('public', 'subdivision_memberships', 'active participant subdivision memberships are persisted');
select ok(
	to_regprocedure('public.publish_region_partition(uuid,jsonb)') is not null,
	'published map replacement accepts a complete membership realignment map'
);
select has_column('public', 'subdivision_memberships', 'participant_id', 'active memberships have a participant owner');
select has_column('public', 'subdivision_memberships', 'released_at', 'membership history can mark released assignments');
select ok(
	to_regclass('public.subdivision_memberships_one_active_per_participant_idx') is not null,
	'each participant has a unique active subdivision membership'
);
select has_function('public', 'set_my_subdivision_membership', array['uuid'], 'participants can create or switch their own subdivision membership');
select has_function('public', 'get_my_active_subdivision_membership', array[]::text[], 'participants can load their own active subdivision membership');
select ok(
	has_function_privilege('authenticated', 'public.set_my_subdivision_membership(uuid)', 'execute')
	and not has_function_privilege('anon', 'public.set_my_subdivision_membership(uuid)', 'execute'),
	'only authenticated users can invoke their membership operation'
);
select ok(
	not has_table_privilege('authenticated', 'public.subdivision_memberships', 'insert')
	and not has_table_privilege('authenticated', 'public.subdivision_memberships', 'update'),
	'participants must use the validated membership RPC instead of direct table writes'
);

select * from finish();
rollback;
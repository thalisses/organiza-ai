create or replace function private.set_my_subdivision_membership(p_subdivision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_current_user_id uuid := (select auth.uid());
	v_city_id uuid;
	v_role text;
	v_published_region_set_id uuid;
	v_current_membership_id uuid;
	v_current_subdivision_id uuid;
	v_membership_id uuid;
	v_created_at timestamptz;
begin
	if v_current_user_id is null then
		raise exception 'Authentication is required to join a subdivision.' using errcode = '42501';
	end if;

	select profile.city_id, profile.role
	into v_city_id, v_role
	from public.profiles as profile
	where profile.id = v_current_user_id;

	if v_city_id <> '41152000-0000-4000-8000-000000000001'::uuid
		or v_role is distinct from 'participante'
	then
		raise exception 'Only Maringá participants can manage their own subdivision membership.' using errcode = '42501';
	end if;

	select region_set.id
	into v_published_region_set_id
	from public.region_sets as region_set
	where region_set.city_id = v_city_id
		and region_set.status = 'published'
	for share;

	if v_published_region_set_id is null then
		raise exception 'There is no published region map available for enrollment.' using errcode = '23514';
	end if;

	if not exists (
		select 1
		from public.subdivisions as subdivision
		join public.regions as region on region.id = subdivision.region_id
		where subdivision.id = p_subdivision_id
			and region.region_set_id = v_published_region_set_id
	) then
		raise exception 'The selected subdivision is not part of the published map.' using errcode = '23514';
	end if;

	select membership.id, membership.subdivision_id
	into v_current_membership_id, v_current_subdivision_id
	from public.subdivision_memberships as membership
	where membership.participant_id = v_current_user_id
		and membership.released_at is null
	for update;

	if v_current_membership_id is not null and v_current_subdivision_id = p_subdivision_id then
		return jsonb_build_object(
			'membershipId', v_current_membership_id,
			'subdivisionId', p_subdivision_id,
			'changed', false
		);
	end if;

	if v_current_membership_id is not null then
		update public.subdivision_memberships
		set released_at = now(),
			updated_at = now()
		where id = v_current_membership_id;
	end if;

	insert into public.subdivision_memberships (participant_id, subdivision_id)
	values (v_current_user_id, p_subdivision_id)
	returning id, created_at into v_membership_id, v_created_at;

	return jsonb_build_object(
		'membershipId', v_membership_id,
		'subdivisionId', p_subdivision_id,
		'createdAt', v_created_at,
		'changed', true
	);
end;
$$;

revoke all on function private.set_my_subdivision_membership(uuid) from public, anon, authenticated;
grant execute on function private.set_my_subdivision_membership(uuid) to authenticated;

create or replace function public.set_my_subdivision_membership(p_subdivision_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
	select private.set_my_subdivision_membership(p_subdivision_id);
$$;

revoke all on function public.set_my_subdivision_membership(uuid) from public, anon, authenticated;
grant execute on function public.set_my_subdivision_membership(uuid) to authenticated;

create or replace function public.get_my_active_subdivision_membership()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
	select jsonb_build_object(
		'membershipId', membership.id,
		'subdivisionId', subdivision.id,
		'regionNumber', region.region_number,
		'subdivisionNumber', subdivision.subdivision_number
	)
	from public.subdivision_memberships as membership
	join public.subdivisions as subdivision on subdivision.id = membership.subdivision_id
	join public.regions as region on region.id = subdivision.region_id
	join public.region_sets as region_set on region_set.id = region.region_set_id
	where membership.participant_id = (select auth.uid())
		and membership.released_at is null
		and region_set.status = 'published';
$$;

revoke all on function public.get_my_active_subdivision_membership() from public, anon, authenticated;
grant execute on function public.get_my_active_subdivision_membership() to authenticated;

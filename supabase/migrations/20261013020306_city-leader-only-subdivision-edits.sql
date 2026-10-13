revoke all on function private.save_subdivision_edits(uuid, jsonb) from public, anon, authenticated;

create or replace function private.save_city_leader_subdivision_edits(
	p_region_id uuid,
	p_subdivisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
begin
	if current_user_id is null or not exists (
		select 1
		from public.profiles as profile
		where profile.id = current_user_id
			and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and profile.role = 'lider_cidade'
	) then
		raise exception 'Only the city leader can edit subdivisions.' using errcode = '42501';
	end if;

	return private.save_subdivision_edits(p_region_id, p_subdivisions);
end;
$$;

revoke all on function private.save_city_leader_subdivision_edits(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.save_city_leader_subdivision_edits(uuid, jsonb) to authenticated;

create or replace function public.save_subdivision_edits(
	p_region_id uuid,
	p_subdivisions jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
	select private.save_city_leader_subdivision_edits(p_region_id, p_subdivisions);
$$;

revoke all on function public.save_subdivision_edits(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_subdivision_edits(uuid, jsonb) to authenticated;

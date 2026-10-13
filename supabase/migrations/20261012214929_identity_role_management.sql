create or replace function public.set_sector_leader(
	p_profile_id uuid,
	p_is_sector_leader boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
	updated_role text;
begin
	if current_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if not exists (
		select 1
		from public.profiles as actor
		where actor.id = current_user_id
			and actor.city_id = '41152000-0000-4000-8000-000000000001'::uuid
			and actor.role = 'lider_cidade'
	) then
		raise exception 'Only the city leader can manage sector leaders.' using errcode = '42501';
	end if;

	update public.profiles as target
	set role = case
		when p_is_sector_leader then 'lider_setor'
		else 'participante'
	end
	where target.id = p_profile_id
		and target.city_id = '41152000-0000-4000-8000-000000000001'::uuid
		and target.role in ('participante', 'lider_setor')
	returning target.role into updated_role;

	if not found then
		raise exception 'Target must be a participant or sector leader in Maringá.' using errcode = 'P0002';
	end if;

	return updated_role;
end;
$$;

revoke all on function public.set_sector_leader(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_sector_leader(uuid, boolean) to authenticated;

create or replace function public.cancel_act(p_act_id uuid) returns jsonb language plpgsql security invoker
set search_path = '' as $$ begin if not exists (
        select 1
        from public.profiles as profile
        where profile.id = (
                select auth.uid()
            )
            and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
            and profile.role in ('lider_cidade', 'lider_setor')
    ) then raise exception 'Only Maringa leaders with a city profile can cancel acts.' using errcode = '42501';
end if;
return private.cancel_act(p_act_id);
end;
$$;
revoke all on function public.cancel_act(uuid)
from public,
    anon,
    authenticated;
grant execute on function public.cancel_act(uuid) to authenticated;
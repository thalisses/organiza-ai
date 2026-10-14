create or replace function public.save_act(
        p_act_id uuid,
        p_title text,
        p_category text,
        p_other_detail text,
        p_starts_at timestamptz,
        p_longitude double precision,
        p_latitude double precision,
        p_meeting_address text,
        p_subdivision_id uuid
    ) returns jsonb language plpgsql security invoker
set search_path = '' as $$ begin if not exists (
        select 1
        from public.profiles as profile
        where profile.id = (
                select auth.uid()
            )
            and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
            and profile.role in ('lider_cidade', 'lider_setor')
    ) then raise exception 'Only Maringa leaders with a city profile can manage acts.' using errcode = '42501';
end if;
return private.save_act(
    p_act_id,
    p_title,
    p_category,
    p_other_detail,
    p_starts_at,
    p_longitude,
    p_latitude,
    p_meeting_address,
    p_subdivision_id
);
end;
$$;
revoke all on function public.save_act(
    uuid,
    text,
    text,
    text,
    timestamptz,
    double precision,
    double precision,
    text,
    uuid
)
from public,
    anon,
    authenticated;
grant execute on function public.save_act(
        uuid,
        text,
        text,
        text,
        timestamptz,
        double precision,
        double precision,
        text,
        uuid
    ) to authenticated;
create or replace function public.list_manageable_act_subdivisions() returns jsonb language plpgsql security invoker
set search_path = '' as $$ begin if not exists (
        select 1
        from public.profiles as profile
        where profile.id = (
                select auth.uid()
            )
            and profile.city_id = '41152000-0000-4000-8000-000000000001'::uuid
            and profile.role in ('lider_cidade', 'lider_setor')
    ) then raise exception 'Only Maringa leaders with a city profile can view manageable subdivisions.' using errcode = '42501';
end if;
return private.list_manageable_act_subdivisions();
end;
$$;
revoke all on function public.list_manageable_act_subdivisions()
from public,
    anon,
    authenticated;
grant execute on function public.list_manageable_act_subdivisions() to authenticated;
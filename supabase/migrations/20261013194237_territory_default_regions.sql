alter table public.region_sets
add column is_system_default boolean not null default false;
alter table public.region_sets
alter column created_by drop not null;
alter table public.region_sets
add constraint region_sets_default_creator_check check (
        (
            is_system_default
            and created_by is null
        )
        or (
            not is_system_default
            and created_by is not null
        )
    );
alter table public.regions
add column name text;
alter table public.regions
add constraint regions_name_check check (
        name is null
        or char_length(btrim(name)) between 1 and 120
    );
create or replace function private.ensure_maringa_default_regions() returns jsonb language plpgsql security definer
set search_path = '' as $$
declare v_current_user_id uuid := (
        select auth.uid()
    );
v_city_id uuid := '41152000-0000-4000-8000-000000000001'::uuid;
v_existing_region_set_id uuid;
v_region_set_id uuid;
v_boundary extensions.geometry;
v_geometries extensions.geometry [] := array [
	extensions.st_multi(extensions.st_geomfromtext('POLYGON((-51.931156 -23.4117595,-51.9329472 -23.4130378,-51.9329758 -23.415637,-51.9365521 -23.415742,-51.939642 -23.4156633,-51.9396706 -23.4171203,-51.9398995 -23.4190369,-51.9400568 -23.4253507,-51.9433756 -23.4254557,-51.9444056 -23.4345911,-51.9438334 -23.4355361,-51.9456644 -23.440996,-51.9422312 -23.4587392,-51.9123049 -23.4603139,-51.9017763 -23.4455108,-51.8904467 -23.4387911,-51.8874396 -23.4317116,-51.9075812 -23.4210009,-51.931156 -23.4117595))', 4326)),
	extensions.st_multi(extensions.st_geomfromtext('POLYGON((-51.9534371 -23.4225775,-51.9545815 -23.4159617,-51.9655678 -23.4191646,-51.9716618 -23.4183245,-51.9753239 -23.4239952,-51.9749234 -23.4330257,-51.9868825 -23.4511374,-51.9616196 -23.4574365,-51.9422312 -23.4587392,-51.9456644 -23.440996,-51.9438334 -23.4355361,-51.9444056 -23.4345911,-51.9439385 -23.4277229,-51.9466279 -23.4268829,-51.9534371 -23.4225775))', 4326)),
	extensions.st_multi(extensions.st_geomfromtext('POLYGON((-51.9128455 -23.3798297,-51.9270362 -23.3976861,-51.931156 -23.4117595,-51.9075812 -23.4210009,-51.8874396 -23.4317116,-51.8773688 -23.4027275,-51.8810309 -23.3981063,-51.9128455 -23.3798297))', 4326)),
	extensions.st_multi(extensions.st_geomfromtext('POLYGON((-51.9151402 -23.3788277,-51.9230367 -23.3721046,-51.9317342 -23.37284,-51.9493581 -23.379563,-51.9578267 -23.3800882,-51.9614888 -23.3811387,-51.9880391 -23.4098125,-51.9771672 -23.4178988,-51.9655678 -23.4191646,-51.9545815 -23.4159617,-51.9534371 -23.4225775,-51.9439385 -23.4277229,-51.9433756 -23.4254557,-51.9400568 -23.4253507,-51.939642 -23.4156633,-51.9329758 -23.415637,-51.9329472 -23.4130378,-51.931156 -23.4117595,-51.9270362 -23.3976861,-51.9128455 -23.3798297,-51.9151402 -23.3788277))', 4326))
];
v_names text [] := array [
	'GT Unicesumar e região',
	'GT Monções e região',
	'GT ALVORADA MORANGUEIRA',
	'GT UEM, Vila esperança e região'
];
v_colors text [] := array ['#0288D1', '#7CB342', '#F48FB1', '#FFEA00'];
v_region_index integer;
begin if v_current_user_id is null
or not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_current_user_id
        and profile.city_id = v_city_id
) then raise exception 'Only authenticated Maringá members can initialize the default map.' using errcode = '42501';
end if;
perform 1
from public.cities as city
where city.id = v_city_id for
update;
select region_set.id into v_existing_region_set_id
from public.region_sets as region_set
where region_set.city_id = v_city_id
    and region_set.status in ('draft', 'published')
order by case
        when region_set.status = 'draft' then 0
        else 1
    end
limit 1;
if v_existing_region_set_id is not null then return jsonb_build_object(
    'initialized',
    false,
    'regionSetId',
    v_existing_region_set_id
);
end if;
select extensions.st_unaryunion(extensions.st_collect(perimeter.geom)) into v_boundary
from public.urban_perimeters as perimeter
where perimeter.city_id = v_city_id;
if v_boundary is null then raise exception 'The official urban boundary is unavailable.' using errcode = 'P0002';
end if;
if cardinality(v_geometries) <> 4
or cardinality(v_names) <> 4
or cardinality(v_colors) <> 4 then raise exception 'The default region definition is incomplete.' using errcode = '23514';
end if;
for v_region_index in 1..4 loop if extensions.st_srid(v_geometries [v_region_index]) <> 4326
or extensions.st_geometrytype(v_geometries [v_region_index]) <> 'ST_MultiPolygon'
or not extensions.st_isvalid(v_geometries [v_region_index])
or not extensions.st_covers(v_boundary, v_geometries [v_region_index]) then raise exception 'Every default region must be a valid geometry inside the official urban boundary.' using errcode = '23514';
end if;
end loop;
insert into public.region_sets (
        city_id,
        status,
        target_region_count,
        created_by,
        is_system_default,
        published_at
    )
values (
        v_city_id,
        'published',
        4,
        null,
        true,
        now()
    )
returning id into v_region_set_id;
insert into public.regions (region_set_id, region_number, name, color, geom)
select v_region_set_id,
    region_input.ordinality::smallint,
    region_input.name,
    region_input.color,
    region_input.geom::extensions.geometry(MultiPolygon, 4326)
from unnest(v_names, v_colors, v_geometries) with ordinality as region_input(name, color, geom, ordinality);
return jsonb_build_object(
    'initialized',
    true,
    'regionSetId',
    v_region_set_id
);
end;
$$;
revoke all on function private.ensure_maringa_default_regions()
from public,
    anon,
    authenticated;
grant execute on function private.ensure_maringa_default_regions() to authenticated;
create or replace function public.ensure_maringa_default_regions() returns jsonb language sql security invoker
set search_path = '' as $$
select private.ensure_maringa_default_regions();
$$;
revoke all on function public.ensure_maringa_default_regions()
from public,
    anon,
    authenticated;
grant execute on function public.ensure_maringa_default_regions() to authenticated;
create or replace function public.get_visible_region_set() returns jsonb language plpgsql stable security invoker
set search_path = '' as $$
declare visible_set record;
region_payload jsonb;
published_region_set_id uuid;
begin
select region_set.id,
    region_set.city_id,
    region_set.status,
    region_set.target_region_count,
    region_set.published_at,
    region_set.is_system_default into visible_set
from public.region_sets as region_set
where region_set.status in ('draft', 'published')
order by case
        when region_set.status = 'draft' then 0
        else 1
    end
limit 1;
if not found then return null;
end if;
select region_set.id into published_region_set_id
from public.region_sets as region_set
where region_set.city_id = visible_set.city_id
    and region_set.status = 'published';
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id',
                region.id,
                'number',
                region.region_number,
                'name',
                region.name,
                'color',
                region.color,
                'geometry',
                extensions.st_asgeojson(region.geom, 15)::jsonb,
                'subdivisions',
                coalesce(
                    (
                        select jsonb_agg(
                                jsonb_build_object(
                                    'id',
                                    subdivision.id,
                                    'number',
                                    subdivision.subdivision_number,
                                    'geometry',
                                    extensions.st_asgeojson(subdivision.geom, 15)::jsonb
                                )
                                order by subdivision.subdivision_number
                            )
                        from public.subdivisions as subdivision
                        where subdivision.region_id = region.id
                    ),
                    '[]'::jsonb
                )
            )
            order by region.region_number
        ),
        '[]'::jsonb
    ) into region_payload
from public.regions as region
where region.region_set_id = visible_set.id;
return jsonb_build_object(
    'regionSetId',
    visible_set.id,
    'status',
    visible_set.status,
    'publishedAt',
    visible_set.published_at,
    'publishedRegionSetId',
    published_region_set_id,
    'targetRegionCount',
    visible_set.target_region_count,
    'isSystemDefault',
    visible_set.is_system_default,
    'regions',
    region_payload
);
end;
$$;
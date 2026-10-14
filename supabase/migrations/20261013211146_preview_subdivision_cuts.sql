create or replace function private.preview_subdivision_cuts(
        p_region_id uuid,
        p_base_token text,
        p_cuts jsonb
    ) returns jsonb language plpgsql stable security definer
set search_path = '' as $$
declare v_region extensions.geometry;
v_status text;
v_base_token text;
v_areas jsonb;
v_item jsonb;
v_target jsonb;
v_target_ref text;
v_target_geometry extensions.geometry;
v_line extensions.geometry;
v_boundary extensions.geometry;
v_parts extensions.geometry;
v_child record;
v_children jsonb;
v_lines jsonb := '[]'::jsonb;
v_report jsonb := '[]'::jsonb;
v_region_area double precision;
v_expected_area double precision;
v_area double precision;
v_coverage double precision;
v_ordinal integer;
v_mode text;
v_selection extensions.geometry;
begin if (
    select auth.uid()
) is null then raise exception 'Authentication is required.' using errcode = '42501';
end if;
select region.geom,
    region_set.status into v_region,
    v_status
from public.regions as region
    join public.region_sets as region_set on region_set.id = region.region_set_id
    join public.profiles as profile on profile.id = (
        select auth.uid()
    )
    and profile.city_id = region_set.city_id
    and profile.role = 'lider_cidade'
where region.id = p_region_id
    and region_set.status in ('draft', 'published');
if v_region is null then raise exception 'Only the city leader can preview cuts in an editable region.' using errcode = '42501';
end if;
if jsonb_typeof(p_cuts) is distinct
from 'array' then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
if octet_length(p_cuts::text) > 1048576
or jsonb_array_length(p_cuts) > 49 then raise exception 'CUT_LIMIT_EXCEEDED' using errcode = '23514';
end if;
select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'ref',
                subdivision.id::text,
                'geometry',
                extensions.st_asgeojson(subdivision.geom, 15)::jsonb
            )
            order by subdivision.subdivision_number
        ),
        '[]'::jsonb
    ) into v_areas
from public.subdivisions as subdivision
where subdivision.region_id = p_region_id;
v_base_token := md5(
    p_region_id::text || v_status || encode(extensions.st_asewkb(v_region), 'hex') || v_areas::text
);
if (
    jsonb_array_length(p_cuts) > 0
    and p_base_token is null
)
or (
    p_base_token is not null
    and p_base_token is distinct
    from v_base_token
) then raise exception 'DRAFT_CONFLICT' using errcode = '40001';
end if;
if p_cuts->0->>'targetRef' = 'region'
and p_cuts->0->>'mode' is distinct
from 'area' then v_areas := jsonb_build_array(
        jsonb_build_object(
            'ref',
            'region',
            'geometry',
            extensions.st_asgeojson(v_region, 15)::jsonb
        )
    );
elsif jsonb_array_length(v_areas) = 0 then v_areas := jsonb_build_array(
    jsonb_build_object(
        'ref',
        'root',
        'geometry',
        extensions.st_asgeojson(v_region, 15)::jsonb
    )
);
end if;
for v_item in
select value
from jsonb_array_elements(p_cuts) loop if jsonb_typeof(v_item) is distinct
from 'object'
    or jsonb_typeof(v_item->'targetRef') is distinct
from 'string'
    or jsonb_typeof(v_item->'line') is distinct
from 'object'
    or v_item->'line' ? 'crs' then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
if jsonb_array_length(v_areas) >= 50 then raise exception 'CUT_LIMIT_EXCEEDED' using errcode = '23514';
end if;
v_target_ref := v_item->>'targetRef';
v_mode := coalesce(v_item->>'mode', 'split');
if v_mode not in ('area', 'split') then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
select value into v_target
from jsonb_array_elements(v_areas)
where value->>'ref' = v_target_ref;
if v_mode = 'area'
and v_target_ref = 'region' then v_target := jsonb_build_object(
    'geometry',
    extensions.st_asgeojson(v_region, 15)::jsonb
);
end if;
if v_target is null then raise exception 'CUT_TARGET_NOT_FOUND' using errcode = '23514';
end if;
begin v_line := extensions.st_setsrid(
    extensions.st_geomfromgeojson((v_item->'line')::text),
    4326
);
exception
when others then raise exception 'CUT_INVALID' using errcode = '23514';
end;
if extensions.st_geometrytype(v_line) <> 'ST_LineString'
or extensions.st_ndims(v_line) <> 2
or extensions.st_npoints(v_line) > 10000
or not extensions.st_isvalid(v_line)
or not extensions.st_issimple(v_line)
or extensions.st_isempty(v_line)
or exists (
    select 1
    from extensions.st_dumppoints(v_line) as point
    where extensions.st_x(point.geom) not between -180 and 180
        or extensions.st_y(point.geom) not between -90 and 90
) then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
v_line := extensions.st_transform(v_line, 31982);
v_target_geometry := extensions.st_transform(
    extensions.st_setsrid(
        extensions.st_geomfromgeojson((v_target->'geometry')::text),
        4326
    ),
    31982
);
v_boundary := extensions.st_boundary(v_target_geometry);
if v_mode = 'area' then if v_target_ref <> 'region'
or extensions.st_npoints(v_line) < 3 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
begin v_selection := extensions.st_makepolygon(
    case
        when extensions.st_isclosed(v_line) then v_line
        else extensions.st_addpoint(v_line, extensions.st_startpoint(v_line))
    end
);
exception
when others then raise exception 'CUT_INVALID' using errcode = '23514';
end;
if not extensions.st_isvalid(v_selection)
or extensions.st_area(v_selection) <= 0 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
v_selection := extensions.st_multi(
    extensions.st_collectionextract(
        extensions.st_intersection(v_selection, v_target_geometry),
        3
    )
);
if extensions.st_isempty(v_selection)
or not extensions.st_isvalid(v_selection)
or extensions.st_npoints(v_selection) > 10000 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
v_areas := v_areas || jsonb_build_array(
    jsonb_build_object(
        'ref',
        'manual/' || (jsonb_array_length(v_lines) + 1),
        'geometry',
        extensions.st_asgeojson(extensions.st_transform(v_selection, 4326), 15)::jsonb
    )
);
v_lines := v_lines || jsonb_build_array(
    jsonb_build_object(
        'targetRef',
        'region',
        'mode',
        'area',
        'line',
        extensions.st_asgeojson(extensions.st_transform(v_line, 4326), 15)::jsonb
    )
);
continue;
end if;
if extensions.st_length(v_line) <= 0 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
if extensions.st_distance(extensions.st_startpoint(v_line), v_boundary) > 1
or extensions.st_distance(extensions.st_endpoint(v_line), v_boundary) > 1 then raise exception 'CUT_ENDPOINTS_OFF_BOUNDARY' using errcode = '23514';
end if;
v_line := extensions.st_setpoint(
    v_line,
    0,
    extensions.st_closestpoint(v_boundary, extensions.st_startpoint(v_line))
);
v_line := extensions.st_setpoint(
    v_line,
    extensions.st_npoints(v_line) - 1,
    extensions.st_closestpoint(v_boundary, extensions.st_endpoint(v_line))
);
if not extensions.st_issimple(v_line)
or extensions.st_isclosed(v_line) then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
if not extensions.st_covers(
    extensions.st_buffer(v_target_geometry, 0.0000001),
    v_line
) then raise exception 'CUT_OUTSIDE_TARGET' using errcode = '23514';
end if;
if extensions.st_length(extensions.st_intersection(v_line, v_boundary)) > 0.0000001 then raise exception 'CUT_FOLLOWS_BOUNDARY' using errcode = '23514';
end if;
v_parts := extensions.st_split(
    extensions.st_snap(v_target_geometry, v_line, 0.0000001),
    v_line
);
if extensions.st_numgeometries(v_parts) <> 2
or not extensions.st_isvalid(v_parts)
or extensions.st_area(
    extensions.st_symdifference(
        v_target_geometry,
        extensions.st_unaryunion(v_parts)
    )
) > 0.01
or extensions.st_area(
    extensions.st_intersection(
        extensions.st_geometryn(v_parts, 1),
        extensions.st_geometryn(v_parts, 2)
    )
) > 0.01 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
v_children := '[]'::jsonb;
v_ordinal := 0;
for v_child in
select part.geom
from extensions.st_dump(v_parts) as part
order by extensions.st_xmin(part.geom),
    extensions.st_ymin(part.geom),
    encode(extensions.st_asewkb(part.geom), 'hex') loop if extensions.st_geometrytype(v_child.geom) not in ('ST_Polygon', 'ST_MultiPolygon')
    or not extensions.st_isvalid(v_child.geom)
    or extensions.st_area(v_child.geom) <= 0
    or extensions.st_npoints(v_child.geom) > 10000 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
v_ordinal := v_ordinal + 1;
v_children := v_children || jsonb_build_array(
    jsonb_build_object(
        'ref',
        v_target_ref || '/' || v_ordinal,
        'geometry',
        extensions.st_asgeojson(
            extensions.st_multi(extensions.st_transform(v_child.geom, 4326)),
            15
        )::jsonb
    )
);
end loop;
select coalesce(
        jsonb_agg(
            value
            order by ordinality
        ),
        '[]'::jsonb
    ) into v_areas
from jsonb_array_elements(v_areas) with ordinality
where value->>'ref' <> v_target_ref;
v_areas := v_areas || v_children;
v_lines := v_lines || jsonb_build_array(
    jsonb_build_object(
        'targetRef',
        v_target_ref,
        'line',
        extensions.st_asgeojson(extensions.st_transform(v_line, 4326), 15)::jsonb
    )
);
end loop;
v_region_area := extensions.st_area(extensions.st_transform(v_region, 31982));
v_expected_area := v_region_area / jsonb_array_length(v_areas);
if v_expected_area <= 0 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
for v_item,
v_ordinal in
select value,
    ordinality::integer
from jsonb_array_elements(v_areas) with ordinality loop v_area := extensions.st_area(
        extensions.st_transform(
            extensions.st_setsrid(
                extensions.st_geomfromgeojson((v_item->'geometry')::text),
                4326
            ),
            31982
        )
    );
v_report := v_report || jsonb_build_array(
    v_item || jsonb_build_object(
        'number',
        v_ordinal,
        'areaSquareMeters',
        v_area,
        'deviationPercent',
        abs(v_area / v_expected_area - 1) * 100
    )
);
end loop;
select extensions.st_area(
        extensions.st_symdifference(
            extensions.st_transform(v_region, 31982),
            extensions.st_unaryunion(
                extensions.st_collect(
                    extensions.st_transform(
                        extensions.st_setsrid(
                            extensions.st_geomfromgeojson((value->'geometry')::text),
                            4326
                        ),
                        31982
                    )
                )
            )
        )
    ) into v_coverage
from jsonb_array_elements(v_areas);
if v_coverage > 0.01 then raise exception 'CUT_INVALID' using errcode = '23514';
end if;
return jsonb_build_object(
    'regionId',
    p_region_id,
    'baseToken',
    v_base_token,
    'subdivisions',
    v_report,
    'cuts',
    v_lines,
    'coverageDifferenceSquareMeters',
    v_coverage
);
end;
$$;
revoke all on function private.preview_subdivision_cuts(uuid, text, jsonb)
from public,
    anon,
    authenticated;
grant execute on function private.preview_subdivision_cuts(uuid, text, jsonb) to authenticated;
create or replace function public.preview_subdivision_cuts(
        p_region_id uuid,
        p_base_token text,
        p_cuts jsonb
    ) returns jsonb language sql stable security invoker
set search_path = '' as $$
select private.preview_subdivision_cuts(p_region_id, p_base_token, p_cuts);
$$;
revoke all on function public.preview_subdivision_cuts(uuid, text, jsonb)
from public,
    anon,
    authenticated;
grant execute on function public.preview_subdivision_cuts(uuid, text, jsonb) to authenticated;
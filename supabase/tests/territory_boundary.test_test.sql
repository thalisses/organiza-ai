begin;
select plan(12);
select has_table(
        'public',
        'urban_perimeters',
        'official urban perimeters are persisted for server validation'
    );
select has_column(
        'public',
        'urban_perimeters',
        'geom',
        'official perimeters have a geometry column'
    );
select results_eq(
        $$select area_name
        from public.urban_perimeters
        order by area_name $$,
            array ['Distrito Sede', 'Floriano', 'Iguatemi', 'Jardim São Domingos', 'Projeto Reviver', 'Venda Duzentos', 'ZEDE']::text [],
            'all seven official urban areas are persisted'
    );
select is(
        (
            select count(*)::bigint
            from public.urban_perimeters
            where extensions.st_srid(geom) <> 4326
                or not extensions.st_isvalid(geom)
        ),
        0::bigint,
        'all official geometries are valid WGS84 polygons'
    );
select is(
        (
            select round(
                    extensions.st_area(
                        extensions.st_unaryunion(
                            extensions.st_collect(extensions.st_transform(geom, 31982))
                        )
                    )::numeric,
                    2
                )
            from public.urban_perimeters
        ),
        192664215.74::numeric,
        'projected union area matches the verified official layer'
    );
select ok(
        (
            select relation.relrowsecurity
            from pg_class as relation
            where relation.oid = to_regclass('public.urban_perimeters')
        ),
        'official perimeters have row-level security enabled'
    );
select ok(
        has_table_privilege(
            'authenticated',
            'public.urban_perimeters',
            'select'
        ),
        'authenticated users can read the official perimeters'
    );
select ok(
        not has_table_privilege(
            'authenticated',
            'public.urban_perimeters',
            'insert'
        ),
        'authenticated users cannot insert official perimeters'
    );
select ok(
        not has_table_privilege(
            'authenticated',
            'public.urban_perimeters',
            'update'
        ),
        'authenticated users cannot update official perimeters'
    );
select ok(
        not has_table_privilege('anon', 'public.urban_perimeters', 'select'),
        'anonymous users cannot read official perimeters'
    );
set local role authenticated;
select results_eq(
        $$select count(*)::bigint
        from public.urban_perimeters $$,
            array [7::bigint],
            'authenticated users can query all seven official perimeters'
    );
reset role;
set local role anon;
select throws_ok(
        $$select *
        from public.urban_perimeters $$,
            '42501',
            null,
            'anonymous users are denied direct table access'
    );
select *
from finish();
rollback;
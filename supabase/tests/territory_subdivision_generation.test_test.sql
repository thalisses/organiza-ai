begin;
select plan(9);
create temporary table official_parent as
select extensions.st_unaryunion(extensions.st_collect(geom)) as geom
from public.urban_perimeters;
create temporary table generated_subdivisions as
select target.target_count,
    generated.subdivision_number,
    generated.subdivision_geometry,
    generated.area_square_meters,
    generated.deviation_percent
from official_parent as parent
    cross join (
        values (2),
            (3),
            (5),
            (7),
            (10)
    ) as target(target_count)
    cross join lateral private.generate_balanced_subdivisions(parent.geom, target.target_count) as generated;
select ok(
        to_regprocedure(
            'private.generate_balanced_subdivisions(extensions.geometry,integer)'
        ) is not null,
        'PostGIS can generate balanced subdivision candidates for a parent geometry'
    );
select results_eq(
        $$select target_count::text || ':' || count(*)::text
        from generated_subdivisions
        group by target_count
        order by target_count $$,
            array ['2:2', '3:3', '5:5', '7:7', '10:10']::text [],
            'the generator returns the requested subdivision count'
    );
select is(
        (
            select count(*)::bigint
            from generated_subdivisions
            where not extensions.st_isvalid(subdivision_geometry)
        ),
        0::bigint,
        'all generated geometries are valid'
    );
select is(
        (
            select count(*)::bigint
            from generated_subdivisions
            where extensions.st_srid(subdivision_geometry) <> 4326
                or extensions.geometrytype(subdivision_geometry) <> 'MULTIPOLYGON'
        ),
        0::bigint,
        'all generated geometries are WGS84 MultiPolygons'
    );
select ok(
        (
            select max(deviation_percent) <= 15
            from generated_subdivisions
        ),
        'all tested subdivisions stay within the 15 percent area tolerance'
    );
select ok(
        (
            select max(deviation_percent) < 0.01
            from generated_subdivisions
        ),
        'long-axis quantile cuts produce near-equal areas on the official urban union'
    );
select is(
        (
            select count(*)::bigint
            from generated_subdivisions as generated
                cross join official_parent as parent
            where extensions.st_area(
                    extensions.st_difference(
                        extensions.st_transform(generated.subdivision_geometry, 31982),
                        extensions.st_transform(parent.geom, 31982)
                    )
                ) > 0.01
        ),
        0::bigint,
        'generated subdivisions do not extend outside the official urban union'
    );
select is(
        (
            select count(*)::bigint
            from (
                    select generated.target_count
                    from generated_subdivisions as generated
                        cross join official_parent as parent
                    group by generated.target_count,
                        parent.geom
                    having extensions.st_area(
                            extensions.st_symdifference(
                                extensions.st_unaryunion(
                                    extensions.st_collect(
                                        extensions.st_transform(generated.subdivision_geometry, 31982)
                                    )
                                ),
                                extensions.st_transform(parent.geom, 31982)
                            )
                        ) > 0.01
                ) as uncovered_sets
        ),
        0::bigint,
        'generated subdivisions fully cover their parent within numeric tolerance'
    );
select is(
        (
            select count(*)::bigint
            from generated_subdivisions as first_child
                join generated_subdivisions as second_child on first_child.target_count = second_child.target_count
                and first_child.subdivision_number < second_child.subdivision_number
            where extensions.st_area(
                    extensions.st_intersection(
                        extensions.st_transform(first_child.subdivision_geometry, 31982),
                        extensions.st_transform(second_child.subdivision_geometry, 31982)
                    )
                ) > 0.01
        ),
        0::bigint,
        'generated subdivisions do not overlap by area'
    );
select *
from finish();
rollback;
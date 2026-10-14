begin;
select plan(18);
create temporary table cut_fixtures (
    name text primary key,
    geom extensions.geometry,
    blade extensions.geometry
);
insert into cut_fixtures
values (
        'straight',
        extensions.st_geomfromtext('POLYGON((0 0,100 0,100 100,0 100,0 0))', 31982),
        extensions.st_geomfromtext('LINESTRING(30 0,30 100)', 31982)
    ),
    (
        'segmented',
        extensions.st_geomfromtext('POLYGON((0 0,100 0,100 100,0 100,0 0))', 31982),
        extensions.st_geomfromtext('LINESTRING(30 0,40 25,20 75,30 100)', 31982)
    ),
    (
        'tangent',
        extensions.st_geomfromtext('POLYGON((0 0,100 0,100 100,0 100,0 0))', 31982),
        extensions.st_geomfromtext('LINESTRING(0 0,100 0)', 31982)
    ),
    (
        'near_miss',
        extensions.st_geomfromtext('POLYGON((0 0,100 0,100 100,0 100,0 0))', 31982),
        extensions.st_geomfromtext(
            'LINESTRING(30 0.00000001,30 99.99999999)',
            31982
        )
    ),
    (
        'hole',
        extensions.st_geomfromtext(
            'POLYGON((0 0,100 0,100 100,0 100,0 0),(40 40,40 60,60 60,60 40,40 40))',
            31982
        ),
        extensions.st_geomfromtext('LINESTRING(20 0,20 100)', 31982)
    ),
    (
        'multipart',
        extensions.st_geomfromtext(
            'MULTIPOLYGON(((0 0,100 0,100 100,0 100,0 0)),((200 0,300 0,300 100,200 100,200 0)))',
            31982
        ),
        extensions.st_geomfromtext('LINESTRING(30 0,30 100)', 31982)
    );
create temporary table cut_results as
select name,
    geom,
    extensions.st_split(geom, blade) as parts
from cut_fixtures;
select is(
        (
            select extensions.st_numgeometries(parts)
            from cut_results
            where name = 'straight'
        ),
        2,
        'a straight cut creates exactly two areas'
    );
select is(
        (
            select extensions.st_numgeometries(parts)
            from cut_results
            where name = 'segmented'
        ),
        2,
        'a line with successive points creates exactly two areas'
    );
select ok(
        (
            select abs(
                    extensions.st_area(extensions.st_geometryn(parts, 1)) - 5000
                ) > 750
            from cut_results
            where name = 'straight'
        ),
        'a valid manual cut can exceed the automatic area tolerance'
    );
select ok(
        (
            select extensions.st_area(
                    extensions.st_symdifference(geom, extensions.st_unaryunion(parts))
                ) <= 0.01
            from cut_results
            where name = 'segmented'
        ),
        'the segmented cut preserves complete coverage'
    );
select ok(
        (
            select extensions.st_area(
                    extensions.st_intersection(
                        extensions.st_geometryn(parts, 1),
                        extensions.st_geometryn(parts, 2)
                    )
                ) <= 0.01
            from cut_results
            where name = 'segmented'
        ),
        'the results do not overlap'
    );
select is(
        (
            select extensions.st_numgeometries(parts)
            from cut_results
            where name = 'tangent'
        ),
        1,
        'a boundary-only line does not divide the area'
    );
select is(
        (
            select extensions.st_numgeometries(parts)
            from cut_results
            where name = 'near_miss'
        ),
        1,
        'floating-point endpoint misses can prevent splitting'
    );
select is(
        (
            select extensions.st_numgeometries(
                    extensions.st_split(
                        extensions.st_snap(geom, blade, 0.0000001),
                        blade
                    )
                )
            from cut_fixtures
            where name = 'near_miss'
        ),
        2,
        'a sub-micrometer snap resolves endpoint precision'
    );
select ok(
        (
            select extensions.st_area(
                    extensions.st_symdifference(geom, extensions.st_unaryunion(parts))
                ) <= 0.01
                and extensions.st_numgeometries(parts) = 2
            from cut_results
            where name = 'hole'
        ),
        'a cut away from a hole preserves its area'
    );
select is(
        (
            select extensions.st_numgeometries(parts)
            from cut_results
            where name = 'multipart'
        ),
        3,
        'multipart splitting needs a two-area policy instead of silently discarding a component'
    );
create temporary table successive_cuts as with first_cut as (
    select (extensions.st_dump(parts)).geom as geom
    from cut_results
    where name = 'straight'
)
select (
        extensions.st_dump(
            extensions.st_split(
                geom,
                extensions.st_geomfromtext('LINESTRING(-1 50,101 50)', 31982)
            )
        )
    ).geom as geom
from first_cut;
select is(
        (
            select count(*)::integer
            from successive_cuts
        ),
        4,
        'three successive cuts can create four areas'
    );
select ok(
        (
            select extensions.st_area(
                    extensions.st_symdifference(
                        extensions.st_geomfromtext('POLYGON((0 0,100 0,100 100,0 100,0 0))', 31982),
                        extensions.st_unaryunion(extensions.st_collect(geom))
                    )
                ) <= 0.01
            from successive_cuts
        ),
        'successive cuts preserve the complete original area'
    );
select ok(
        (
            select bool_and(
                    extensions.st_isvalid(geom)
                    and extensions.st_area(geom) > 0
                )
            from successive_cuts
        ),
        'all successive results remain valid and nonempty'
    );
select ok(
        not extensions.st_issimple(
            extensions.st_geomfromtext('LINESTRING(0 0,100 100,0 100,100 0)', 31982)
        ),
        'self-crossing lines can be rejected before splitting'
    );
select ok(
        (
            select not extensions.st_covers(
                    geom,
                    extensions.st_geomfromtext('LINESTRING(0 50,50 110,100 50)', 31982)
                )
            from cut_fixtures
            where name = 'straight'
        ),
        'a line leaving the target can be rejected independently of the split result'
    );
select ok(
        (
            select not extensions.st_covers(
                    geom,
                    extensions.st_geomfromtext('LINESTRING(0 50,100 50)', 31982)
                )
            from cut_fixtures
            where name = 'hole'
        ),
        'a line crossing a hole is outside the target and must be rejected'
    );
create temporary table uem_cut as with source as (
    select extensions.st_transform(
            extensions.st_geomfromtext(
                'POLYGON((-51.9151402 -23.3788277,-51.9230367 -23.3721046,-51.9317342 -23.37284,-51.9493581 -23.379563,-51.9578267 -23.3800882,-51.9614888 -23.3811387,-51.9880391 -23.4098125,-51.9771672 -23.4178988,-51.9655678 -23.4191646,-51.9545815 -23.4159617,-51.9534371 -23.4225775,-51.9439385 -23.4277229,-51.9433756 -23.4254557,-51.9400568 -23.4253507,-51.939642 -23.4156633,-51.9329758 -23.415637,-51.9329472 -23.4130378,-51.931156 -23.4117595,-51.9270362 -23.3976861,-51.9128455 -23.3798297,-51.9151402 -23.3788277))',
                4326
            ),
            31982
        ) as geom
),
candidate as (
    select geom,
        extensions.st_makeline(
            extensions.st_setsrid(
                extensions.st_makepoint(
                    extensions.st_xmin(geom) - 100,
                    extensions.st_y(extensions.st_centroid(geom))
                ),
                31982
            ),
            extensions.st_setsrid(
                extensions.st_makepoint(
                    extensions.st_xmax(geom) + 100,
                    extensions.st_y(extensions.st_centroid(geom))
                ),
                31982
            )
        ) as line
    from source
),
clipped as (
    select geom,
        (
            extensions.st_dump(
                extensions.st_collectionextract(extensions.st_intersection(geom, line), 2)
            )
        ).geom as blade
    from candidate
),
longest as (
    select *
    from clipped
    order by extensions.st_length(blade) desc
    limit 1
)
select geom,
    blade,
    extensions.st_split(
        extensions.st_snap(geom, blade, 0.0000001),
        blade
    ) as parts
from longest;
select is(
        (
            select extensions.st_numgeometries(parts)
            from uem_cut
        ),
        2,
        'the real GT UEM geometry supports a boundary-to-boundary cut'
    );
select ok(
        (
            select extensions.st_isvalid(parts)
                and extensions.st_area(
                    extensions.st_symdifference(geom, extensions.st_unaryunion(parts))
                ) <= 0.01
            from uem_cut
        ),
        'GT UEM results are valid and preserve the region within existing precision'
    );
select *
from finish();
rollback;
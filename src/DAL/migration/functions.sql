-- FUNCTION: PolygonParts._mc_merge_polygons_aggregator(geometry, geometry)

-- DROP FUNCTION IF EXISTS "PolygonParts"._mc_merge_polygons_aggregator(geometry, geometry);

CREATE OR REPLACE FUNCTION "PolygonParts"._mc_merge_polygons_aggregator(
	state geometry,
	geom geometry)
    RETURNS geometry
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
BEGIN
    IF state IS NULL THEN
        RETURN geom;
    ELSE
		RETURN st_collect(st_collect(res), geom) FROM (
			SELECT ST_Difference(geom_dump, geom) as res
			FROM (
				SELECT (st_dump(state)).geom AS geom_dump
			) exploded_parts
		) exploded_parts_without_current;
    END IF;
END;
$BODY$;

ALTER FUNCTION "PolygonParts"._mc_merge_polygons_aggregator(geometry, geometry)
    OWNER TO postgres;


-- FUNCTION: PolygonParts._mc_merge_polygons_final(geometry)

-- DROP FUNCTION IF EXISTS "PolygonParts"._mc_merge_polygons_final(geometry);

CREATE OR REPLACE FUNCTION "PolygonParts"._mc_merge_polygons_final(
	state geometry)
    RETURNS geometry
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
BEGIN
    RETURN state;
END;
$BODY$;

ALTER FUNCTION "PolygonParts"._mc_merge_polygons_final(geometry)
    OWNER TO postgres;


-- Aggregate: mc_merge_polygons;

-- DROP AGGREGATE IF EXISTS "PolygonParts".mc_merge_polygons(geometry);

CREATE OR REPLACE AGGREGATE "PolygonParts".mc_merge_polygons(geometry) (
    SFUNC = "PolygonParts"._mc_merge_polygons_aggregator,
    STYPE = geometry ,
    FINALFUNC = "PolygonParts"._mc_merge_polygons_final,
    FINALFUNC_MODIFY = READ_ONLY,
    MFINALFUNC_MODIFY = READ_ONLY
);

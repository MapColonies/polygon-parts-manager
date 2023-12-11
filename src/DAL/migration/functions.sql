-- FUNCTION: PolygonParts._mc_merge_polygons_aggregator("PolygonParts".mc_merge_tuple, geometry, integer)

-- DROP FUNCTION IF EXISTS "PolygonParts"._mc_merge_polygons_aggregator("PolygonParts".mc_merge_tuple, geometry, integer);

CREATE OR REPLACE FUNCTION "PolygonParts"._mc_merge_polygons_aggregator(
	state "PolygonParts".mc_merge_tuple,
	part_geom geometry,
	id integer)
    RETURNS "PolygonParts".mc_merge_tuple
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE merge_tuple "PolygonParts".mc_merge_tuple;
BEGIN
    IF state IS NULL THEN
		merge_tuple.geom := part_geom;
		merge_tuple.ids := ARRAY[id];
    ELSE
		 SELECT ST_Collect(res_geom) AS geom,  array_remove(array_agg(state.ids[path_id]), NULL) || id AS ids
		 INTO merge_tuple
		 FROM (
			 -- TODO: there is no need to dump and re-assamble!
			SELECT exploded_parts.geom AS res_geom, COALESCE(path[1], 1) AS path_id
			FROM (
				SELECT (ST_Dump(state.geom)).*
			) exploded_parts
			WHERE NOT ST_Intersects(exploded_parts.geom, part_geom)
			UNION ALL
			SELECT ST_Difference(exploded_parts.geom, part_geom) AS res_geom, COALESCE(path[1], 1) AS path_id
			FROM (
				SELECT (ST_Dump(state.geom)).*
			) exploded_parts
			WHERE ST_Intersects(exploded_parts.geom, part_geom)
			UNION ALL
			SELECT part_geom AS res_geom, NULL AS path_id
		) exploded_parts_without_current
		WHERE NOT ST_IsEmpty(res_geom);
    END IF;
	RETURN merge_tuple;
END;
$BODY$;

ALTER FUNCTION "PolygonParts"._mc_merge_polygons_aggregator("PolygonParts".mc_merge_tuple, geometry, integer)
    OWNER TO postgres;


-- FUNCTION: PolygonParts._mc_merge_polygons_final("PolygonParts".mc_merge_tuple)

-- DROP FUNCTION IF EXISTS "PolygonParts"._mc_merge_polygons_final("PolygonParts".mc_merge_tuple);

CREATE OR REPLACE FUNCTION "PolygonParts"._mc_merge_polygons_final(
	state "PolygonParts".mc_merge_tuple)
    RETURNS "PolygonParts".mc_merge_tuple
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE merge_tuple "PolygonParts".mc_merge_tuple;
BEGIN
	SELECT state.geom AS geom, array_agg(state.ids[path[1]]) AS ids
	INTO merge_tuple
	FROM (
	SELECT (ST_Dump(state.geom)).path) q;
	
    RETURN merge_tuple;
END;
$BODY$;

ALTER FUNCTION "PolygonParts"._mc_merge_polygons_final("PolygonParts".mc_merge_tuple)
    OWNER TO postgres;


-- Aggregate: mc_merge_polygons;

-- DROP AGGREGATE IF EXISTS "PolygonParts".mc_merge_polygons(geometry, integer);

CREATE OR REPLACE AGGREGATE "PolygonParts".mc_merge_polygons(geometry, integer) (
    SFUNC = "PolygonParts"._mc_merge_polygons_aggregator,
    STYPE = "PolygonParts".mc_merge_tuple,
    FINALFUNC = "PolygonParts"._mc_merge_polygons_final,
    FINALFUNC_MODIFY = READ_ONLY,
    MFINALFUNC_MODIFY = READ_ONLY
);
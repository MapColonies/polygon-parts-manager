CREATE OR REPLACE PROCEDURE "PolygonParts".insert_part(r "PolygonParts".insert_part_record)
LANGUAGE plpgsql
AS $$
DECLARE
    is_valid_result RECORD;
    is_valid boolean;
    reason text;
BEGIN
    -- check validity of the input polygon geometry
    is_valid_result := ST_IsValidDetail(r.geom);

    is_valid := is_valid_result.valid;
    reason := is_valid_result.reason;

    IF NOT is_valid THEN
        RAISE EXCEPTION 'Invalid geometry: %', reason;
    END IF;

    -- check that input polygon extent is within the bbox of the srs (EPSG:4326)
    is_valid := ST_Extent(r.geom)@Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'));

    IF NOT is_valid THEN
        RAISE EXCEPTION 'Invalid geometry extent: %', ST_Extent(r.geom);
    END IF;
    
    -- insert the input record
    INSERT INTO "PolygonParts".parts("recordId", "productId", "productName", "productVersion", "sourceDateStartUTC", "sourceDateEndUTC", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, geom, "imageName", "productType", "srsName")
    VALUES(r.*);
END;
$$;

-- Usage example: CALL "PolygonParts".insert_part(('795813b2-5c1d-466e-8f19-11c30d395fcd', 'productId', 'productName', 'productVersion', '2022-08-22 02:08:10', '2022-08-22 02:08:10', 0.0001, 0.0001, 0.3, 0.3, 2.5, 2.5, 'sensors', NULL, 'Unclassified', 'description', 'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))', 'imageName', 'Orthophoto', 'srsName')::"PolygonParts".insert_part_record);


-- PROCEDURE: PolygonParts.update_polygon_parts()

-- DROP PROCEDURE IF EXISTS "PolygonParts".update_polygon_parts();

CREATE OR REPLACE PROCEDURE "PolygonParts".update_polygon_parts(
	)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
	drop table if exists tbl;
	create temp table if not exists tbl on commit delete rows as
	with unprocessed as (
		select "partId", "recordId", geom from "PolygonParts".parts where not "isProcessedPart" order by "partId"
	)
	select 
		t1."internalId",
		t1."partId",
		st_difference(t1.geom, st_union(t2.geom)) diff
	from (
		select pp."internalId", pp."partId", pp."recordId", pp.geom
		from "PolygonParts".polygon_parts pp
		join unprocessed
		on st_intersects(pp.geom, unprocessed.geom) and pp."recordId" = unprocessed."recordId"
		union all
		select NULL, "partId", "recordId", geom
		from unprocessed
	) t1
	inner join unprocessed t2
	on st_intersects(t1.geom, t2.geom) and t1."partId" < t2."partId" and t1."recordId" = t2."recordId"
	group by t1."internalId", t1."partId", t1."recordId", t1.geom;

	delete from "PolygonParts".polygon_parts as pp
	using tbl
	where pp."internalId" = tbl."internalId";

	with unprocessed as (
		select * from "PolygonParts".parts where not "isProcessedPart" order by "partId"
	), inserts as (
		select 
			"partId",
			diff
		from tbl
		where not st_isempty(diff)
	)
	insert into "PolygonParts".polygon_parts as pp ("partId", "recordId", "productId", "productName", "productVersion", "ingestionDateUTC", "sourceDateStartUTC", "sourceDateEndUTC", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, geom, "imageName", "productType", "srsName")
	select 
		"partId",
		"recordId",
		"productId",
		"productName",
		"productVersion",
		"ingestionDateUTC",
		"sourceDateStartUTC",
		"sourceDateEndUTC",
		"minResolutionDegree",
		"maxResolutionDegree",
		"minResolutionMeter",
		"maxResolutionMeter",
		"minHorizontalAccuracyCE90",
		"maxHorizontalAccuracyCE90",
		sensors,
		region,
		classification,
		description,
		(st_dump(diff)).geom as geom,
		"imageName",
		"productType",
		"srsName"
	from (
		select "partId", "recordId", "productId", "productName", "productVersion", "ingestionDateUTC", "sourceDateStartUTC", "sourceDateEndUTC", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, diff, "imageName", "productType", "srsName"
		from inserts
		left join "PolygonParts".parts
		using ("partId")
		union all
		select "partId", "recordId", "productId", "productName", "productVersion", "ingestionDateUTC", "sourceDateStartUTC", "sourceDateEndUTC", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, geom as diff, "imageName", "productType", "srsName"
		from unprocessed
		where "partId" not in (select "partId" from tbl)
	) inserting_parts;

	update "PolygonParts".parts
	set "isProcessedPart" = true
	where "isProcessedPart" = false;
END;
$BODY$;
ALTER PROCEDURE "PolygonParts".update_polygon_parts()
    OWNER TO postgres;


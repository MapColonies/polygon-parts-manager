CREATE OR REPLACE PROCEDURE "polygon_parts".insert_part(r "polygon_parts".insert_part_record)
LANGUAGE plpgsql
AS $$
DECLARE
    is_valid_result RECORD;
    is_valid boolean;
    reason text;
BEGIN
    -- check validity of the input polygon geometry
    is_valid_result := ST_IsValidDetail(r."geometry");

    is_valid := is_valid_result.valid;
    reason := is_valid_result.reason;

    IF NOT is_valid THEN
        RAISE EXCEPTION 'Invalid geometry: %', reason;
    END IF;

    -- check that input polygon extent is within the bbox of the srs (EPSG:4326)
    is_valid := ST_Extent(r."geometry")@Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'));

    IF NOT is_valid THEN
        RAISE EXCEPTION 'Invalid geometry extent: %', ST_Extent(r."geometry");
    END IF;
    
    -- insert the input record
    INSERT INTO "polygon_parts".parts("recordId", "id", "name", "updatedInVersion", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, "geometry")
    VALUES(r.*);
END;
$$;

-- Usage example: CALL "polygon_parts".insert_part(('795813b2-5c1d-466e-8f19-11c30d395fcd', '123', 'name', '5', '2022-08-22 02:08:10', '2022-08-22 02:08:10', 0.0001, 0.3, 0.3, 2.5, 'sensors', NULL, cities, 'description', 'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))')::"polygon_parts".insert_part_record);


-- PROCEDURE: polygon_parts.update_polygon_parts()

-- DROP PROCEDURE IF EXISTS "polygon_parts".update_polygon_parts();

CREATE OR REPLACE PROCEDURE "polygon_parts".update_polygon_parts(
	)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
	drop table if exists tbl;
	create temp table if not exists tbl on commit delete rows as
	with unprocessed as (
		select "partId", "recordId", "geometry" from "polygon_parts".parts where not "isProcessedPart" order by "partId"
	)
	select 
		t1."internalId",
		t1."partId",
		st_difference(t1."geometry", st_union(t2."geometry")) diff
	from (
		select pp."internalId", pp."partId", pp."recordId", pp."geometry"
		from "polygon_parts".polygon_parts pp
		join unprocessed
		on st_intersects(pp."geometry", unprocessed."geometry") and pp."recordId" = unprocessed."recordId"
		union all
		select NULL, "partId", "recordId", "geometry"
		from unprocessed
	) t1
	inner join unprocessed t2
	on st_intersects(t1."geometry", t2."geometry") and t1."partId" < t2."partId" and t1."recordId" = t2."recordId"
	group by t1."internalId", t1."partId", t1."recordId", t1."geometry";

	delete from "polygon_parts".polygon_parts as pp
	using tbl
	where pp."internalId" = tbl."internalId";

	with unprocessed as (
		select * from "polygon_parts".parts where not "isProcessedPart" order by "partId"
	), inserts as (
		select 
			"partId",
			diff
		from tbl
		where not st_isempty(diff)
	)
	insert into "polygon_parts".polygon_parts as pp ("partId", "recordId", "id", "name", "updatedInVersion", "ingestionDateUTC", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, "geometry")
	select 
		"partId",
		"recordId",
		"id",
		"name",
		"updatedInVersion",
		"ingestionDateUTC",
		"imagingTimeBeginUTC",
		"imagingTimeEndUTC",
		"resolutionDegree",
		"resolutionMeter",
		"sourceResolutionMeter",
		"horizontalAccuracyCE90",
		sensors,
		countries,
		cities,
		description,
		(st_dump(diff)).geom as "geometry"
	from (
		select "partId", "recordId", "id", "name", "updatedInVersion", "ingestionDateUTC", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, diff
		from inserts
		left join "polygon_parts".parts
		using ("partId")
		union all
		select "partId", "recordId", "id", "name", "updatedInVersion", "ingestionDateUTC", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, "geometry" as diff
		from unprocessed
		where "partId" not in (select "partId" from tbl)
	) inserting_parts;

	update "polygon_parts".parts
	set "isProcessedPart" = true
	where "isProcessedPart" = false;
END;
$BODY$;
ALTER PROCEDURE "polygon_parts".update_polygon_parts()
    OWNER TO postgres;


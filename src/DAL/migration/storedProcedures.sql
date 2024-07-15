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
    INSERT INTO "polygon_parts".parts("record_id", "product_id", "product_type", "id", "name", "updated_in_version", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry")
    VALUES(r.*);
END;
$$;

-- Usage example: CALL "polygon_parts".insert_part(('795813b2-5c1d-466e-8f19-11c30d395fcd','WORLD_BASE', 'OrthophotoBest', '123', 'name', '5', '2022-08-22 02:08:10', '2022-08-22 02:08:10', 0.0001, 0.3, 0.3, 2.5, 'sensors', NULL, cities, 'description', 'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))')::"polygon_parts".insert_part_record);


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
		select "part_id", "record_id", "geometry" from "polygon_parts".parts where not "is_processed_part" order by "part_id"
	)
	select 
		t1."internal_id",
		t1."part_id",
		st_difference(t1."geometry", st_union(t2."geometry")) diff
	from (
		select pp."internal_id", pp."part_id", pp."record_id", pp."geometry"
		from "polygon_parts".polygon_parts pp
		join unprocessed
		on st_intersects(pp."geometry", unprocessed."geometry") and pp."record_id" = unprocessed."record_id"
		union all
		select NULL, "part_id", "record_id", "geometry"
		from unprocessed
	) t1
	inner join unprocessed t2
	on st_intersects(t1."geometry", t2."geometry") and t1."part_id" < t2."part_id" and t1."record_id" = t2."record_id"
	group by t1."internal_id", t1."part_id", t1."record_id", t1."geometry";

	delete from "polygon_parts".polygon_parts as pp
	using tbl
	where pp."internal_id" = tbl."internal_id";

	with unprocessed as (
		select * from "polygon_parts".parts where not "is_processed_part" order by "part_id"
	), inserts as (
		select 
			"part_id",
			diff
		from tbl
		where not st_isempty(diff)
	)
	insert into "polygon_parts".polygon_parts as pp ("part_id", "record_id", "product_id", "product_type", "id", "name", "updated_in_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry")
	select 
		"part_id",
		"record_id",
		"product_id",
		"product_type",
		"id",
		"name",
		"updated_in_version",
		"ingestion_date_utc",
		"imaging_time_begin_utc",
		"imaging_time_end_utc",
		"resolution_degree",
		"resolution_meter",
		"source_resolution_meter",
		"horizontal_accuracy_ce_90",
		sensors,
		countries,
		cities,
		description,
		(st_dump(diff)).geom as "geometry"
	from (
		select "part_id", "record_id", "product_id", "product_type", "id", "name", "updated_in_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, diff
		from inserts
		left join "polygon_parts".parts
		using ("part_id")
		union all
		select "part_id", "record_id", "id", "name", "updated_in_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry" as diff
		from unprocessed
		where "part_id" not in (select "part_id" from tbl)
	) inserting_parts;

	update "polygon_parts".parts
	set "is_processed_part" = true
	where "is_processed_part" = false;
END;
$BODY$;
ALTER PROCEDURE "polygon_parts".update_polygon_parts()
    OWNER TO postgres;


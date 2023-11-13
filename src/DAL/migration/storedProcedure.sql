CREATE OR REPLACE PROCEDURE insert_polygon_part(r "PolygonParts".insert_polygon_part_record)
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

    -- create (if not exists) a temp table structure to hold results instersection result for the current input
    CREATE TEMPORARY TABLE IF NOT EXISTS selected_parts (
        is_empty_geom boolean NOT NULL,is_multi boolean NOT NULL, "internalId" integer NOT NULL, geom_intersections geometry(Polygon,4326) NOT NULL
    ) ON COMMIT DROP;

    -- insert intersecting polygon parts into a temp table
    INSERT INTO selected_parts
    SELECT ST_IsEmpty(geom_intersections) is_empty_geom, ST_NumGeometries(geom_intersections) > 1 is_multi, *
    FROM (
        SELECT "internalId", ST_Difference(geom, r.geom) geom_intersections
        FROM "PolygonParts".parts 
        WHERE ST_Intersects(geom, r.geom)
    ) q;

    -- insert multi polygons that are the result of intersection with the input polygon
    INSERT INTO "PolygonParts".parts(geom, "recordId", "productId", "productName", "productVersion", "sourceDateStart", "sourceDateEnd", "minResolutionDeg", "maxResolutionDeg", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, "imageName", "productType", "srsName")
    SELECT "parts_geom" geom, "recordId", "productId", "productName", "productVersion", "sourceDateStart", "sourceDateEnd", "minResolutionDeg", "maxResolutionDeg", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, "imageName", "productType", "srsName"
    FROM (SELECT (ST_Dump(geom_intersections)).geom parts_geom, p.*
        FROM selected_parts
        JOIN "PolygonParts".parts p
        ON selected_parts."internalId" = p."internalId" AND selected_parts.is_multi IS true) q;

    -- update geometries of polygon parts intersecting with input polygon
    UPDATE "PolygonParts".parts
    SET geom = selected_parts.geom_intersections
    FROM selected_parts
    WHERE parts."internalId" = selected_parts."internalId" AND selected_parts.is_empty_geom IS false AND selected_parts.is_multi IS false;
    
    -- delete completely covered polygon parts by the input polygon and multi polygon parts that were separated to it's composing parts.

    DELETE FROM "PolygonParts".parts
    WHERE (parts."internalId", true) IN (SELECT "internalId", is_empty_geom FROM selected_parts) OR
    (parts."internalId", true) IN (SELECT "internalId", is_multi FROM selected_parts);
    
    -- insert the input record
    INSERT INTO "PolygonParts".parts("recordId", "productId", "productName", "productVersion", "sourceDateStart", "sourceDateEnd", "minResolutionDeg", "maxResolutionDeg", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, geom, "imageName", "productType", "srsName")
    VALUES(r.*);

    -- clear the temp table
    TRUNCATE selected_parts;
END;
$$;

-- Usage example: CALL insert_polygon_part(('795813b2-5c1d-466e-8f19-11c30d395fcd', 'productId', 'productName', 'productVersion', '2022-08-22 02:08:10', '2022-08-22 02:08:10', 0.0001, 0.0001, 0.3, 0.3, 2.5, 2.5, 'sensors', NULL, 'Unclassified', 'description', 'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))', 'imageName', '', NULL)::"PolygonParts".insert_polygon_part_record);

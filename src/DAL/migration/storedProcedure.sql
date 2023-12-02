CREATE OR REPLACE PROCEDURE "PolygonParts".insert_polygon_part(r "PolygonParts".insert_polygon_part_record)
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
    INSERT INTO "PolygonParts".parts("recordId", "productId", "productName", "productVersion", "sourceDateStart", "sourceDateEnd", "minResolutionDeg", "maxResolutionDeg", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCE90", "maxHorizontalAccuracyCE90", sensors, region, classification, description, geom, "imageName", "productType", "srsName")
    VALUES(r.*);
END;
$$;

-- Usage example: CALL "PolygonParts".insert_polygon_part(('795813b2-5c1d-466e-8f19-11c30d395fcd', 'productId', 'productName', 'productVersion', '2022-08-22 02:08:10', '2022-08-22 02:08:10', 0.0001, 0.0001, 0.3, 0.3, 2.5, 2.5, 'sensors', NULL, 'Unclassified', 'description', 'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))', 'imageName', 'Orthophoto', 'srsName')::"PolygonParts".insert_polygon_part_record);

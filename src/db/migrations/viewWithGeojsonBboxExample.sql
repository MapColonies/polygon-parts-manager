SELECT "internal_id", "description", ST_AsGeoJSON(geometry, 9, 1)::json as geojson, ST_AsGeoJSON(geometry, 9, 1)::json->'bbox' as bBox
	FROM "polygon_parts".parts;

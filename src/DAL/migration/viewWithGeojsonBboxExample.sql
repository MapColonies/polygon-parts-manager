SELECT "internalId", "description", ST_AsGeoJSON(geom, 9, 1)::json as geojson, ST_AsGeoJSON(geom, 9, 1)::json->'bbox' as bBox
	FROM "PolygonParts".parts;

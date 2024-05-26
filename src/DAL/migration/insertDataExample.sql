-- Example with wkt geometry

INSERT INTO "polygon_parts".parts(
	"record_id", "id", "name", "updated_in_version", "imaging_time_begin_UTC", "imaging_time_end_UTC", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry")
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309', '123', 'worldWide','1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.072, 5, 5, 10, '1, 2, 3', 'world', 'miami', 'some example', ST_GeometryFromText('POLYGON((-180 -90,-180 90,180 90,180 -90,-180 -90))'));


-- Example with geojson geometry

INSERT INTO "polygon_parts".parts(
	"record_id", "id", "name", "updated_in_version", "imaging_time_begin_UTC", "imaging_time_end_UTC", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry")
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309', '123','worldWide', '1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.072, 5, 5, 10, '1, 2, 3', 'world', 'miami', 'some example', ST_GeomFromGeoJSON('{"coordinates": [[[-180, -90],[-180,90],[180,90],[180,-90],[-180,-90]]],"type": "Polygon"}'));

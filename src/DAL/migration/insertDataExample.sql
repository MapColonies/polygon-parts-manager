-- Example with wkt geometry

INSERT INTO "PolygonParts".parts(
	"recordId", "id", "name", "updatedInVersion", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, "geometry")
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309', '123', 'worldWide','1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.072, 5, 5, 10, '1, 2, 3', 'world', 'miami', 'some example', ST_GeometryFromText('POLYGON((-180 -90,-180 90,180 90,180 -90,-180 -90))'));


-- Example with geojson geometry

INSERT INTO "PolygonParts".parts(
	"recordId", "id", "name", "updatedInVersion", "imagingTimeBeginUTC", "imagingTimeEndUTC", "resolutionDegree", "resolutionMeter", "sourceResolutionMeter", "horizontalAccuracyCE90", sensors, countries, cities, description, "geometry")
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309', '123','worldWide', '1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.072, 5, 5, 10, '1, 2, 3', 'world', 'miami', 'some example', ST_GeomFromGeoJSON('{"coordinates": [[[-180, -90],[-180,90],[180,90],[180,-90],[-180,-90]]],"type": "Polygon"}'));

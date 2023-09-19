-- Example with wkt geometry



INSERT INTO "PolygonParts".parts(
	"recordId", "productId", "productName", "productVersion", "sourceStartDateUtc", "sourceEndDateUtc", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCe90", sensors, region, classification, description, geom, "imageName", "productType" )
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309','MosaicBest','orthphoto','1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.000000335276126861572, 0.072, 5, 5, 10, '1, 2, 3', 'world', 5, 'some example', ST_GeometryFromText('POLYGON((-180 -90,-180 90,180 90,180 -90,-180 -90))'), 'test', 'best');


-- Example with geojson geometry

INSERT INTO "PolygonParts".parts(
	"recordId", "productId", "productName", "productVersion", "sourceStartDateUtc", "sourceEndDateUtc", "minResolutionDegree", "maxResolutionDegree", "minResolutionMeter", "maxResolutionMeter", "minHorizontalAccuracyCe90", sensors, region, classification, description, geom, "imageName", "productType")
	VALUES ('1328b7b4-e4e5-4d7f-a00f-087a2fab6309', 'MosaicBest', 'orthophoto', '1.0', '2022-10-10 11:30:30', '2022-10-10 11:30:30', 0.000000335276126861572, 0.072, 5, 5, 10, '1, 2, 3', 'world', 5, 'some example', ST_GeomFromGeoJSON('{"coordinates": [[[-180, -90],[-180,90],[180,90],[180,-90],[-180,-90]]],"type": "Polygon"}'), 'test', 'best');
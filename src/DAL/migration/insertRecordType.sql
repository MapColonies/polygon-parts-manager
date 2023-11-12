CREATE TYPE insert_record_polygon_part AS (
	geom geometry(MultiPolygon,4326),
    featurecla character varying(15),
    scalerank integer,
    min_zoom double precision
);

CREATE TYPE "PolygonParts".insert_polygon_part_record AS (
    "recordId" uuid,
    "productId" text,
    "productName" text,
    "productVersion" text,
    "sourceStartDateUtc" timestamp with time zone,
    "sourceEndDateUtc" timestamp with time zone,
    "minResolutionDegree" numeric,
    "maxResolutionDegree" numeric,
    "minResolutionMeter" numeric,
    "maxResolutionMeter" numeric,
    "minHorizontalAccuracyCe90" real,
    "maxHorizontalAccuracyCe90" real,
    sensors text,
    region text,
    classification "PolygonParts".classification,
    description text,
    geom geometry(Polygon,4326),
    "imageName" text,
    "productType" "PolygonParts".product_type,
    "srsName" text
);

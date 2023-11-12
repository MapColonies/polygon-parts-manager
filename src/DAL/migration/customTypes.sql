-- Type: classification

-- DROP TYPE IF EXISTS "PolygonParts".classification;

CREATE TYPE "PolygonParts".classification AS ENUM
    ('Unclassified', 'Confidential', 'Secret', 'TopSecret');

ALTER TYPE "PolygonParts".classification
    OWNER TO postgres;


-- Type: product_type

-- DROP TYPE IF EXISTS "PolygonParts".product_type;

CREATE TYPE "PolygonParts".product_type AS ENUM
    ('Orthophoto', 'OrthophotoHistory', 'OrthophotoBest', 'RasterMap', 'RasterMapBest', 'RasterAid', 'RasterAidBest', 'RasterVector', 'RasterVectorBest');

ALTER TYPE "PolygonParts".product_type
    OWNER TO postgres;


-- Type: insert_polygon_part_record

-- DROP TYPE IF EXISTS "PolygonParts".insert_polygon_part_record;

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

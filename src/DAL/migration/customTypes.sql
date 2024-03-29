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


-- DROP TYPE IF EXISTS "PolygonParts".insert_part_record;

CREATE TYPE "PolygonParts".insert_part_record AS
(
	"recordId" uuid,
	"productId" text,
	"productName" text,
	"productVersion" text,
	"sourceDateStartUTC" timestamp with time zone,
	"sourceDateEndUTC" timestamp with time zone,
	"minResolutionDegree" numeric,
	"maxResolutionDegree" numeric,
	"minResolutionMeter" numeric,
	"maxResolutionMeter" numeric,
	"minHorizontalAccuracyCE90" real,
	"maxHorizontalAccuracyCE90" real,
	sensors text,
	region text,
	classification "PolygonParts".classification,
	description text,
	geom geometry(Polygon,4326),
	"imageName" text,
	"productType" "PolygonParts".product_type,
	"srsName" text
);

ALTER TYPE "PolygonParts".insert_part_record
    OWNER TO postgres;

-- DROP TYPE IF EXISTS "PolygonParts".insert_part_record;

CREATE TYPE "PolygonParts".insert_part_record AS
(
	"recordId" uuid,
	"id" text,
	"name" text,
	"updatedInVersion" text,
	"imagingTimeBeginUTC" timestamp with time zone,
	"imagingTimeEndUTC" timestamp with time zone,
	"resolutionDegree" numeric,
	"resolutionMeter" numeric,
	"sourceResolutionMeter" numeric,
	"horizontalAccuracyCE90" real,
	sensors text,
	countries text,
    cities text,
	description text,
	"geometry" geometry(Polygon,4326)
);

ALTER TYPE "PolygonParts".insert_part_record
    OWNER TO postgres;

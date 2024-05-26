-- DROP TYPE IF EXISTS "polygon_parts".insert_part_record;

CREATE TYPE "polygon_parts".insert_part_record AS
(
	"record_id" uuid,
	"id" text,
	"name" text,
	"updated_in_version" text,
	"imaging_time_begin_UTC" timestamp with time zone,
	"imaging_time_end_UTC" timestamp with time zone,
	"resolution_degree" numeric,
	"resolution_meter" numeric,
	"source_resolution_meter" numeric,
	"horizontal_accuracy_ce_90" real,
	sensors text,
	countries text,
    cities text,
	description text,
	"geometry" geometry(Polygon,4326)
);

ALTER TYPE "polygon_parts".insert_part_record
    OWNER TO postgres;

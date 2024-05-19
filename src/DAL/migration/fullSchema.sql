-- Table: PolygonParts.parts

-- DROP TABLE IF EXISTS "PolygonParts".parts;

CREATE TABLE IF NOT EXISTS "PolygonParts".parts
(
    "partId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "recordId" uuid NOT NULL,
    "id" text COLLATE pg_catalog."default",
    "name" text COLLATE pg_catalog."default",
    "updatedInVersion" text COLLATE pg_catalog."default",
    "ingestionDateUTC" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagingTimeBeginUTC" timestamp with time zone NOT NULL,
    "imagingTimeEndUTC" timestamp with time zone NOT NULL,
    "resolutionDegree" numeric NOT NULL,
    "resolutionMeter" numeric NOT NULL,
    "sourceResolutionMeter" numeric NOT NULL,
    "horizontalAccuracyCE90" real,
    sensors text COLLATE pg_catalog."default",
    countries text COLLATE pg_catalog."default",
    cities text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    "geometry" geometry(Polygon,4326) NOT NULL,
    "isProcessedPart" boolean NOT NULL DEFAULT false,
    CONSTRAINT parts_pkey PRIMARY KEY ("partId")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "PolygonParts".parts
    OWNER to postgres;
-- Index: parts_geometry_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_geometry_idx;

CREATE INDEX IF NOT EXISTS parts_geometry_idx
    ON "PolygonParts".parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS parts_ingestion_date_idx
    ON "PolygonParts".parts USING btree
    ("ingestionDateUTC" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS parts_resolution_degree_idx
    ON "PolygonParts".parts USING btree
    ("resolutionDegree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_resolution_meter_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS parts_resolution_meter_idx
    ON "PolygonParts".parts USING btree
    ("resolutionMeter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_part_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_part_id_idx;

CREATE INDEX IF NOT EXISTS parts_part_id_idx
    ON "PolygonParts".parts USING btree
    ("partId" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_record_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_record_id_idx;

CREATE INDEX IF NOT EXISTS parts_record_id_idx
    ON "PolygonParts".parts USING hash
    ("recordId")
    TABLESPACE pg_default;
-- Index: parts_imaging_time_end_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS parts_imaging_time_end_idx
    ON "PolygonParts".parts USING btree
    ("imagingTimeEndUTC" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_imaging_time_start_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS parts_imaging_time_start_idx
    ON "PolygonParts".parts USING btree
    ("imagingTimeBeginUTC" ASC NULLS LAST)
    TABLESPACE pg_default;


-- Table: PolygonParts.polygon_parts

-- DROP TABLE IF EXISTS "PolygonParts".polygon_parts;

CREATE TABLE IF NOT EXISTS "PolygonParts".polygon_parts
(
    "internalId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "partId" integer NOT NULL,
    "recordId" uuid NOT NULL,
    "id" text COLLATE pg_catalog."default",
    "name" text COLLATE pg_catalog."default",
    "updatedInVersion" text COLLATE pg_catalog."default",
    "ingestionDateUTC" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagingTimeBeginUTC" timestamp with time zone NOT NULL,
    "imagingTimeEndUTC" timestamp with time zone NOT NULL,
    "resolutionDegree" numeric NOT NULL,
    "resolutionMeter" numeric NOT NULL,
    "sourceResolutionMeter" numeric NOT NULL,
    "horizontalAccuracyCE90" real,
    sensors text COLLATE pg_catalog."default",
    countries text COLLATE pg_catalog."default",
    cities text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    "geometry" geometry(Polygon,4326) NOT NULL,
    CONSTRAINT polygon_parts_pkey PRIMARY KEY ("internalId")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "PolygonParts".polygon_parts
    OWNER to postgres;
-- Index: polygon_parts_geometry_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_geometry_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_geometry_idx
    ON "PolygonParts".polygon_parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: polygon_parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_ingestion_date_idx
    ON "PolygonParts".polygon_parts USING btree
    ("ingestionDateUTC" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_internal_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_internal_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_internal_id_idx
    ON "PolygonParts".polygon_parts USING btree
    ("internalId" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_resolution_degree_idx
    ON "PolygonParts".polygon_parts USING btree
    ("resolutionDegree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_resolution_meter_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_resolution_meter_idx
    ON "PolygonParts".polygon_parts USING btree
    ("resolutionMeter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_part_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_part_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_part_id_idx
    ON "PolygonParts".polygon_parts USING btree
    ("partId" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_record_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_record_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_record_id_idx
    ON "PolygonParts".polygon_parts USING hash
    ("recordId")
    TABLESPACE pg_default;
-- Index: polygon_parts_imaging_time_end_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_imaging_time_end_idx
    ON "PolygonParts".polygon_parts USING btree
    ("imagingTimeEndUTC" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_imaging_time_start_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_imaging_time_start_idx
    ON "PolygonParts".polygon_parts USING btree
    ("imagingTimeBeginUTC" ASC NULLS LAST)
    TABLESPACE pg_default;

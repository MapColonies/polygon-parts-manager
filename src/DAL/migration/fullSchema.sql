-- Table: polygon_parts.parts

-- DROP TABLE IF EXISTS "polygon_parts".parts;

CREATE TABLE IF NOT EXISTS "polygon_parts".parts
(
    "part_id" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "record_id" uuid NOT NULL,
    "product_id" text COLLATE pg_catalog."default",
    "product_type" text COLLATE pg_catalog."default",
    "id" text COLLATE pg_catalog."default",
    "name" text COLLATE pg_catalog."default",
    "updated_in_version" text COLLATE pg_catalog."default",
    "ingestion_date_utc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imaging_time_begin_utc" timestamp with time zone NOT NULL,
    "imaging_time_end_utc" timestamp with time zone NOT NULL,
    "resolution_degree" numeric NOT NULL,
    "resolution_meter" numeric NOT NULL,
    "source_resolution_meter" numeric NOT NULL,
    "horizontal_accuracy_ce_90" real,
    sensors text COLLATE pg_catalog."default",
    countries text COLLATE pg_catalog."default",
    cities text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    "geometry" geometry(Polygon,4326) NOT NULL,
    "is_processed_part" boolean NOT NULL DEFAULT false,
    CONSTRAINT parts_pkey PRIMARY KEY ("part_id")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "polygon_parts".parts
    OWNER to postgres;
-- Index: parts_geometry_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_geometry_idx;

CREATE INDEX IF NOT EXISTS parts_geometry_idx
    ON "polygon_parts".parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS parts_ingestion_date_idx
    ON "polygon_parts".parts USING btree
    ("ingestion_date_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_resolution_degree_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS parts_resolution_degree_idx
    ON "polygon_parts".parts USING btree
    ("resolution_degree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_resolution_meter_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS parts_resolution_meter_idx
    ON "polygon_parts".parts USING btree
    ("resolution_meter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_part_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_part_id_idx;

CREATE INDEX IF NOT EXISTS parts_part_id_idx
    ON "polygon_parts".parts USING btree
    ("part_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_record_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_record_id_idx;

CREATE INDEX IF NOT EXISTS parts_record_id_idx
    ON "polygon_parts".parts USING hash
    ("record_id")
    TABLESPACE pg_default;
-- Index: parts_product_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_product_id_idx;

CREATE INDEX IF NOT EXISTS parts_product_id_idx
    ON "polygon_parts".parts USING btree
    ("product_id")
    TABLESPACE pg_default;
-- Index: parts_product_type_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_product_type_idx;

CREATE INDEX IF NOT EXISTS parts_product_type_idx
    ON "polygon_parts".parts USING btree
    ("product_type")
    TABLESPACE pg_default;
-- Index: parts_imaging_time_end_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS parts_imaging_time_end_idx
    ON "polygon_parts".parts USING btree
    ("imaging_time_end_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_imaging_time_start_idx

-- DROP INDEX IF EXISTS "polygon_parts".parts_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS parts_imaging_time_start_idx
    ON "polygon_parts".parts USING btree
    ("imaging_time_begin_utc" ASC NULLS LAST)
    TABLESPACE pg_default;


-- Table: polygon_parts.polygon_parts

-- DROP TABLE IF EXISTS "polygon_parts".polygon_parts;

CREATE TABLE IF NOT EXISTS "polygon_parts".polygon_parts
(
    "internal_id" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "part_id" integer NOT NULL,
    "record_id" uuid NOT NULL,
    "product_id" text COLLATE pg_catalog."default" NOT NULL,
    "product_type" text COLLATE pg_catalog."default" NOT NULL,
    "id" text COLLATE pg_catalog."default",
    "name" text COLLATE pg_catalog."default",
    "updated_in_version" text COLLATE pg_catalog."default",
    "ingestion_date_utc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imaging_time_begin_utc" timestamp with time zone NOT NULL,
    "imaging_time_end_utc" timestamp with time zone NOT NULL,
    "resolution_degree" numeric NOT NULL,
    "resolution_meter" numeric NOT NULL,
    "source_resolution_meter" numeric NOT NULL,
    "horizontal_accuracy_ce_90" real,
    sensors text COLLATE pg_catalog."default",
    countries text COLLATE pg_catalog."default",
    cities text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    "geometry" geometry(Polygon,4326) NOT NULL,
    CONSTRAINT polygon_parts_pkey PRIMARY KEY ("internal_id")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "polygon_parts".polygon_parts
    OWNER to postgres;
-- Index: polygon_parts_geometry_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_geometry_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_geometry_idx
    ON "polygon_parts".polygon_parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: polygon_parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_ingestion_date_idx
    ON "polygon_parts".polygon_parts USING btree
    ("ingestion_date_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_internal_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_internal_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_internal_id_idx
    ON "polygon_parts".polygon_parts USING btree
    ("internal_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_resolution_degree_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_resolution_degree_idx
    ON "polygon_parts".polygon_parts USING btree
    ("resolution_degree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_resolution_meter_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_resolution_meter_idx
    ON "polygon_parts".polygon_parts USING btree
    ("resolution_meter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_part_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_part_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_part_id_idx
    ON "polygon_parts".polygon_parts USING btree
    ("part_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_record_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_record_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_record_id_idx
    ON "polygon_parts".polygon_parts USING hash
    ("record_id")
    TABLESPACE pg_default;
-- Index: polygon_parts_imaging_time_end_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_imaging_time_end_idx
    ON "polygon_parts".polygon_parts USING btree
    ("imaging_time_end_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_product_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_product_id_idx;

CREATE INDEX IF NOT EXISTS parts_product_id_idx
    ON "polygon_parts".parts USING btree
    ("product_id")
    TABLESPACE pg_default;
-- Index: parts_product_type_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_product_type_idx;

CREATE INDEX IF NOT EXISTS parts_product_type_idx
    ON "polygon_parts".parts USING btree
    ("product_type")
    TABLESPACE pg_default;
-- Index: polygon_parts_imaging_time_start_idx

-- DROP INDEX IF EXISTS "polygon_parts".polygon_parts_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_imaging_time_start_idx
    ON "polygon_parts".polygon_parts USING btree
    ("imaging_time_begin_utc" ASC NULLS LAST)
    TABLESPACE pg_default;

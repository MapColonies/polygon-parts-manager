-- Table: polygon_parts.bluemarble_orthophoto_parts

-- DROP TABLE IF EXISTS "polygon_parts".bluemarble_orthophoto_parts;

CREATE TABLE IF NOT EXISTS "polygon_parts".bluemarble_orthophoto_parts
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
    CONSTRAINT bluemarble_orthophoto_parts_pkey PRIMARY KEY ("part_id")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "polygon_parts".bluemarble_orthophoto_parts
    OWNER to postgres;
-- Index: bluemarble_orthophoto_p_geometry_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_geometry_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_geometry_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_ingestion_date_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_ingestion_date_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("ingestion_date_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_resolution_degree_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_resolution_degree_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("resolution_degree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_resolution_meter_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_resolution_meter_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("resolution_meter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_part_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_part_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_part_id_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("part_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_record_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_record_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_record_id_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING hash
    ("record_id")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_product_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_product_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_product_id_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("product_id")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_product_type_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_product_type_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_product_type_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("product_type")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_imaging_time_end_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_imaging_time_end_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("imaging_time_end_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_p_imaging_time_start_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_p_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_p_imaging_time_start_idx
    ON "polygon_parts".bluemarble_orthophoto_parts USING btree
    ("imaging_time_begin_utc" ASC NULLS LAST)
    TABLESPACE pg_default;


-- Table: polygon_parts.bluemarble_orthophoto_polygon_parts

-- DROP TABLE IF EXISTS "polygon_parts".bluemarble_orthophoto_polygon_parts;

CREATE TABLE IF NOT EXISTS "polygon_parts".bluemarble_orthophoto_polygon_parts
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
    CONSTRAINT bluemarble_orthophoto_polygon_parts_pkey PRIMARY KEY ("internal_id")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "polygon_parts".bluemarble_orthophoto_polygon_parts
    OWNER to postgres;
-- Index: bluemarble_orthophoto_pp_geometry_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_geometry_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_geometry_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING gist
    ("geometry")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_ingestion_date_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_ingestion_date_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("ingestion_date_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_internal_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_internal_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_internal_id_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("internal_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_resolution_degree_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_resolution_degree_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("resolution_degree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_resolution_meter_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_resolution_meter_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_resolution_meter_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("resolution_meter" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_part_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_part_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_part_id_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("part_id" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_record_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_record_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_record_id_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING hash
    ("record_id")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_imaging_time_end_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_imaging_time_end_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_imaging_time_end_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("imaging_time_end_utc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_product_id_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_product_id_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_product_id_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("product_id")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_product_type_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_product_type_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_product_type_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("product_type")
    TABLESPACE pg_default;
-- Index: bluemarble_orthophoto_pp_imaging_time_start_idx

-- DROP INDEX IF EXISTS "polygon_parts".bluemarble_orthophoto_pp_imaging_time_start_idx;

CREATE INDEX IF NOT EXISTS bluemarble_orthophoto_pp_imaging_time_start_idx
    ON "polygon_parts".bluemarble_orthophoto_polygon_parts USING btree
    ("imaging_time_begin_utc" ASC NULLS LAST)
    TABLESPACE pg_default;

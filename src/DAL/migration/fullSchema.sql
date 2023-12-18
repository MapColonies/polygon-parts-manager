-- Table: PolygonParts.parts

-- DROP TABLE IF EXISTS "PolygonParts".parts;

CREATE TABLE IF NOT EXISTS "PolygonParts".parts
(
    "partId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "recordId" uuid NOT NULL,
    "productId" text COLLATE pg_catalog."default",
    "productName" text COLLATE pg_catalog."default",
    "productVersion" text COLLATE pg_catalog."default",
    "ingestionDate" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceDateStart" timestamp with time zone NOT NULL,
    "sourceDateEnd" timestamp with time zone NOT NULL,
    "minResolutionDeg" numeric NOT NULL,
    "maxResolutionDeg" numeric NOT NULL,
    "minResolutionMeter" numeric NOT NULL,
    "maxResolutionMeter" numeric NOT NULL,
    "minHorizontalAccuracyCE90" real,
    "maxHorizontalAccuracyCE90" real,
    sensors text COLLATE pg_catalog."default",
    region text COLLATE pg_catalog."default",
    classification "PolygonParts".classification,
    description text COLLATE pg_catalog."default",
    geom geometry(Polygon,4326) NOT NULL,
    "imageName" text COLLATE pg_catalog."default",
    "productType" "PolygonParts".product_type NOT NULL DEFAULT 'Orthophoto'::"PolygonParts".product_type,
    "srsName" text COLLATE pg_catalog."default" NOT NULL DEFAULT 'GCS_WGS_1984'::text,
    "isProcessedPart" boolean NOT NULL DEFAULT false,
    CONSTRAINT parts_pkey PRIMARY KEY ("partId")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "PolygonParts".parts
    OWNER to postgres;
-- Index: parts_geom_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_geom_idx;

CREATE INDEX IF NOT EXISTS parts_geom_idx
    ON "PolygonParts".parts USING gist
    (geom)
    TABLESPACE pg_default;
-- Index: parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS parts_ingestion_date_idx
    ON "PolygonParts".parts USING btree
    ("ingestionDate" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_max_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_max_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS parts_max_resolution_degree_idx
    ON "PolygonParts".parts USING btree
    ("maxResolutionDeg" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_min_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_min_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS parts_min_resolution_degree_idx
    ON "PolygonParts".parts USING btree
    ("minResolutionDeg" ASC NULLS LAST)
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
-- Index: parts_source_date_end_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_source_date_end_idx;

CREATE INDEX IF NOT EXISTS parts_source_date_end_idx
    ON "PolygonParts".parts USING btree
    ("sourceDateEnd" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: parts_source_date_start_idx

-- DROP INDEX IF EXISTS "PolygonParts".parts_source_date_start_idx;

CREATE INDEX IF NOT EXISTS parts_source_date_start_idx
    ON "PolygonParts".parts USING btree
    ("sourceDateStart" ASC NULLS LAST)
    TABLESPACE pg_default;


-- Table: PolygonParts.polygon_parts

-- DROP TABLE IF EXISTS "PolygonParts".polygon_parts;

CREATE TABLE IF NOT EXISTS "PolygonParts".polygon_parts
(
    "internalId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "partId" integer NOT NULL,
    "recordId" uuid NOT NULL,
    "productId" text COLLATE pg_catalog."default",
    "productName" text COLLATE pg_catalog."default",
    "productVersion" text COLLATE pg_catalog."default",
    "ingestionDate" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceDateStart" timestamp with time zone NOT NULL,
    "sourceDateEnd" timestamp with time zone NOT NULL,
    "minResolutionDeg" numeric NOT NULL,
    "maxResolutionDeg" numeric NOT NULL,
    "minResolutionMeter" numeric NOT NULL,
    "maxResolutionMeter" numeric NOT NULL,
    "minHorizontalAccuracyCE90" real,
    "maxHorizontalAccuracyCE90" real,
    sensors text COLLATE pg_catalog."default",
    region text COLLATE pg_catalog."default",
    classification "PolygonParts".classification,
    description text COLLATE pg_catalog."default",
    geom geometry(Polygon,4326) NOT NULL,
    "imageName" text COLLATE pg_catalog."default",
    "productType" "PolygonParts".product_type NOT NULL DEFAULT 'Orthophoto'::"PolygonParts".product_type,
    "srsName" text COLLATE pg_catalog."default" NOT NULL DEFAULT 'GCS_WGS_1984'::text,
    CONSTRAINT polygon_parts_pkey PRIMARY KEY ("internalId")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "PolygonParts".polygon_parts
    OWNER to postgres;
-- Index: polygon_parts_geom_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_geom_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_geom_idx
    ON "PolygonParts".polygon_parts USING gist
    (geom)
    TABLESPACE pg_default;
-- Index: polygon_parts_ingestion_date_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_ingestion_date_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_ingestion_date_idx
    ON "PolygonParts".polygon_parts USING btree
    ("ingestionDate" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_internal_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_internal_id_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_internal_id_idx
    ON "PolygonParts".polygon_parts USING btree
    ("internalId" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_max_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_max_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_max_resolution_degree_idx
    ON "PolygonParts".polygon_parts USING btree
    ("maxResolutionDeg" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_min_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_min_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_min_resolution_degree_idx
    ON "PolygonParts".polygon_parts USING btree
    ("minResolutionDeg" ASC NULLS LAST)
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
-- Index: polygon_parts_source_date_end_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_source_date_end_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_source_date_end_idx
    ON "PolygonParts".polygon_parts USING btree
    ("sourceDateEnd" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: polygon_parts_source_date_start_idx

-- DROP INDEX IF EXISTS "PolygonParts".polygon_parts_source_date_start_idx;

CREATE INDEX IF NOT EXISTS polygon_parts_source_date_start_idx
    ON "PolygonParts".polygon_parts USING btree
    ("sourceDateStart" ASC NULLS LAST)
    TABLESPACE pg_default;

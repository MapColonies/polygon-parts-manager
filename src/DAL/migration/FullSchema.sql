-- Table: PolygonParts.parts

-- DROP TABLE IF EXISTS "PolygonParts".parts;

CREATE TABLE IF NOT EXISTS "PolygonParts".parts
(
    "internalId" integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "recordId" uuid NOT NULL,
    "productId" text COLLATE pg_catalog."default" NOT NULL,
    "productName" text COLLATE pg_catalog."default" NOT NULL,
    "productVersion" text COLLATE pg_catalog."default" NOT NULL,
    "ingestionDateUtc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceStartDateUtc" timestamp with time zone NOT NULL,
    "sourceEndDateUtc" timestamp with time zone NOT NULL,
    "minResolutionDegree" numeric NOT NULL,
    "maxResolutionDegree" numeric NOT NULL,
    "minResolutionMeter" numeric NOT NULL,
    "maxResolutionMeter" numeric NOT NULL,
    "minHorizontalAccuracyCe90" real,
    sensors text COLLATE pg_catalog."default" NOT NULL,
    region text COLLATE pg_catalog."default" NOT NULL,
    classification numeric NOT NULL,
    description text COLLATE pg_catalog."default",
    geom geometry(Polygon,4326) NOT NULL,
    "imageName" text COLLATE pg_catalog."default",
    "productType" text COLLATE pg_catalog."default" NOT NULL DEFAULT 'orthophotoBest'::text,
    CONSTRAINT generate_polygon_parts_pkey PRIMARY KEY ("internalId")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS "PolygonParts".parts
    OWNER to postgres;
-- Index: geom_idx

-- DROP INDEX IF EXISTS "PolygonParts".geom_idx;

CREATE INDEX IF NOT EXISTS geom_idx
    ON "PolygonParts".parts USING gist
    (geom)
    TABLESPACE pg_default;
-- Index: ingestion_date_idx

-- DROP INDEX IF EXISTS "PolygonParts".ingestion_date_idx;

CREATE INDEX IF NOT EXISTS ingestion_date_idx
    ON "PolygonParts".parts USING btree
    ("ingestionDateUtc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: internal_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".internal_id_idx;

CREATE INDEX IF NOT EXISTS internal_id_idx
    ON "PolygonParts".parts USING btree
    ("internalId" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: max_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".max_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS max_resolution_degree_idx
    ON "PolygonParts".parts USING btree
    ("maxResolutionDegree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: min_resolution_degree_idx

-- DROP INDEX IF EXISTS "PolygonParts".min_resolution_degree_idx;

CREATE INDEX IF NOT EXISTS min_resolution_degree_idx
    ON "PolygonParts".parts USING btree
    ("minResolutionDegree" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: record_id_idx

-- DROP INDEX IF EXISTS "PolygonParts".record_id_idx;

CREATE INDEX IF NOT EXISTS record_id_idx
    ON "PolygonParts".parts USING hash
    ("recordId")
    TABLESPACE pg_default;
-- Index: source_date_end_idx

-- DROP INDEX IF EXISTS "PolygonParts".source_date_end_idx;

CREATE INDEX IF NOT EXISTS source_date_end_idx
    ON "PolygonParts".parts USING btree
    ("sourceEndDateUtc" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: source_date_start_idx

-- DROP INDEX IF EXISTS "PolygonParts".source_date_start_idx;

CREATE INDEX IF NOT EXISTS source_date_start_idx
    ON "PolygonParts".parts USING btree
    ("sourceStartDateUtc" ASC NULLS LAST)
    TABLESPACE pg_default;
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartsValidations1762074152438 implements MigrationInterface {
    name = 'AddPartsValidations1762074152438'

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "polygon_parts"."base_parts" (
          "product_id"               text COLLATE "ucs_basic" NOT NULL,
          "product_type"             "polygon_parts"."product_type_enum" NOT NULL,
          "source_id"                text COLLATE "ucs_basic",
          "source_name"              text COLLATE "ucs_basic" NOT NULL,
          "product_version"          text COLLATE "ucs_basic" NOT NULL,
          "ingestion_date_utc"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "imaging_time_begin_utc"   TIMESTAMP WITH TIME ZONE NOT NULL,
          "imaging_time_end_utc"     TIMESTAMP WITH TIME ZONE NOT NULL,
          "resolution_degree"        numeric NOT NULL,
          "resolution_meter"         numeric NOT NULL,
          "source_resolution_meter"  numeric NOT NULL,
          "horizontal_accuracy_ce90" numeric NOT NULL,
          "sensors"                  text COLLATE "ucs_basic" NOT NULL,
          "countries"                text COLLATE "ucs_basic",
          "cities"                   text COLLATE "ucs_basic",
          "description"              text COLLATE "ucs_basic",
          "id"                       uuid NOT NULL,
          "catalog_id"               uuid NOT NULL,
          CONSTRAINT "base_product id"
              CHECK ("product_id" ~ '^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$'),
          CONSTRAINT "base_product version"
              CHECK ("product_version" ~ '^[1-9]\\d*(\\.(0|[1-9]\\d?))?$'),
          CONSTRAINT "base_imaging time begin utc"
              CHECK ("imaging_time_begin_utc" < now()),
          CONSTRAINT "base_imaging time end utc"
              CHECK ("imaging_time_end_utc" < now()),
          CONSTRAINT "base_resolution degree"
              CHECK ("resolution_degree" BETWEEN 0.000000167638063430786 AND 0.703125),
          CONSTRAINT "base_resolution meter"
              CHECK ("resolution_meter" BETWEEN 0.0185 AND 78271.52),
          CONSTRAINT "base_source resolution meter"
              CHECK ("source_resolution_meter" BETWEEN 0.0185 AND 78271.52),
          CONSTRAINT "base_horizontal accuracy ce90"
              CHECK ("horizontal_accuracy_ce90" BETWEEN 0.01 AND 4000),
          CONSTRAINT "base_parts_pkey" PRIMARY KEY ("id")
      );
    `);

    // --- Base indexes ---
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_product_id_idx"
      ON "polygon_parts"."base_parts" ("product_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_product_type_idx"
      ON "polygon_parts"."base_parts" ("product_type");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_ingestion_date_utc_idx"
      ON "polygon_parts"."base_parts" ("ingestion_date_utc");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_imaging_time_begin_utc_idx"
      ON "polygon_parts"."base_parts" ("imaging_time_begin_utc");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_imaging_time_end_utc_idx"
      ON "polygon_parts"."base_parts" ("imaging_time_end_utc");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_resolution_degree_idx"
      ON "polygon_parts"."base_parts" ("resolution_degree");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "base_parts_resolution_meter_idx"
      ON "polygon_parts"."base_parts" ("resolution_meter");
    `);

    // --- Validation table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "polygon_parts"."validation_parts" (
          "processed" boolean NOT NULL DEFAULT false,
          "footprint" geometry(Geometry, 4326) NOT NULL,
          CONSTRAINT "validation_footprint_type_chk"
              CHECK (GeometryType("footprint") IN ('POLYGON','MULTIPOLYGON')),
          CONSTRAINT "validation_footprint_srid_chk"
              CHECK (ST_SRID("footprint") = 4326),
          CONSTRAINT "validation_geometry_extent"
              CHECK (Box2D("footprint") @ Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))),
          CONSTRAINT "validation_parts_pkey" PRIMARY KEY ("id")
      )
      INHERITS ("polygon_parts"."base_parts");
    `);

    // --- Validation indexes ---
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_footprint_idx"
      ON "polygon_parts"."validation_parts" USING GIST ("footprint");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_processed_idx"
      ON "polygon_parts"."validation_parts" ("processed");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_id_idx"
      ON "polygon_parts"."validation_parts" ("id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_ingestion_date_utc_idx"
      ON "polygon_parts"."validation_parts" ("ingestion_date_utc");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_imaging_time_begin_utc_idx"
      ON "polygon_parts"."validation_parts" ("imaging_time_begin_utc");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_imaging_time_end_utc_idx"
      ON "polygon_parts"."validation_parts" ("imaging_time_end_utc");
    `);

    // --- Stored procedure: create_polygon_parts_validations_tables ---
await queryRunner.query(`
  CREATE OR REPLACE PROCEDURE polygon_parts.create_polygon_parts_validations_tables(IN qualified_identifier text)
  LANGUAGE plpgsql
  AS $BODY$
  DECLARE
      ident_parts   name[] := parse_ident(qualified_identifier)::name[];
      schema_name   text   := ident_parts[1];
      base_table    text   := ident_parts[2];
      child_table   text   := base_table;

      q_schema      text   := quote_ident(schema_name);
      q_child       text   := quote_ident(child_table);
      schm_child    text   := q_schema || '.' || q_child;

      child_exists  boolean;
      pk_exists     boolean;
  BEGIN
      IF schema_name IS NULL OR base_table IS NULL THEN
          RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier (schema.table)', qualified_identifier;
      END IF;

      EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

      -- Check if child table exists
      SELECT to_regclass(format('%I.%I', schema_name, child_table)) IS NOT NULL
      INTO child_exists;

      IF NOT child_exists THEN
          RAISE INFO 'Creating child table %', schm_child;
          EXECUTE format(
              'CREATE TABLE %s () INHERITS ("polygon_parts"."validation_parts")',
              schm_child
          );
      ELSE
          RAISE NOTICE 'Child table % already exists, skipping CREATE TABLE', schm_child;
      END IF;

      -- Ensure PRIMARY KEY(id) exists (not inherited)
      SELECT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = schema_name
            AND t.relname = child_table
            AND c.contype = 'p'
      )
      INTO pk_exists;

      IF NOT pk_exists THEN
          EXECUTE format(
              'ALTER TABLE %s ADD CONSTRAINT %I PRIMARY KEY ("id")',
              schm_child, child_table || '_pkey'
          );
      END IF;

      -- Indexes (idempotent)
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s USING GIST ("footprint")',
                     child_table || '_footprint_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("processed")',
                     child_table || '_processed_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("ingestion_date_utc")',
                     child_table || '_ingestion_date_utc_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("imaging_time_begin_utc")',
                     child_table || '_imaging_time_begin_utc_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("imaging_time_end_utc")',
                     child_table || '_imaging_time_end_utc_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("resolution_degree")',
                     child_table || '_resolution_degree_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("resolution_meter")',
                     child_table || '_resolution_meter_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("id")',
                     child_table || '_id_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("product_id")',
                     child_table || '_product_id_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("product_type")',
                     child_table || '_product_type_idx', schm_child);
  END;
  $BODY$;
`);

// --- Function: count_small_geoms ---
await queryRunner.query(`
  CREATE OR REPLACE FUNCTION polygon_parts.count_small_geoms(
      qualified_identifier TEXT,
      min_area_m2 DOUBLE PRECISION
  )
  RETURNS BIGINT
  LANGUAGE plpgsql
  AS $$
  DECLARE
      ident       name[] := parse_ident(qualified_identifier)::name[];
      schema_name TEXT;
      table_name  TEXT;
      sql         TEXT;
      result      BIGINT;
  BEGIN
      IF array_length(ident, 1) <> 2 THEN
          RAISE EXCEPTION 'Provide table as a qualified identifier: schema.table (got: %)', qualified_identifier;
      END IF;

      schema_name := ident[1];
      table_name  := ident[2];

      sql := format($q$
          SELECT COUNT(*)::bigint
          FROM (
              SELECT
                  ST_Area( ST_Transform( ST_WrapX(t.footprint, -180, 180), 6933 ) ) AS area_m2
              FROM %I.%I AS t
              WHERE t.footprint IS NOT NULL
                AND ST_IsValid(t.footprint) AND t.processed = 'false'
          ) AS a
          WHERE a.area_m2 < %L
      $q$, schema_name, table_name, min_area_m2);

      EXECUTE sql INTO result;
      RETURN result;
  END;
  $$;
`);

// --- Function: count_small_holes ---
await queryRunner.query(`
  CREATE OR REPLACE FUNCTION polygon_parts.count_small_holes(
      qualified_identifier TEXT,
      min_hole_area_m2 DOUBLE PRECISION
  )
  RETURNS BIGINT
  LANGUAGE plpgsql
  AS $$
  DECLARE
      ident       name[] := parse_ident(qualified_identifier)::name[];
      schema_name TEXT;
      table_name  TEXT;
      sql         TEXT;
      result      BIGINT;
  BEGIN
      IF array_length(ident, 1) <> 2 THEN
          RAISE EXCEPTION 'Provide table as a qualified identifier: schema.table (got: %)', qualified_identifier;
      END IF;

      schema_name := ident[1];
      table_name  := ident[2];

      sql := format($q$
          SELECT COUNT(*)::bigint
          FROM (
            SELECT
              ST_Area(ST_Transform(hole_poly, 6933)) AS hole_area_m2
            FROM %I.%I AS t
            CROSS JOIN LATERAL (
              SELECT (ST_Dump(ST_WrapX(t.footprint, -180, 180))).geom AS poly
            ) p
            CROSS JOIN LATERAL (
              SELECT (drr).geom AS ring, (drr).path AS path
              FROM (SELECT ST_DumpRings(p.poly) AS drr) q
            ) r
            CROSS JOIN LATERAL (
              SELECT ST_BuildArea(r.ring) AS hole_poly
            ) bp
            WHERE t.footprint IS NOT NULL
              AND ST_IsValid(t.footprint)
              AND t.processed = 'false'
              AND r.path[1] > 0
              AND NOT ST_IsEmpty(hole_poly)
          ) holes
          WHERE hole_area_m2 < %L
      $q$, schema_name, table_name, min_hole_area_m2);

      EXECUTE sql INTO result;
      RETURN result;
  END;
  $$;
`);

await queryRunner.query(`
CREATE OR REPLACE FUNCTION polygon_parts.resolutions_check(
    qualified_identifier_valid TEXT,   -- e.g. 'polygon_parts.valid'
    qualified_identifier_parts TEXT    -- e.g. 'polygon_parts.parts'
)
RETURNS TABLE (id text)
LANGUAGE plpgsql
AS $BODY$
DECLARE
    ident_v  name[] := parse_ident(qualified_identifier_valid)::name[];
    ident_p  name[] := parse_ident(qualified_identifier_parts)::name[];

    schema_valid TEXT;
    table_valid  TEXT;
    schema_parts TEXT;
    table_parts  TEXT;

    sql TEXT;
BEGIN
    -- Expect both as qualified identifiers: schema.table
    IF array_length(ident_v, 1) <> 2 THEN
        RAISE EXCEPTION 'Provide validation table as schema.table (got: %)', qualified_identifier_valid;
    END IF;
    IF array_length(ident_p, 1) <> 2 THEN
        RAISE EXCEPTION 'Provide parts table as schema.table (got: %)', qualified_identifier_parts;
    END IF;

    schema_valid := ident_v[1];
    table_valid  := ident_v[2];
    schema_parts := ident_p[1];
    table_parts  := ident_p[2];

    -- Build safe SQL with quoted identifiers
    sql := format($q$
        SELECT v.id
        FROM   %I.%I AS v
        WHERE  v.footprint IS NOT NULL
          AND  ST_IsValid(v.footprint)                  -- validity check FIRST
          AND  EXISTS (
                SELECT 1
                FROM   %I.%I AS p
                WHERE  p.resolution_degree < v.resolution_degree
                  AND  p.footprint && v.footprint       -- fast bbox prefilter (GiST)
                  AND  ST_Intersects(p.footprint, v.footprint)
          )
    $q$, schema_valid, table_valid, schema_parts, table_parts);

    RETURN QUERY EXECUTE sql;
END;
$BODY$;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "polygon_parts"."validation_parts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "polygon_parts"."base_parts" CASCADE;`);
    await queryRunner.query(`DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_validations_tables;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.count_small_geoms(TEXT, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.count_small_holes(TEXT, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.resolutions_check(TEXT, TEXT);
`);

  }
}

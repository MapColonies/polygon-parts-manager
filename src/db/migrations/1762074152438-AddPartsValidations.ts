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
          "catalog_id"               uuid NOT NULL,
          CONSTRAINT "product id"
              CHECK ("product_id" ~ '^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$'),
          CONSTRAINT "product version"
              CHECK ("product_version" ~ '^[1-9]\\d*(\\.(0|[1-9]\\d?))?$'),
          CONSTRAINT "imaging time begin utc"
              CHECK ("imaging_time_begin_utc" < now()),
          CONSTRAINT "imaging time end utc"
              CHECK ("imaging_time_end_utc" < now()),
          CONSTRAINT "imaging times" CHECK (
              "imaging_time_begin_utc" <= "imaging_time_end_utc"),
          CONSTRAINT "resolution degree"
              CHECK ("resolution_degree" BETWEEN 0.000000167638063430786 AND 0.703125),
          CONSTRAINT "resolution meter"
              CHECK ("resolution_meter" BETWEEN 0.0185 AND 78271.52),
          CONSTRAINT "source resolution meter"
              CHECK ("source_resolution_meter" BETWEEN 0.0185 AND 78271.52),
          CONSTRAINT "horizontal accuracy ce90"
              CHECK ("horizontal_accuracy_ce90" BETWEEN 0.01 AND 4000)
      );
    `);

    // --- Validation table ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "polygon_parts"."validation_parts" (
          "id"           text NOT NULL,
          "validated" boolean NOT NULL DEFAULT false,
          "footprint" geometry(Geometry, 4326) NOT NULL,
          CONSTRAINT "footprint"
              CHECK (GeometryType("footprint") IN ('POLYGON','MULTIPOLYGON')),
          CONSTRAINT "geometry extent"
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
      CREATE INDEX IF NOT EXISTS "validation_parts_validated_idx"
      ON "polygon_parts"."validation_parts" ("validated");
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_product_id_idx"
      ON "polygon_parts"."validation_parts" ("product_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_product_type_idx"
      ON "polygon_parts"."validation_parts" ("product_type");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_catalog_id_idx"
      ON "polygon_parts"."validation_parts" ("catalog_id");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_resolution_degree_idx"
      ON "polygon_parts"."validation_parts" ("resolution_degree");
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "validation_parts_resolution_meter_idx"
      ON "polygon_parts"."validation_parts" ("resolution_meter");
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

      -- Indexes (idempotent)
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s USING GIST ("footprint")',
                     child_table || '_footprint_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("validated")',
                     child_table || '_validated_idx', schm_child);

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

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("product_id")',
                     child_table || '_product_id_idx', schm_child);

      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s ("product_type")',
                     child_table || '_product_type_idx', schm_child);
    END;
    $BODY$;
  `);

  //Validate small geometries function
  await queryRunner.query(`
  -- Validate small geometries: count polygon components with area < min_area_m2 and return their part IDs
  CREATE OR REPLACE FUNCTION polygon_parts.validate_small_geometries(
    qualified_identifier TEXT,
    min_area_m2 DOUBLE PRECISION
  )
  RETURNS TABLE(count BIGINT, ids TEXT[])
  LANGUAGE plpgsql
  STABLE
  AS $func$
  DECLARE
    ident NAME[] := parse_ident(qualified_identifier)::NAME[];
    schema_name TEXT;
    table_name  TEXT;
    sql         TEXT;
  BEGIN
    IF array_length(ident, 1) <> 2 THEN
      RAISE EXCEPTION 'Provide table as schema.table (got: %)', qualified_identifier;
    END IF;

    schema_name := ident[1];
    table_name  := ident[2];

    sql := format($q$
      WITH polys AS (
        SELECT
          t.id::text AS part_id,
          (ST_Dump(t.footprint)).geom AS poly
        FROM %I.%I t
        WHERE ST_IsValid(t.footprint)
          AND t.validated = false
      ),
      small AS (
        SELECT part_id
        FROM polys
        WHERE ST_Area(ST_Transform(poly, 6933)) < %L
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM small) AS count,
        COALESCE((SELECT ARRAY_AGG(DISTINCT part_id) FROM small), ARRAY[]::text[]) AS ids
    $q$, schema_name, table_name, min_area_m2);

    RETURN QUERY EXECUTE sql;
  END;
  $func$;
  `);


  // --- Function: validate_small_holes ---
  await queryRunner.query(`
  CREATE OR REPLACE FUNCTION polygon_parts.validate_small_holes(
      qualified_identifier TEXT,
      min_hole_area_m2 DOUBLE PRECISION
  )
  RETURNS TABLE(count BIGINT, ids TEXT[])
  LANGUAGE plpgsql
  STABLE
  AS $func$
  DECLARE
    ident NAME[] := parse_ident(qualified_identifier)::NAME[];
    schema_name TEXT;
    table_name  TEXT;
    sql         TEXT;
  BEGIN
    IF array_length(ident, 1) <> 2 THEN
      RAISE EXCEPTION 'Provide table as schema.table (got: %)', qualified_identifier;
    END IF;
    
    schema_name := ident[1];
    table_name  := ident[2];
    
    -- Count holes (interior rings) smaller than min_hole_area_m2 (m²) and return IDs that  have any
    sql := format($q$
      WITH polys AS (
        SELECT
          t.id::text AS part_id,
          (ST_Dump(ST_CollectionExtract(t.footprint, 3))).geom AS poly   -- Polygon from  Polygon/MultiPolygon
        FROM %I.%I t
        WHERE ST_IsValid(t.footprint)
          AND t.validated = false
      ),
      holes AS (
        SELECT
          p.part_id,
          ST_Area(
            ST_Transform(
              ST_BuildArea(ST_InteriorRingN(p.poly, n)),  -- build polygon from the nth   interior ring
              6933                                        -- equal-area meters
            )
          ) AS hole_area_m2
        FROM polys p,
             generate_series(1, ST_NumInteriorRings(p.poly)) AS n
      )
      SELECT
        (SELECT COUNT(*)::bigint FROM holes WHERE hole_area_m2 < %L) AS count,
        COALESCE(
          (SELECT ARRAY_AGG(DISTINCT part_id) FROM holes WHERE hole_area_m2 < %L),
          ARRAY[]::text[]
        ) AS ids
    $q$, schema_name, table_name, min_hole_area_m2, min_hole_area_m2);
    
    RETURN QUERY EXECUTE sql;
  END;
  $func$;
  `);
    
    
  //validate resolutions function
  await queryRunner.query(`
  CREATE OR REPLACE FUNCTION polygon_parts.validate_resolutions(
      qualified_identifier_valid TEXT,   -- e.g. 'polygon_parts.valid'
      qualified_identifier_polygon_parts TEXT    -- e.g. 'polygon_parts.parts'
  )
  RETURNS TABLE (id text)
  LANGUAGE plpgsql
  AS $BODY$
  DECLARE
      ident_v  name[] := parse_ident(qualified_identifier_valid)::name[];
      ident_p  name[] := parse_ident(qualified_identifier_polygon_parts)::name[];
  
      schema_valid TEXT;
      table_valid  TEXT;
      schema_parts TEXT;
      table_parts  TEXT;
  
      sql TEXT;
  BEGIN
      -- Expect both as qualified identifiers: schema.table
      IF array_length(ident_v, 1) <> 2 THEN
          RAISE EXCEPTION 'Provide validation table as schema.table (got: %)',  qualified_identifier_valid;
      END IF;
      IF array_length(ident_p, 1) <> 2 THEN
          RAISE EXCEPTION 'Provide parts table as schema.table (got: %)',   qualified_identifier_polygon_parts;
      END IF;
  
      schema_valid := ident_v[1];
      table_valid  := ident_v[2];
      schema_parts := ident_p[1];
      table_parts  := ident_p[2];
  
      -- Build safe SQL with quoted identifiers
      sql := format($q$
          SELECT v.id
          FROM   %I.%I AS v
          WHERE  ST_IsValid(v.footprint)                  -- validity check FIRST
            AND  EXISTS (
                  SELECT 1
                  FROM   %I.%I AS p
                  WHERE  v.validated = 'false'
  				          AND   p.resolution_degree < v.resolution_degree
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
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.validate_small_geometries(TEXT, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.validate_small_holes(TEXT, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.validate_resolutions(TEXT, TEXT);
`);

  }
}

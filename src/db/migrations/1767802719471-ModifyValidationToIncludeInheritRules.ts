import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyValidationToIncludeInheritRules1767802719471 implements MigrationInterface {
    transaction?: boolean | undefined;
    name = 'ModifyValidationToIncludeInheritRules1767802719471'
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('');
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add insertion_order column to validation_parts template table
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD COLUMN IF NOT EXISTS "insertion_order" bigint GENERATED ALWAYS AS IDENTITY NOT NULL
        `);

        // Add unique constraint on insertion_order
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD CONSTRAINT "validation_parts_insertion_order_unique" UNIQUE ("insertion_order")
        `);

        // Update stored procedure to use INCLUDING ALL
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
              'CREATE TABLE %s (LIKE "polygon_parts"."validation_parts" INCLUDING ALL) INHERITS ("polygon_parts"."validation_parts")',
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

        // Keep insertion_order column - it's now part of the permanent schema
    }

}

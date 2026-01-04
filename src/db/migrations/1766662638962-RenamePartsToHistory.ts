import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePartsToHistory1766662638962 implements MigrationInterface {
    name = 'RenamePartsToHistory1766662638962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Find all child tables that inherit from "parts" table
        // Uses PostgreSQL's pg_inherits catalog to find inheritance relationships
        const childTables = await queryRunner.query(`
            SELECT child.relname as table_name
            FROM pg_inherits AS i
            JOIN pg_class AS parent ON i.inhparent = parent.oid
            JOIN pg_class AS child ON i.inhrelid = child.oid
            JOIN pg_namespace AS n_parent ON n_parent.oid = parent.relnamespace
            JOIN pg_namespace AS n_child ON n_child.oid = child.relnamespace
            WHERE n_parent.nspname = 'polygon_parts'
            AND parent.relname = 'parts'
            AND n_child.nspname = 'polygon_parts'
            ORDER BY child.relname;
        `);

        // Step 2: Rename each child table from '{name}_parts' to '{name}_history'
        for (const table of childTables) {
            const oldName = table.table_name;
            const newName = oldName.replace(/_parts$/, '_history');

            await queryRunner.query(`
                ALTER TABLE "polygon_parts"."${oldName}" 
                RENAME TO "${newName}";
            `);
        }

        // Step 3: Rename the parent table from "parts" to "history"
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" 
            RENAME TO "history";
        `);

        // Step 4: Rename all indexes associated with the "history" table (formerly "parts")
        const indexes = await queryRunner.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'polygon_parts'
            AND tablename = 'history'
            AND indexname LIKE 'parts_%'
            ORDER BY indexname;
        `);

        for (const index of indexes) {
            const oldIndexName = index.indexname;
            const newIndexName = oldIndexName.replace(/^parts_/, 'history_');

            await queryRunner.query(`
                ALTER INDEX "polygon_parts"."${oldIndexName}"
                RENAME TO "${newIndexName}";
            `);
        }

        // Step 5: Update the stored procedure to reference "history" instead of "parts"
        // Drop the procedure first to avoid parameter name mismatch error
        await queryRunner.query(`
            DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_tables;
        `);

        await queryRunner.query(`
            CREATE PROCEDURE polygon_parts.create_polygon_parts_tables(
                IN qualified_identifier_history text,
                IN qualified_identifier_polygon_parts text)
            LANGUAGE 'plpgsql'
            AS $BODY$
            DECLARE
                parsed_identifier_history name[] := parse_ident(qualified_identifier_history)::name[];
                parsed_identifier_polygon_parts name[] := parse_ident(qualified_identifier_polygon_parts)::name[];
                
                schema_name_history text := parsed_identifier_history[1];
                table_name_history text := parsed_identifier_history[2];

                schema_name_polygon_parts text := parsed_identifier_polygon_parts[1];
                table_name_polygon_parts text := parsed_identifier_polygon_parts[2];

                tbl_name_history text := quote_ident(table_name_history);
                schm_tbl_name_history text := quote_ident(schema_name_history) || '.' || quote_ident(table_name_history);
                
                tbl_name_polygon_parts text := quote_ident(table_name_polygon_parts);
                schm_tbl_name_polygon_parts text := quote_ident(schema_name_polygon_parts) || '.' || quote_ident(table_name_polygon_parts);
            BEGIN
                IF table_name_history IS NULL THEN
                    RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier created from the "history" table template', qualified_identifier_history;
                END IF;

                IF table_name_polygon_parts IS NULL THEN
                    RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier created from the "polygon_parts" table template', qualified_identifier_polygon_parts;
                END IF;

                EXECUTE 'CREATE TABLE ' || schm_tbl_name_history || '
                    (LIKE "polygon_parts"."history" INCLUDING ALL)
                    INHERITS ("polygon_parts"."history")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_footprint_idx
                    ON ' || schm_tbl_name_history || ' USING gist
                    ("footprint")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_ingestion_date_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("ingestion_date_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_resolution_degree_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("resolution_degree" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_resolution_meter_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("resolution_meter" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_catalog_id_idx
                    ON ' || schm_tbl_name_history || ' USING hash
                    ("catalog_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_product_id_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("product_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_product_type_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("product_type")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_imaging_time_end_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("imaging_time_end_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_history || '_imaging_time_start_idx
                    ON ' || schm_tbl_name_history || ' USING btree
                    ("imaging_time_begin_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE TABLE ' || schm_tbl_name_polygon_parts || '
                    (LIKE "polygon_parts"."polygon_parts" INCLUDING ALL)
                    INHERITS ("polygon_parts"."polygon_parts")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_footprint_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING gist
                    ("footprint")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_ingestion_date_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("ingestion_date_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_resolution_degree_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("resolution_degree" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_resolution_meter_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("resolution_meter" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_part_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("part_id" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_catalog_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING hash
                    ("catalog_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_imaging_time_end_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("imaging_time_end_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_product_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("product_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_product_type_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("product_type")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_imaging_time_start_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("imaging_time_begin_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';
            END;
            $BODY$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Revert stored procedure to reference "parts" instead of "history"
        // Drop the procedure first to avoid parameter name mismatch error
        await queryRunner.query(`
            DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_tables;
        `);

        await queryRunner.query(`
            CREATE PROCEDURE polygon_parts.create_polygon_parts_tables(
                IN qualified_identifier_parts text,
                IN qualified_identifier_polygon_parts text)
            LANGUAGE 'plpgsql'
            AS $BODY$
            DECLARE
                parsed_identifier_parts name[] := parse_ident(qualified_identifier_parts)::name[];
                parsed_identifier_polygon_parts name[] := parse_ident(qualified_identifier_polygon_parts)::name[];
                
                schema_name_parts text := parsed_identifier_parts[1];
                table_name_parts text := parsed_identifier_parts[2];

                schema_name_polygon_parts text := parsed_identifier_polygon_parts[1];
                table_name_polygon_parts text := parsed_identifier_polygon_parts[2];

                tbl_name_parts text := quote_ident(table_name_parts);
                schm_tbl_name_parts text := quote_ident(schema_name_parts) || '.' || quote_ident(table_name_parts);
                
                tbl_name_polygon_parts text := quote_ident(table_name_polygon_parts);
                schm_tbl_name_polygon_parts text := quote_ident(schema_name_polygon_parts) || '.' || quote_ident(table_name_polygon_parts);
            BEGIN
                IF table_name_parts IS NULL THEN
                    RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier created from the "parts" table template', qualified_identifier_parts;
                END IF;

                IF table_name_polygon_parts IS NULL THEN
                    RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier created from the "polygon_parts" table template', qualified_identifier_polygon_parts;
                END IF;

                EXECUTE 'CREATE TABLE ' || schm_tbl_name_parts || '
                    (LIKE "polygon_parts"."parts" INCLUDING ALL)
                    INHERITS ("polygon_parts"."parts")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_footprint_idx
                    ON ' || schm_tbl_name_parts || ' USING gist
                    ("footprint")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_ingestion_date_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("ingestion_date_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_resolution_degree_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("resolution_degree" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_resolution_meter_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("resolution_meter" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_catalog_id_idx
                    ON ' || schm_tbl_name_parts || ' USING hash
                    ("catalog_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_product_id_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("product_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_product_type_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("product_type")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_imaging_time_end_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("imaging_time_end_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_imaging_time_start_idx
                    ON ' || schm_tbl_name_parts || ' USING btree
                    ("imaging_time_begin_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE TABLE ' || schm_tbl_name_polygon_parts || '
                    (LIKE "polygon_parts"."polygon_parts" INCLUDING ALL)
                    INHERITS ("polygon_parts"."polygon_parts")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_footprint_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING gist
                    ("footprint")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_ingestion_date_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("ingestion_date_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_resolution_degree_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("resolution_degree" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_resolution_meter_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("resolution_meter" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_part_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("part_id" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_catalog_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING hash
                    ("catalog_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_imaging_time_end_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("imaging_time_end_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_product_id_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("product_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_product_type_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("product_type")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_polygon_parts || '_imaging_time_start_idx
                    ON ' || schm_tbl_name_polygon_parts || ' USING btree
                    ("imaging_time_begin_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';
            END;
            $BODY$;
        `);

        // Step 2: Rename indexes back from "history_*" to "parts_*"
        const indexes = await queryRunner.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'polygon_parts'
            AND tablename = 'history'
            AND indexname LIKE 'history_%'
            ORDER BY indexname;
        `);

        for (const index of indexes) {
            const oldIndexName = index.indexname;
            const newIndexName = oldIndexName.replace(/^history_/, 'parts_');

            await queryRunner.query(`
                ALTER INDEX "polygon_parts"."${oldIndexName}"
                RENAME TO "${newIndexName}";
            `);
        }

        // Step 3: Rename parent table back from "history" to "parts"
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history" 
            RENAME TO "parts";
        `);

        // Step 4: Find all child tables that inherit from "parts" table (after renaming back)
        const childTables = await queryRunner.query(`
            SELECT child.relname as table_name
            FROM pg_inherits AS i
            JOIN pg_class AS parent ON i.inhparent = parent.oid
            JOIN pg_class AS child ON i.inhrelid = child.oid
            JOIN pg_namespace AS n_parent ON n_parent.oid = parent.relnamespace
            JOIN pg_namespace AS n_child ON n_child.oid = child.relnamespace
            WHERE n_parent.nspname = 'polygon_parts'
            AND parent.relname = 'parts'
            AND n_child.nspname = 'polygon_parts'
            ORDER BY child.relname;
        `);

        // Step 5: Rename each child table back from '{name}_history' to '{name}_parts'
        for (const table of childTables) {
            const oldName = table.table_name;
            const newName = oldName.replace(/_history$/, '_parts');

            await queryRunner.query(`
                ALTER TABLE "polygon_parts"."${oldName}" 
                RENAME TO "${newName}";
            `);
        }
    }

}

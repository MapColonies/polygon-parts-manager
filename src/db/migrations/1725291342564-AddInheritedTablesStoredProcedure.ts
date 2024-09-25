import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInheritedTablesStoredProcedure1725291342564 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE PROCEDURE polygon_parts.create_polygon_parts_tables(
                IN qualified_identifier text)
            LANGUAGE 'plpgsql'
            AS $BODY$
            DECLARE
                parsed_identifier name[] := parse_ident(qualified_identifier)::name[];
                schema_name text := parsed_identifier[1];
                table_name text := parsed_identifier[2];
                tbl_name text := quote_ident(table_name);
                schm_tbl_name text := quote_ident(schema_name) || '.' || quote_ident(table_name);
                tbl_name_parts text := quote_ident(table_name || '_parts');
                schm_tbl_name_parts text := quote_ident(schema_name) || '.' || quote_ident(table_name || '_parts');
            BEGIN
                IF table_name IS NULL THEN
                    RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier for the created tables template name', schema_name;
                END IF;

                EXECUTE 'CREATE TABLE ' || schm_tbl_name_parts || '
                (LIKE "polygon_parts"."parts" INCLUDING ALL)

                TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_geometry_idx
                    ON ' || schm_tbl_name_parts || ' USING gist
                    ("geometry")
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

                EXECUTE 'CREATE TABLE ' || schm_tbl_name || '
                (LIKE "polygon_parts"."polygon_parts" INCLUDING ALL)

                TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_geometry_idx
                    ON ' || schm_tbl_name || ' USING gist
                    ("geometry")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_ingestion_date_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("ingestion_date_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_resolution_degree_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("resolution_degree" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_resolution_meter_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("resolution_meter" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_part_id_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("part_id" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_catalog_id_idx
                    ON ' || schm_tbl_name || ' USING hash
                    ("catalog_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_imaging_time_end_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("imaging_time_end_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_product_id_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("product_id")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_product_type_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("product_type")
                    TABLESPACE pg_default;';

                EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_imaging_time_start_idx
                    ON ' || schm_tbl_name || ' USING btree
                    ("imaging_time_begin_utc" ASC NULLS LAST)
                    TABLESPACE pg_default;';
            END;
            $BODY$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_tables(text);`);
    }
}

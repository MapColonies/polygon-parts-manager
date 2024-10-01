import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInheritedTablesStoredProcedure1725291342564 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
			CREATE OR REPLACE PROCEDURE polygon_parts.create_polygon_parts_tables(
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
        await queryRunner.query(`DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_tables(text, text);`);
    }
}

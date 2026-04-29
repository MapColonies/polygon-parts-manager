import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyResolutionValidateToReturnResolutions1777461842927 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.validate_resolutions(
            qualified_identifier_valid TEXT,   -- e.g. 'polygon_parts.valid'
            qualified_identifier_polygon_parts TEXT    -- e.g. 'polygon_parts.parts'
        );`);
        await queryRunner.query(`
        CREATE OR REPLACE FUNCTION polygon_parts.validate_resolutions(
            qualified_identifier_valid TEXT,   -- e.g. 'polygon_parts.valid'
            qualified_identifier_polygon_parts TEXT    -- e.g. 'polygon_parts.parts'
        )
        RETURNS TABLE (id text, new_resolution_degree numeric, existing_resolution_degree numeric)
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
                SELECT  v.id AS id,
                        v.resolution_degree AS new,
                        MIN(p.resolution_degree) AS existing
                FROM   %I.%I AS v
                JOIN   %I.%I AS p
                ON   ST_Intersects(p.footprint, v.footprint)
                AND   NOT ST_Touches(p.footprint, v.footprint)
                WHERE  ST_IsValid(v.footprint)                  -- validity check FIRST
                AND  v.validated = false
                AND  p.resolution_degree < v.resolution_degree
                GROUP BY v.id, v.resolution_degree
            $q$, schema_valid, table_valid, schema_parts, table_parts);
        
            RETURN QUERY EXECUTE sql;
        END;
        $BODY$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_parts.validate_resolutions(
            qualified_identifier_valid TEXT,   -- e.g. 'polygon_parts.valid'
            qualified_identifier_polygon_parts TEXT    -- e.g. 'polygon_parts.parts'
        );`);
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
                            WHERE  v.validated = false
                                    AND   p.resolution_degree < v.resolution_degree
                            AND  ST_Intersects(p.footprint, v.footprint)
                                AND NOT ST_Touches(p.footprint, v.footprint)
                    )
                $q$, schema_valid, table_valid, schema_parts, table_parts);
            
                RETURN QUERY EXECUTE sql;
            END;
            $BODY$;
        `);
    }

}

import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyPolygonPartsCalculationStoredProcedure1749550991995 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE IF EXISTS polygon_parts.update_polygon_parts(regclass, regclass)`);

        await queryRunner.query(`
            CREATE OR REPLACE PROCEDURE polygon_parts.update_polygon_parts(
                IN parts regclass,
                IN polygon_parts regclass,
                IN min_polygon_part_area float8)
            LANGUAGE 'plpgsql'
            AS $BODY$
            BEGIN
                drop table if exists tbl;
                execute 'create temp table if not exists tbl on commit delete rows as
                with unprocessed as (
                    select "id", "catalog_id", "footprint", "insertion_order" from ' || parts || ' where not "is_processed_part" order by "insertion_order"
                )
                -- calculation of modified geometry (footprint), from existing polygon parts and new unprocessed parts, to prevent overlaps between polygon parts
                select 
                    t1."id",
                    t1."part_id",
                    st_difference(t1."footprint", st_union(t2."footprint")) diff
                from (
                    -- selection of existing polygon parts that are overlapped by new unprocessed parts
                    select pp."id", pp."part_id", pp."footprint", pp."insertion_order"
                    from ' || polygon_parts || ' pp
                    join unprocessed
                    on st_intersects(pp."footprint", unprocessed."footprint")
                    union all
                    -- selection of new unprocessed parts
                    select NULL, "id", "footprint", "insertion_order"
                    from unprocessed
                ) t1
                inner join unprocessed t2
                on st_intersects(t1."footprint", t2."footprint") and t1."insertion_order" < t2."insertion_order"
                group by t1."id", t1."part_id", t1."footprint";';

                execute 'with unprocessed as (
                    select * from ' || parts || ' where not "is_processed_part" order by "insertion_order"
                ), inserts as (
                    -- selection of non-empty geometry and above area threshold geometries
                    select 
                        "id",
                        "part_id",
                        diff
                    from tbl
                    -- very small area polgons are filtered out since postgis internal calculations are prone to some geometric precision
                    where not st_isempty(diff) and st_area(diff) >= ' || min_polygon_part_area || '
                )
                insert into ' || polygon_parts || ' as pp ("part_id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, "footprint", "insertion_order")
                select 
                    "part_id",
                    "catalog_id",
                    "product_id",
                    "product_type",
                    "source_id",
                    "source_name",
                    "product_version",
                    "ingestion_date_utc",
                    "imaging_time_begin_utc",
                    "imaging_time_end_utc",
                    "resolution_degree",
                    "resolution_meter",
                    "source_resolution_meter",
                    "horizontal_accuracy_ce90",
                    sensors,
                    countries,
                    cities,
                    description,
                    footprint,
                    "insertion_order"
                from (
                    -- selection of modified polygon parts that are recreated
                    select pp."part_id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, (st_dump(diff)).geom as footprint, "insertion_order"
                    from inserts
                    left join ' || polygon_parts || ' as pp
                    on inserts."id" = pp."id"
                    where not inserts."id" is null
                    union all
                    -- selection of new unprocessed parts that are modified by other new unprocessed parts (overlapping new parts)
                    select "part_id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, (st_dump(diff)).geom as footprint, "insertion_order"
                    from inserts
                    left join ' || parts || '
                    on inserts."part_id" = ' || parts || '."id"
                    where inserts."id" is null
                    union all
                    -- selection of new unprocessed parts that are NOT modified through the update process
                    select "id" as "part_id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, (st_dump(footprint)).geom as footprint, "insertion_order"
                    from unprocessed
                    where "id" not in (select "part_id" from tbl)
                ) inserting_parts';

                -- since modified polygon parts and new unprocessed parts were inserted it is now safe to delete the previous polygon parts
                execute 'delete from ' || polygon_parts || ' as pp
                using tbl
                where pp."id" = tbl."id"';

                -- update the parts table by marking the new unprocessed parts as processed
                execute 'update ' || parts || '
                set "is_processed_part" = true
                where "is_processed_part" = false';
            END;
            $BODY$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE IF EXISTS polygon_parts.update_polygon_parts(regclass, regclass, float8)`);
    }

}

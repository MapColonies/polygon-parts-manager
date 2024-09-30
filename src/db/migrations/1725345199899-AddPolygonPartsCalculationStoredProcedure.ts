import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPolygonPartsCalculationStoredProcedure1725345199899 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE PROCEDURE polygon_parts.update_polygon_parts(
                IN parts regclass,
                IN polygon_parts regclass)
            LANGUAGE 'plpgsql'
            AS $BODY$
            BEGIN
                drop table if exists tbl;
                execute 'create temp table if not exists tbl on commit delete rows as
                with unprocessed as (
                    select "id", "catalog_id", "footprint", "insertion_order" from ' || parts || ' where not "is_processed_part" order by "insertion_order"
                )
                select 
                    t1."id",
                    t1."part_id",
                    st_difference(t1."footprint", st_union(t2."footprint")) diff
                from (
                    select pp."id", pp."part_id", pp."catalog_id", pp."footprint", pp."insertion_order"
                    from ' || polygon_parts || ' pp
                    join unprocessed
                    on st_intersects(pp."footprint", unprocessed."footprint") and pp."catalog_id" = unprocessed."catalog_id"
                    union all
                    select NULL, "id", "catalog_id", "footprint", "insertion_order"
                    from unprocessed
                ) t1
                inner join unprocessed t2
                on st_intersects(t1."footprint", t2."footprint") and t1."insertion_order" < t2."insertion_order" and t1."catalog_id" = t2."catalog_id"
                group by t1."id", t1."part_id", t1."catalog_id", t1."footprint";';

                execute 'delete from ' || polygon_parts || ' as pp
                using tbl
                where pp."id" = tbl."id"';

                execute 'with unprocessed as (
                    select * from ' || parts || ' where not "is_processed_part" order by "insertion_order"
                ), inserts as (
                    select 
                        "part_id",
                        diff
                    from tbl
                    where not st_isempty(diff)
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
                    (st_dump(diff)).geom as "footprint",
                    "insertion_order"
                from (
                    select "part_id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, diff, "insertion_order"
                    from inserts
                    left join ' || parts || '
                    on inserts."part_id" = ' || parts || '."id"
                    union all
                    select "id", "catalog_id", "product_id", "product_type", "source_id", "source_name", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce90", sensors, countries, cities, description, "footprint" as diff, "insertion_order"
                    from unprocessed
                    where "id" not in (select "part_id" from tbl)
                ) inserting_parts';

                execute 'update ' || parts || '
                set "is_processed_part" = true
                where "is_processed_part" = false';
            END;
            $BODY$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP PROCEDURE polygon_parts.update_polygon_parts`);
    }
}

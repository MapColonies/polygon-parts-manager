import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDataset1765737247435 implements MigrationInterface {
    name = 'AddDataset1765737247435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "polygon_parts"."datasets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "product_id" text COLLATE "ucs_basic" NOT NULL,
                "product_type" "polygon_parts"."product_type_enum" NOT NULL,
                "catalog_id" uuid NOT NULL,
                "source_id" text COLLATE "ucs_basic",
                "source_name" text COLLATE "ucs_basic" NOT NULL,
                "product_version" text COLLATE "ucs_basic" NOT NULL,
                "ingestion_date_utc" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "imaging_time_begin_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "imaging_time_end_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "resolution_degree" numeric NOT NULL,
                "resolution_meter" numeric NOT NULL,
                "source_resolution_meter" numeric NOT NULL,
                "horizontal_accuracy_ce90" numeric NOT NULL,
                "sensors" text COLLATE "ucs_basic" NOT NULL,
                "countries" text COLLATE "ucs_basic",
                "cities" text COLLATE "ucs_basic",
                "description" text COLLATE "ucs_basic",
                "footprint" geometry(Polygon, 4326) NOT NULL,
                "insertion_order" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
                "is_processed_part" boolean NOT NULL DEFAULT false,
                CONSTRAINT "product id" CHECK ("product_id" ~ '^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$'),
                CONSTRAINT "source name" CHECK (length("source_name") > 1),
                CONSTRAINT "product version" CHECK (
                    "product_version" ~ '^[1-9]\\d*(\\.(0|[1-9]\\d?))?$'
                ),
                CONSTRAINT "imaging time begin utc" CHECK ("imaging_time_begin_utc" < now()),
                CONSTRAINT "imaging time end utc" CHECK ("imaging_time_end_utc" < now()),
                CONSTRAINT "resolution degree" CHECK (
                    "resolution_degree" BETWEEN 0.000000167638063430786 AND 0.703125
                ),
                CONSTRAINT "resolution meter" CHECK (
                    "resolution_meter" BETWEEN 0.0185 AND 78271.52
                ),
                CONSTRAINT "source resolution meter" CHECK (
                    "source_resolution_meter" BETWEEN 0.0185 AND 78271.52
                ),
                CONSTRAINT "horizontal accuracy ce90" CHECK (
                    "horizontal_accuracy_ce90" BETWEEN 0.01 AND 4000
                ),
                CONSTRAINT "sensors" CHECK (
                    "sensors" ~ '^((([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))(,(([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))+?)*?)$'
                ),
                CONSTRAINT "countries" CHECK ("countries" ~ '^([^,]+)+(,[^,]+)*$'),
                CONSTRAINT "cities" CHECK ("cities" ~ '^([^,]+)+(,[^,]+)*$'),
                CONSTRAINT "geometry extent" CHECK (
                    Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))
                ),
                CONSTRAINT "valid geometry" CHECK (ST_IsValid("footprint")),
                CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_product_id_idx" ON "polygon_parts"."datasets" ("product_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_product_type_idx" ON "polygon_parts"."datasets" ("product_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_catalog_id_idx" ON "polygon_parts"."datasets" ("catalog_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_ingestion_date_utc_idx" ON "polygon_parts"."datasets" ("ingestion_date_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_imaging_time_begin_utc_idx" ON "polygon_parts"."datasets" ("imaging_time_begin_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_imaging_time_end_utc_idx" ON "polygon_parts"."datasets" ("imaging_time_end_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_resolution_degree_idx" ON "polygon_parts"."datasets" ("resolution_degree")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_resolution_meter_idx" ON "polygon_parts"."datasets" ("resolution_meter")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_footprint_idx" ON "polygon_parts"."datasets" USING GiST ("footprint")
        `);
        await queryRunner.query(`
            CREATE INDEX "datasets_is_processed_part_idx" ON "polygon_parts"."datasets" ("is_processed_part")
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD "insertion_order" bigint GENERATED ALWAYS AS IDENTITY NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD CONSTRAINT "polygon_parts.validation_parts_insertion_order_uq" UNIQUE ("insertion_order")
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ALTER COLUMN "footprint" TYPE geometry(Polygon, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ALTER COLUMN "footprint" TYPE geometry(Polygon, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD CONSTRAINT "source name" CHECK (length("source_name") > 1)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD CONSTRAINT "sensors" CHECK (
                    "sensors" ~ '^((([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))(,(([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))+?)*?)$'
                )
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD CONSTRAINT "countries" CHECK ("countries" ~ '^([^,]+)+(,[^,]+)*$')
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD CONSTRAINT "cities" CHECK ("cities" ~ '^([^,]+)+(,[^,]+)*$')
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD CONSTRAINT "source name" CHECK (length("source_name") > 1)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD CONSTRAINT "sensors" CHECK (
                    "sensors" ~ '^((([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))(,(([^,\\s][^,\\n]*?[^,\\s])|([^,\\s]))+?)*?)$'
                )
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD CONSTRAINT "countries" CHECK ("countries" ~ '^([^,]+)+(,[^,]+)*$')
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD CONSTRAINT "cities" CHECK ("cities" ~ '^([^,]+)+(,[^,]+)*$')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP CONSTRAINT "cities"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP CONSTRAINT "countries"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP CONSTRAINT "sensors"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP CONSTRAINT "source name"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP CONSTRAINT "cities"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP CONSTRAINT "countries"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP CONSTRAINT "sensors"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP CONSTRAINT "source name"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP CONSTRAINT "polygon_parts.validation_parts_insertion_order_uq"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP COLUMN "insertion_order"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_is_processed_part_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_footprint_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_resolution_meter_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_resolution_degree_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_imaging_time_end_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_imaging_time_begin_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_ingestion_date_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_catalog_id_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_product_type_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."datasets_product_id_idx"
        `);
        await queryRunner.query(`
            DROP TABLE "polygon_parts"."datasets"
        `);
    }

}

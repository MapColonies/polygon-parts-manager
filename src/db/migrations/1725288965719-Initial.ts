import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1725288965719 implements MigrationInterface {
    name = 'Initial1725288965719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "polygon_parts"."product_type_enum" AS ENUM(
                'Orthophoto',
                'OrthophotoHistory',
                'OrthophotoBest',
                'RasterMap',
                'RasterMapBest',
                'RasterAid',
                'RasterAidBest',
                'RasterVector',
                'RasterVectorBest',
                'VectorBest',
                'DTM',
                'DSM',
                'QuantizedMeshDTM',
                'QuantizedMeshDSM',
                'QuantizedMeshDTMBest',
                'QuantizedMeshDSMBest',
                '3DPhotoRealistic',
                'PointCloud'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "polygon_parts"."parts" (
                "product_id" text COLLATE "C.UTF-8" NOT NULL,
                "product_type" "polygon_parts"."product_type_enum" NOT NULL,
                "catalog_id" uuid NOT NULL,
                "source_id" text COLLATE "C.UTF-8",
                "source_name" text COLLATE "C.UTF-8" NOT NULL,
                "product_version" text COLLATE "C.UTF-8" NOT NULL,
                "ingestion_date_utc" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "imaging_time_begin_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "imaging_time_end_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "resolution_degree" numeric NOT NULL,
                "resolution_meter" numeric NOT NULL,
                "source_resolution_meter" numeric NOT NULL,
                "horizontal_accuracy_ce_90" real NOT NULL,
                "sensors" text COLLATE "C.UTF-8" NOT NULL,
                "countries" text COLLATE "C.UTF-8",
                "cities" text COLLATE "C.UTF-8",
                "description" text COLLATE "C.UTF-8",
                "footprint" geometry(Polygon, 4326) NOT NULL,
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "insertion_order" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
                "is_processed_part" boolean NOT NULL DEFAULT false,
                CONSTRAINT "parts_insertion_order_uq" UNIQUE ("insertion_order"),
                CONSTRAINT "product id" CHECK (product_id ~* '^[a-zA-Z0-9_-]+$'),
                CONSTRAINT "product version" CHECK (
                    "product_version" ~* '^[1-9]\\d*(\\.(0|[1-9]\\d?))?$'
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
                CONSTRAINT "horizontal accuracy ce 90" CHECK (
                    "horizontal_accuracy_ce_90" BETWEEN 0.01 AND 4000
                ),
                CONSTRAINT "geometry extent" CHECK (
                    Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))
                ),
                CONSTRAINT "valid geometry" CHECK (ST_IsValid("footprint")),
                CONSTRAINT "imaging times" CHECK (
                    "imaging_time_begin_utc" <= "imaging_time_end_utc"
                ),
                CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_product_id_idx" ON "polygon_parts"."parts" ("product_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_product_type_idx" ON "polygon_parts"."parts" ("product_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_catalog_id_idx" ON "polygon_parts"."parts" ("catalog_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_ingestion_date_utc_idx" ON "polygon_parts"."parts" ("ingestion_date_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_imaging_time_begin_utc_idx" ON "polygon_parts"."parts" ("imaging_time_begin_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_imaging_time_end_utc_idx" ON "polygon_parts"."parts" ("imaging_time_end_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_resolution_degree_idx" ON "polygon_parts"."parts" ("resolution_degree")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_resolution_meter_idx" ON "polygon_parts"."parts" ("resolution_meter")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_footprint_idx" ON "polygon_parts"."parts" USING GiST ("footprint")
        `);
        await queryRunner.query(`
            CREATE INDEX "parts_is_processed_part_idx" ON "polygon_parts"."parts" ("is_processed_part")
        `);
        await queryRunner.query(`
            CREATE TABLE "polygon_parts"."polygon_parts" (
                "product_id" text COLLATE "C.UTF-8" NOT NULL,
                "product_type" "polygon_parts"."product_type_enum" NOT NULL,
                "catalog_id" uuid NOT NULL,
                "source_id" text COLLATE "C.UTF-8",
                "source_name" text COLLATE "C.UTF-8" NOT NULL,
                "product_version" text COLLATE "C.UTF-8" NOT NULL,
                "ingestion_date_utc" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "imaging_time_begin_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "imaging_time_end_utc" TIMESTAMP WITH TIME ZONE NOT NULL,
                "resolution_degree" numeric NOT NULL,
                "resolution_meter" numeric NOT NULL,
                "source_resolution_meter" numeric NOT NULL,
                "horizontal_accuracy_ce_90" real NOT NULL,
                "sensors" text COLLATE "C.UTF-8" NOT NULL,
                "countries" text COLLATE "C.UTF-8",
                "cities" text COLLATE "C.UTF-8",
                "description" text COLLATE "C.UTF-8",
                "footprint" geometry(Polygon, 4326) NOT NULL,
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "part_id" uuid NOT NULL,
                "insertion_order" bigint NOT NULL,
                CONSTRAINT "polygon_parts_insertion_order_uq" UNIQUE ("insertion_order"),
                CONSTRAINT "product id" CHECK (product_id ~* '^[a-zA-Z0-9_-]+$'),
                CONSTRAINT "product version" CHECK (
                    "product_version" ~* '^[1-9]\\d*(\\.(0|[1-9]\\d?))?$'
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
                CONSTRAINT "horizontal accuracy ce 90" CHECK (
                    "horizontal_accuracy_ce_90" BETWEEN 0.01 AND 4000
                ),
                CONSTRAINT "geometry extent" CHECK (
                    Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))
                ),
                CONSTRAINT "valid geometry" CHECK (ST_IsValid("footprint")),
                CONSTRAINT "polygon_parts_pkey" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_product_id_idx" ON "polygon_parts"."polygon_parts" ("product_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_product_type_idx" ON "polygon_parts"."polygon_parts" ("product_type")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_catalog_id_idx" ON "polygon_parts"."polygon_parts" ("catalog_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_ingestion_date_utc_idx" ON "polygon_parts"."polygon_parts" ("ingestion_date_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_imaging_time_begin_utc_idx" ON "polygon_parts"."polygon_parts" ("imaging_time_begin_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_imaging_time_end_utc_idx" ON "polygon_parts"."polygon_parts" ("imaging_time_end_utc")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_resolution_degree_idx" ON "polygon_parts"."polygon_parts" ("resolution_degree")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_resolution_meter_idx" ON "polygon_parts"."polygon_parts" ("resolution_meter")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_footprint_idx" ON "polygon_parts"."polygon_parts" USING GiST ("footprint")
        `);
        await queryRunner.query(`
            CREATE INDEX "polygon_parts_part_id_idx" ON "polygon_parts"."polygon_parts" ("part_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_part_id_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_footprint_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_resolution_meter_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_resolution_degree_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_imaging_time_end_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_imaging_time_begin_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_ingestion_date_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_catalog_id_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_product_type_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."polygon_parts_product_id_idx"
        `);
        await queryRunner.query(`
            DROP TABLE "polygon_parts"."polygon_parts"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_is_processed_part_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_footprint_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_resolution_meter_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_resolution_degree_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_imaging_time_end_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_imaging_time_begin_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_ingestion_date_utc_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_catalog_id_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_product_type_idx"
        `);
        await queryRunner.query(`
            DROP INDEX "polygon_parts"."parts_product_id_idx"
        `);
        await queryRunner.query(`
            DROP TABLE "polygon_parts"."parts"
        `);
        await queryRunner.query(`
            DROP TYPE "polygon_parts"."product_type_enum"
        `);
    }

}

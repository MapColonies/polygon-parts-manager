import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInsertionOrderToValidationParts1767783945233 implements MigrationInterface {
    name = 'AddInsertionOrderToValidationParts1767783945233'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD "insertion_order" bigint GENERATED ALWAYS AS IDENTITY NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD CONSTRAINT "polygon_parts.validation_parts_insertion_order_uq" UNIQUE ("insertion_order")
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD "job_type" text COLLATE "ucs_basic" NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ADD "job_type" text COLLATE "ucs_basic" NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP CONSTRAINT "validation_parts_pkey"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP COLUMN "id"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD "id" text NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD CONSTRAINT "polygon_parts.validation_parts_pkey" PRIMARY KEY ("id")
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
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ALTER COLUMN "footprint" TYPE geometry(Geometry, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD CONSTRAINT "footprint" CHECK (
                    GeometryType("footprint") IN ('POLYGON', 'MULTIPOLYGON')
                )
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ADD CONSTRAINT "footprint" CHECK (
                    GeometryType("footprint") IN ('POLYGON', 'MULTIPOLYGON')
                )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history" DROP CONSTRAINT "footprint"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP CONSTRAINT "footprint"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history"
            ALTER COLUMN "footprint" TYPE geometry(POLYGON, 4326)
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
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
            ALTER TABLE "polygon_parts"."validation_parts" DROP CONSTRAINT "polygon_parts.validation_parts_pkey"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP COLUMN "id"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD "id" text NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts"
            ADD CONSTRAINT "validation_parts_pkey" PRIMARY KEY ("id")
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."history" DROP COLUMN "job_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP COLUMN "job_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP CONSTRAINT "polygon_parts.validation_parts_insertion_order_uq"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."validation_parts" DROP COLUMN "insertion_order"
        `);
    }

}

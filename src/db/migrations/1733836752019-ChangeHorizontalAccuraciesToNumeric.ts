import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeHorizontalAccuraciesToNumeric1733836752019 implements MigrationInterface {
    name = 'ChangeHorizontalAccuraciesToNumeric1733836752019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP COLUMN "horizontal_accuracy_ce90"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD "horizontal_accuracy_ce90" numeric NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP COLUMN "horizontal_accuracy_ce90"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD "horizontal_accuracy_ce90" numeric NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts" DROP COLUMN "horizontal_accuracy_ce90"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."polygon_parts"
            ADD "horizontal_accuracy_ce90" real NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts" DROP COLUMN "horizontal_accuracy_ce90"
        `);
        await queryRunner.query(`
            ALTER TABLE "polygon_parts"."parts"
            ADD "horizontal_accuracy_ce90" real NOT NULL
        `);
    }

}

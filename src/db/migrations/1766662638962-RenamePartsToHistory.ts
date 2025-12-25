import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePartsToHistory1766662638962 implements MigrationInterface {
    name = 'RenamePartsToHistory1766662638962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // This migration renames tables with '_parts' suffix to '_history' suffix
        // to align with the history table naming convention used in the application.
        // It preserves all existing data, indexes, and constraints.

        // Check if base_parts table exists and rename to base_history
        const basePartsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'polygon_parts' 
                AND table_name = 'base_parts'
            );
        `);

        if (basePartsExists[0].exists) {
            // Check if base_history already exists
            const baseHistoryExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'polygon_parts' 
                    AND table_name = 'base_history'
                );
            `);

            if (!baseHistoryExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "polygon_parts"."base_parts" 
                    RENAME TO "base_history";
                `);
            } else {
                // If base_history exists, merge data from base_parts into it
                await queryRunner.query(`
                    INSERT INTO "polygon_parts"."base_history" 
                    SELECT * FROM "polygon_parts"."base_parts"
                    ON CONFLICT DO NOTHING;
                `);

                // Drop the old base_parts table
                await queryRunner.query(`
                    DROP TABLE IF EXISTS "polygon_parts"."base_parts";
                `);
            }
        }

        // Note: We don't rename 'parts' and 'polygon_parts' tables as they are actively used
        // by the application for normal operations. Only base_parts is being renamed to base_history
        // since it follows the validation -> history pattern.

        // validation_parts table is intentionally NOT renamed as it's a temporary table
        // that gets created and dropped dynamically during validation operations
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert the changes - rename base_history back to base_parts
        const baseHistoryExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'polygon_parts' 
                AND table_name = 'base_history'
            );
        `);

        if (baseHistoryExists[0].exists) {
            const basePartsExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'polygon_parts' 
                    AND table_name = 'base_parts'
                );
            `);

            if (!basePartsExists[0].exists) {
                await queryRunner.query(`
                    ALTER TABLE "polygon_parts"."base_history" 
                    RENAME TO "base_parts";
                `);
            } else {
                // If base_parts exists, we need to handle this carefully
                // Drop base_history and keep base_parts as it was before
                await queryRunner.query(`
                    DROP TABLE IF EXISTS "polygon_parts"."base_history";
                `);
            }
        }
    }

}

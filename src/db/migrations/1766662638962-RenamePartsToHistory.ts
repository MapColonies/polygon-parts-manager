import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePartsToHistory1766662638962 implements MigrationInterface {
    name = 'RenamePartsToHistory1766662638962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Find all tables ending with '_parts' suffix in polygon_parts schema
        // These are dynamically created tables like 'nopalestine_orthophoto_parts'
        const tables = await queryRunner.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'polygon_parts' 
            AND table_name LIKE '%_parts'
            AND table_name NOT IN ('base_parts', 'validation_parts')
            ORDER BY table_name;
        `);

        // Rename each table from '{name}_parts' to '{name}_history'
        for (const table of tables) {
            const oldName = table.table_name;
            const newName = oldName.replace(/_parts$/, '_history');

            await queryRunner.query(`
                ALTER TABLE "polygon_parts"."${oldName}" 
                RENAME TO "${newName}";
            `);
        }

        // Note: base_parts and validation_parts are excluded because:
        // - base_parts: is a template table for inheritance, not a history table
        // - validation_parts: is a temporary table created/dropped dynamically during validation
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Find all tables ending with '_history' suffix
        const tables = await queryRunner.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'polygon_parts' 
            AND table_name LIKE '%_history'
            AND table_name NOT IN ('base_history')
            ORDER BY table_name;
        `);

        // Rename each table back from '{name}_history' to '{name}_parts'
        for (const table of tables) {
            const oldName = table.table_name;
            const newName = oldName.replace(/_history$/, '_parts');

            await queryRunner.query(`
                ALTER TABLE "polygon_parts"."${oldName}" 
                RENAME TO "${newName}";
            `);
        }
    }

}

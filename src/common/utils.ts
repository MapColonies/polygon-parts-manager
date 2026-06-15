import { readFileSync } from 'node:fs';
import { snakeCase } from 'change-case';
import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import type { EntityManager } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { DbConfig } from './interfaces';

export const camelCaseToSnakeCase = (value: string): string => {
  return snakeCase(value);
};

export const createConnectionOptions = (dbConfig: DbConfig): PostgresConnectionOptions => {
  const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
  if (enableSslAuth) {
    connectionOptions.password = undefined;
    connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
  }
  return connectionOptions;
};

export async function verifyValidationTableInheritance(
  entityManager: EntityManager,
  schema: string,
  validationsEntityName: string,
  validationsEntityQualifiedName: string,
  logger: Logger
): Promise<void> {
  const result = await entityManager.query<number[]>(
    `
      SELECT 1 as res
      FROM pg_inherits AS i
      JOIN pg_class AS child ON i.inhrelid = child.oid
      JOIN pg_namespace AS n_child ON n_child.oid = child.relnamespace
      JOIN pg_class AS parent ON i.inhparent = parent.oid
      JOIN pg_namespace AS n_parent ON n_parent.oid = parent.relnamespace
      WHERE n_parent.nspname = $1
        AND parent.relname = $2
        AND n_child.nspname = $1
        AND child.relname = $3;
    `,
    [
      schema,
      'validation_parts', // <-- base table name
      validationsEntityName,
    ]
  );

  const isChildOfValidationRecord = result.length > 0;

  if (!isChildOfValidationRecord) {
    const errorMessage = `Refused to operate on ${validationsEntityQualifiedName} — it is not instance of validation_parts entity.`;
    logger.error({ msg: errorMessage });
    throw new BadRequestError(errorMessage);
  }
}

export async function deleteValidationsTable(
  entityManager: EntityManager,
  schema: string,
  validationsEntityName: string,
  validationsEntityQualifiedName: string,
  logger: Logger
): Promise<void> {
  logger.info({ msg: 'deleting validations table', validationsEntityQualifiedName });
  try {
    await verifyValidationTableInheritance(entityManager, schema, validationsEntityName, validationsEntityQualifiedName, logger);

    await entityManager.query(`DROP TABLE ${validationsEntityQualifiedName} CASCADE;`);

    logger.debug({ msg: 'validations table dropped', validationsEntityQualifiedName });
  } catch (error) {
    const errorMessage = `Could not delete validation table: ${validationsEntityQualifiedName}`;
    logger.error({ msg: errorMessage, err: error });
    throw error;
  }
}

import { readFileSync } from 'fs';
import { snakeCase } from 'change-case-all';
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

import jsLogger, { type LoggerOptions } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/telemetry';
import config from 'config';
import { DataSource, DefaultNamingStrategy, type DataSourceOptions, type Table } from 'typeorm';
import { ConnectionManager } from './src/common/connectionManager';
import { type DbConfig } from './src/common/interfaces';
import { camelCaseToSnakeCase } from './src/common/utils';

const connectionOptions = config.get<DbConfig>('db');

const customNamingStrategy = new DefaultNamingStrategy();
customNamingStrategy.indexName = (tableOrName: Table | string, columnNames: string[], where?: string): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}${where !== undefined ? '_partial' : ''}_idx`;
};
customNamingStrategy.uniqueConstraintName = (tableOrName: Table | string, columnNames: string[]): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}`;
};
customNamingStrategy.columnName = (propertyName: string): string => {
  return camelCaseToSnakeCase(propertyName);
};

const defaultDataSourceOptions = {
  entities: ['src/**/DAL/*.ts'],
  logging: true,
  synchronize: false,
  migrations: ['src/db/migrations/*.ts'],
  migrationsRun: false,
  migrationsTableName: 'migrations',
  namingStrategy: customNamingStrategy,
} satisfies Partial<DataSourceOptions>;

const dataSourceOptions: DataSourceOptions = {
  ...defaultDataSourceOptions,
  ...ConnectionManager.createConnectionOptions(connectionOptions),
};

const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

logger.debug({ dataSourceOptions, msg: 'data source options' });
export const appDataSource = new DataSource(dataSourceOptions);

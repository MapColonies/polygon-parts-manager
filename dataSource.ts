import config from 'config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { DbConfig } from './src/common/interfaces';
import { namingStrategy } from './src/polygonParts/DAL/utils';
import { createConnectionOptions } from './src/common/utils';

const connectionOptions = config.get<DbConfig>('db');

const defaultDataSourceOptions = {
  namingStrategy,
} satisfies Partial<DataSourceOptions>;

const overridingDataSourceOptions = {
  entities: ['src/**/DAL/*.ts'],
  migrations: ['src/db/migrations/*.ts'],
} satisfies Partial<DataSourceOptions>;

const dataSourceOptions: DataSourceOptions = {
  ...defaultDataSourceOptions,
  ...createConnectionOptions(connectionOptions),
  ...overridingDataSourceOptions,
};

export const appDataSource = new DataSource(dataSourceOptions);

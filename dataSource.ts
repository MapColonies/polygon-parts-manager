import config from 'config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ConnectionManager } from './src/common/connectionManager';
import type { DbConfig } from './src/common/interfaces';
import { namingStrategy } from './src/polygonParts/DAL/utils';

const connectionOptions = config.get<DbConfig>('db');

const defaultDataSourceOptions = {
  namingStrategy,
};

const overridingDataSourceOptions = {
  entities: ['src/**/DAL/*.ts'],
  migrations: ['src/db/migrations/*.ts'],
};

const dataSourceOptions: DataSourceOptions = {
  ...defaultDataSourceOptions,
  ...ConnectionManager.createConnectionOptions(connectionOptions),
  ...overridingDataSourceOptions
};

export const appDataSource = new DataSource(dataSourceOptions);

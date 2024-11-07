import config from 'config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ConnectionManager, namingStrategy } from './src/common/connectionManager';
import type { DbConfig } from './src/common/interfaces';

const connectionOptions = config.get<DbConfig>('db');

const defaultDataSourceOptions = {
  entities: ['src/**/DAL/*.ts'],
  logging: true,
  synchronize: false,
  migrations: ['src/db/migrations/*.ts'],
  migrationsRun: false,
  migrationsTableName: 'migrations',
  namingStrategy,
} satisfies Partial<DataSourceOptions>;

const dataSourceOptions: DataSourceOptions = {
  ...defaultDataSourceOptions,
  ...ConnectionManager.createConnectionOptions(connectionOptions),
};

export const appDataSource = new DataSource(dataSourceOptions);

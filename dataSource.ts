import { DataSource, type DataSourceOptions } from 'typeorm';
import type { DbConfig } from './src/common/interfaces';
import { namingStrategy } from './src/polygonParts/DAL/utils';
import { createConnectionOptions } from './src/common/utils';
import { getConfig, initConfig } from './src/common/config';

const defaultDataSourceOptions = {
  namingStrategy,
} satisfies Partial<DataSourceOptions>;

const overridingDataSourceOptions = {
  entities: ['src/**/DAL/*.ts'],
  migrations: ['src/db/migrations/*.ts'],
} satisfies Partial<DataSourceOptions>;

export const appDataSource = (async (): Promise<DataSource> => {
  await initConfig();
  const connectionOptions = getConfig().get('db') as unknown as DbConfig;
  const dataSourceOptions: DataSourceOptions = {
    ...defaultDataSourceOptions,
    ...createConnectionOptions(connectionOptions),
    ...overridingDataSourceOptions,
  };
  return new DataSource(dataSourceOptions);
})();

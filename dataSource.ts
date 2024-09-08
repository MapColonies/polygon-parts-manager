import config from 'config';
import { DataSource, DefaultNamingStrategy, Table } from 'typeorm';
import { ConnectionManager } from './src/common/connectionManager';
import { DbConfig } from './src/common/interfaces';

const connectionOptions = config.get<DbConfig>('db');

const customNamingStrategy = new DefaultNamingStrategy();
customNamingStrategy.indexName = (tableOrName: Table | string, columnNames: string[], where?: string): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}${where !== undefined ? '_partial' : ''}_idx`;
};
customNamingStrategy.uniqueConstraintName = (tableOrName: Table | string, columnNames: string[]): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}`;
}

export const appDataSource = new DataSource({
  ...ConnectionManager.createConnectionOptions(connectionOptions),
  entities: ['src/**/DAL/*.ts'],
  logging: true,
  synchronize: false,
  migrations: ['src/db/migrations/*.ts'],
  migrationsRun: false,
  migrationsTableName: 'polygon_parts_migrations',
  namingStrategy: customNamingStrategy,
});

import config from 'config';
import { DataSource } from 'typeorm';
import { ConnectionManager } from './src/common/connectionManager';
import { DbConfig } from './src/common/interfaces';

const connectionOptions = config.get<DbConfig>('db');

export const appDataSource = new DataSource({
  ...ConnectionManager.createConnectionOptions(connectionOptions),
  entities: ['src/DAL/entity/*.ts'],
  logging: true,
  synchronize: false,
  migrations: ['src/DAL/migrations/*.ts'],
  migrationsRun: false,
  migrationsTableName: 'polygon_parts_migrations',
});

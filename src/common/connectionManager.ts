import { readFileSync } from 'fs';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { DataSource, DefaultNamingStrategy, type DataSourceOptions, type Table } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SERVICES } from '../common/constants';
import { DBConnectionError } from '../common/errors';
import type { DbConfig, IConfig } from '../common/interfaces';
import { camelCaseToSnakeCase } from '../common/utils';
import { Part } from '../polygonParts/DAL/part';
import { PolygonPart } from '../polygonParts/DAL/polygonPart';

const customNamingStrategy = new DefaultNamingStrategy();
customNamingStrategy.indexName = (tableOrName: Table | string, columnNames: string[], where?: string): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}${where !== undefined ? '_partial' : ''}_idx`;
};
customNamingStrategy.uniqueConstraintName = (tableOrName: Table | string, columnNames: string[]): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}`;
};
// TODO: add logic if a column name already defined
customNamingStrategy.columnName = (propertyName: string): string => {
  return camelCaseToSnakeCase(propertyName);
};

export const namingStrategy = customNamingStrategy;

@singleton()
export class ConnectionManager {
  private readonly dataSource: DataSource;
  private readonly dataSourceOptions: DataSourceOptions;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    const connectionConfig = this.config.get<DbConfig>('db');
    this.dataSourceOptions = ConnectionManager.createConnectionOptions(connectionConfig);
    this.dataSource = new DataSource(this.dataSourceOptions);
  }

  public static createConnectionOptions(dbConfig: DbConfig): PostgresConnectionOptions {
    const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
    if (enableSslAuth) {
      connectionOptions.password = undefined;
      connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
    }
    return { entities: [Part, PolygonPart], namingStrategy, ...connectionOptions };
  }

  public async init(): Promise<void> {
    try {
      if (!this.isConnected()) {
        this.logger.info({
          msg: `connecting to database ${this.dataSourceOptions.database as string} ${
            'host' in this.dataSourceOptions && this.dataSourceOptions.host !== undefined ? `on ${this.dataSourceOptions.host}` : ''
          }`,
        });
        await this.dataSource.initialize();
      }
    } catch (error) {
      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      this.logger.error({ msg: `failed to connect to database: ${errString}` });
      throw new DBConnectionError();
    }
  }

  public isConnected(): boolean {
    if (!this.dataSource.isInitialized) {
      this.logger.warn({ msg: 'no open connection to database' });
    }
    return this.dataSource.isInitialized;
  }

  public getDataSource(): DataSource {
    if (!this.isConnected()) {
      throw new DBConnectionError();
    }
    return this.dataSource;
  }

  public async destroy(): Promise<void> {
    if (!this.isConnected()) {
      throw new DBConnectionError();
    }
    await this.dataSource.destroy();
  }
}

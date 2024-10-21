import { readFileSync } from 'fs';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SERVICES } from '../common/constants';
import { DBConnectionError } from '../common/errors';
import { DbConfig, IConfig } from '../common/interfaces';

export const CONNECTION_MANAGER_SYMBOL = Symbol('connectionManager');

@singleton()
export class ConnectionManager {
  private readonly dataSource: DataSource;
  private readonly dataSourceOptions: DataSourceOptions;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    const connectionConfig = this.config.get<DbConfig>('db');
    this.dataSourceOptions = ConnectionManager.createConnectionOptions(connectionConfig);
    this.dataSource = new DataSource(this.dataSourceOptions);
  }

  public static createConnectionOptions(dbConfig: DbConfig): DataSourceOptions {
    const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
    if (enableSslAuth) {
      connectionOptions.password = undefined;
      connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
    }
    return connectionOptions;
  }

  public async init(): Promise<void> {
    try {
      if (!this.isConnected()) {
        this.logger.info(
          `connecting to database ${this.dataSourceOptions.database as string} ${
            'host' in this.dataSourceOptions && this.dataSourceOptions.host !== undefined ? `on ${this.dataSourceOptions.host}` : ''
          }`
        );
        await this.dataSource.initialize();
      }
    } catch (error) {
      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      this.logger.error(`failed to connect to database: ${errString}`);
      throw new DBConnectionError();
    }
  }

  public isConnected(): boolean {
    if (!this.dataSource.isInitialized) {
      this.logger.error('no open connection to database');
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

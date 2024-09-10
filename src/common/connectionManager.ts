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
  private appDataSource?: DataSource;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {}

  public static createConnectionOptions(dbConfig: DbConfig): DataSourceOptions {
    const { enableSslAuth, sslPaths, ...connectionOptions } = dbConfig;
    if (enableSslAuth && 'password' in connectionOptions && 'ssl' in connectionOptions) {
      connectionOptions.password = undefined;
      connectionOptions.ssl = { key: readFileSync(sslPaths.key), cert: readFileSync(sslPaths.cert), ca: readFileSync(sslPaths.ca) };
    }
    return connectionOptions;
  }

  public async init(): Promise<void> {
    const connectionConfig = this.config.get<DbConfig>('db');
    this.logger.info(
      `connecting to database ${connectionConfig.database as string} ${connectionConfig.host !== undefined ? `on ${connectionConfig.host}` : ''}`
    );
    try {
      if (this.appDataSource === undefined) {
        const connectionOptions = ConnectionManager.createConnectionOptions(connectionConfig);
        this.appDataSource = new DataSource(connectionOptions);
        await this.appDataSource.initialize();
      }
    } catch (error) {
      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      this.logger.error(`failed to connect to database: ${errString}`);
      throw new DBConnectionError();
    }
  }

  public isConnected(): boolean {
    return this.appDataSource?.isInitialized ?? false;
  }

  public getDataSource(): DataSource {
    if (!this.appDataSource || !this.isConnected()) {
      const msg = 'failed to send request to database: no open connection';
      this.logger.error(msg);
      throw new DBConnectionError();
    }
    return this.appDataSource;
  }
}

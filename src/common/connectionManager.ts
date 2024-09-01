import { readFileSync } from 'fs';
import { DataSourceOptions, DataSource, EntityTarget, Repository, ObjectLiteral } from 'typeorm';
import { inject, singleton } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../common/constants';
import { IConfig, DbConfig } from '../common/interfaces';
import { DBConnectionError } from '../common/errors';
import { Part } from '../DAL/entity/part';

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
    this.logger.info(`connecting to database ${connectionConfig.database as string}${'host' in connectionConfig ? `on ${connectionConfig.host}` : ''}`);
    try {
      if (this.appDataSource === undefined) {
        const connectionOptions = ConnectionManager.createConnectionOptions(connectionConfig);
        this.appDataSource = await new DataSource(connectionOptions).initialize();
      }
    } catch (err) {
      const errString = JSON.stringify(err, Object.getOwnPropertyNames(err));
      this.logger.error(`failed to connect to database: ${errString}`);
      throw new DBConnectionError();
    }
  }

  public isConnected(): boolean {
    return this.appDataSource?.isInitialized ?? false;
  }

  public getPartRepository(): Repository<Part> {
    return this.getRepository(Part);
  }

  private getRepository<T extends ObjectLiteral>(repository: EntityTarget<T>): Repository<T> {
    if (!this.appDataSource || !this.isConnected()) {
      const msg = 'failed to send request to database: no open connection';
      this.logger.error(msg);
      throw new DBConnectionError();
    }
    return this.appDataSource.getRepository(repository);
  }
}

import { readFileSync } from 'fs';
import { Logger } from '@map-colonies/js-logger';
import { types } from 'pg';
import { inject, singleton } from 'tsyringe';
import { DataSource, type DataSourceOptions, type EntityManager } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SERVICES } from '../common/constants';
import { DBConnectionError } from '../common/errors';
import type { DbConfig, IConfig } from '../common/interfaces';
import { Part } from '../polygonParts/DAL/part';
import { PolygonPart } from '../polygonParts/DAL/polygonPart';
import { namingStrategy } from '../polygonParts/DAL/utils';

// postgresql - parse NUMERIC and BIGINT as numbers instead of strings
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));
types.setTypeParser(types.builtins.FLOAT4, (value) => parseFloat(value));

@singleton()
export class ConnectionManager {
  private readonly dataSource: DataSource;
  private readonly dataSourceOptions: DataSourceOptions;
  private readonly schema: DbConfig['schema'];

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    const connectionConfig = this.config.get<DbConfig>('db');
    this.schema = connectionConfig.schema;
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
    let schemaExists = false;

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

    try {
      this.logger.info({
        msg: `checking if schema ${this.schema} exists on database`,
      });
      schemaExists = await this.schemaExists();
    } catch (error) {
      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      this.logger.error({ msg: `failed to verify if schema exists: ${errString}` });
      throw new DBConnectionError();
    }

    if (!schemaExists) {
      this.logger.error({ msg: `schema '${this.schema}' does not exists` });
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

  public async entityExists(entityManager: EntityManager, entityName: string): Promise<boolean> {
    const exists = await entityManager
      .createQueryBuilder()
      .select()
      .from('information_schema.tables', 'information_schema.tables')
      .where(`table_schema = '${this.schema}'`)
      .andWhere(`table_name = '${entityName}'`)
      .getExists();
    return exists;
  }

  private async schemaExists(): Promise<boolean> {
    const exists = await this.dataSource
      .createQueryBuilder()
      .select('n.nspname')
      .from('pg_namespace', 'n')
      .where('n.nspname = :schemaName', { schemaName: this.schema })
      .getExists();
    return exists;
  }
}

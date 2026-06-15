import { DataSource, type DataSourceOptions, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { setRepositoryTablePath } from '../../../../src/polygonParts/DAL/utils';
import { getConfigForTests } from '../../../configurations/config';
import type { InsertPayload } from './types';

export class HelperDB {
  private readonly appDataSource: DataSource;
  private readonly schema: string;

  public constructor(
    private readonly dataSourceOptions: DataSourceOptions,
    schema: string
  ) {
    this.appDataSource = new DataSource(this.dataSourceOptions);
    this.schema = schema;
  }

  public async initConnection(): Promise<void> {
    await this.appDataSource.initialize();
  }

  public async destroyConnection(): Promise<void> {
    await this.appDataSource.destroy();
  }

  public async sync(): Promise<void> {
    await this.appDataSource.runMigrations();
  }

  public async createSchema(): Promise<void> {
    await this.appDataSource.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
  }

  public async dropSchema(): Promise<void> {
    await this.appDataSource.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
  }

  public async createTable(table: string): Promise<void> {
    await this.appDataSource.query(`CREATE TABLE IF NOT EXISTS ${this.schema}.${table}()`);
  }

  public async tableExists(table: string): Promise<boolean> {
    const exists = await this.appDataSource
      .createQueryBuilder()
      .select()
      .from('information_schema.tables', 'information_schema.tables')
      .where(`table_schema = '${this.schema}'`)
      .andWhere(`table_name = '${table}'`)
      .getExists();
    return exists;
  }

  public async query<T>(query: string): Promise<T> {
    const response = await this.appDataSource.query<T>(query);
    return response;
  }

  public async find<Entity extends ObjectLiteral>(table: string, target: EntityTarget<Entity>): Promise<Entity[]> {
    const repository = this.appDataSource.getRepository(target);
    setRepositoryTablePath(repository, table);
    const response = await repository.find();
    return response;
  }

  public async insert<Entity extends ObjectLiteral>(table: string, target: EntityTarget<Entity>, insertValues: Entity | Entity[]): Promise<void> {
    const repository = this.appDataSource.getRepository(target);
    setRepositoryTablePath(repository, table);
    await repository.insert(insertValues);
  }

  public async getTableData(table: string): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.appDataSource.query(`SELECT * FROM ${this.schema}.${table}`);
    return data as unknown[];
  }

  public async getTableDataWithGeoJSON(table: string, geometryColumn = 'footprint'): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.appDataSource.query(
      `SELECT *, ST_AsGeoJSON(${geometryColumn})::json as ${geometryColumn}_geojson FROM ${this.schema}.${table}`
    );
    return data as unknown[];
  }

  /**
   * Creates a table that inherits from a parent table for test initialization
   * @param tableName - The name of the table to create
   * @param parentTable - The parent table to inherit from (e.g., 'polygon_parts', 'history', 'validation_parts')
   */
  public async createInheritedTable(tableName: string, parentTable: string): Promise<void> {
    await this.appDataSource.query(
      `CREATE TABLE ${this.schema}.${tableName} (LIKE ${this.schema}.${parentTable} INCLUDING ALL) INHERITS (${this.schema}.${parentTable})`
    );
  }

  /**
   * Inserts polygon parts data directly into the polygon_parts table from a validation payload
   * This bypasses the API and inserts data directly for test setup purposes
   */
  public async insertPolygonPartsFromValidationPayload(polygonPartsTableName: string, payload: InsertPayload): Promise<void> {
    const arraySeparator = getConfigForTests().get<string>('application.arraySeparator');
    const { partsData, ...metadata } = payload;

    for (const [index, feature] of partsData.features.entries()) {
      const { geometry, properties } = feature;
      const partId = properties.id;
      const sensors = Array.isArray(properties.sensors) ? properties.sensors.join(arraySeparator) : properties.sensors;
      const countries = properties.countries
        ? Array.isArray(properties.countries)
          ? properties.countries.join(arraySeparator)
          : properties.countries
        : null;
      const cities = properties.cities ? (Array.isArray(properties.cities) ? properties.cities.join(arraySeparator) : properties.cities) : null;

      await this.appDataSource.query(
        `INSERT INTO ${this.schema}.${polygonPartsTableName} (
          product_id,
          product_type,
          catalog_id,
          source_id,
          source_name,
          product_version,
          imaging_time_begin_utc,
          imaging_time_end_utc,
          resolution_degree,
          resolution_meter,
          source_resolution_meter,
          horizontal_accuracy_ce90,
          sensors,
          countries,
          cities,
          description,
          footprint,
          part_id,
          insertion_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, ST_GeomFromGeoJSON($17), $18, $19
        )`,
        [
          metadata.productId,
          metadata.productType,
          metadata.catalogId,
          properties.sourceId ?? null,
          properties.sourceName,
          metadata.productVersion,
          properties.imagingTimeBeginUTC,
          properties.imagingTimeEndUTC,
          properties.resolutionDegree,
          properties.resolutionMeter,
          properties.sourceResolutionMeter,
          properties.horizontalAccuracyCE90,
          sensors,
          countries,
          cities,
          properties.description ?? null,
          JSON.stringify(geometry),
          partId,
          index + 1, // insertion_order starts at 1
        ]
      );
    }
  }
}

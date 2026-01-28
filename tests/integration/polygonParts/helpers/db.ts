/* eslint-disable @typescript-eslint/no-magic-numbers */
import { faker } from '@faker-js/faker';
import {
  CORE_VALIDATIONS,
  INGESTION_VALIDATIONS,
  RASTER_PRODUCT_TYPE_LIST,
  RasterProductTypes,
  polygonPartsFeatureSchema,
} from '@map-colonies/raster-shared';
import { randomPolygon } from '@turf/random';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { randexp } from 'randexp';
import { DataSource, type DataSourceOptions, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { DatabaseCreateContext, createDatabase, dropDatabase } from 'typeorm-extension';
import { z } from 'zod';
import { setRepositoryTablePath } from '../../../../src/polygonParts/DAL/utils';
import type { ExistsRequestBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import type { DeepPartial } from './types';

// Helper type for test data insertion - accepts string dates instead of Date objects
type InsertPayload = Omit<PolygonPartsPayload, 'jobType' | 'partsData'> & {
  partsData: {
    type: 'FeatureCollection';
    features: {
      type: string;
      geometry: Polygon | MultiPolygon;
      properties: {
        id: string;
        horizontalAccuracyCE90: number;
        resolutionMeter: number;
        imagingTimeBeginUTC: string | Date;
        imagingTimeEndUTC: string | Date;
        sensors: string[];
        sourceName: string;
        resolutionDegree: number;
        sourceResolutionMeter: number;
        countries?: string[];
        cities?: string[];
        description?: string;
        sourceId?: string;
      };
    }[];
  };
};

type PolygonPartFeature = z.infer<typeof polygonPartsFeatureSchema>;
type PartialPolygonPartsPayload = DeepPartial<Omit<PolygonPartsPayload, 'partsData'>> & {
  partsData?: {
    type?: 'FeatureCollection';
    features?: Partial<PolygonPartFeature>[];
  };
};
const generateProductId = (): string => randexp(INGESTION_VALIDATIONS.productId.pattern);
const generateProductType = (): RasterProductTypes => faker.helpers.arrayElement(RASTER_PRODUCT_TYPE_LIST);

export const createDB = async (options: Partial<DatabaseCreateContext>): Promise<void> => {
  await createDatabase({ ...options, synchronize: false, ifNotExist: true });
};

export const deleteDB = async (options: DataSourceOptions): Promise<void> => {
  await dropDatabase({ options });
};

export const generateFeatureId = (): NonNullable<Feature['id']> => {
  return faker.helpers.arrayElement([faker.number.float({ max: Number.MAX_VALUE }), faker.string.uuid(), faker.string.alphanumeric({ length: 20 })]);
};

export const generatePolygon = (
  options: Parameters<typeof randomPolygon>[1] = {
    bbox: [-170, -80, 170, 80],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    max_radial_length: faker.number.float({ min: Number.EPSILON, max: 10 }),
  } // polygon maximum extent cannot exceed [-180,-90,180,90]
): Polygon => {
  return randomPolygon(1, options).features[0].geometry;
};

export const generatePolygonPart = (): PolygonPartFeature => {
  const date1 = faker.date.past();
  const date2 = faker.date.past();
  const [dateOlder, dateRecent] = date1 < date2 ? [date1, date2] : [date2, date1];
  return {
    type: 'Feature',
    id: generateFeatureId(),
    geometry: generatePolygon(),
    properties: {
      id: faker.string.uuid(),
      horizontalAccuracyCE90: faker.number.float(INGESTION_VALIDATIONS.horizontalAccuracyCE90),
      imagingTimeBeginUTC: dateOlder,
      imagingTimeEndUTC: dateRecent,
      resolutionDegree: faker.number.float(CORE_VALIDATIONS.resolutionDeg),
      resolutionMeter: faker.number.float(INGESTION_VALIDATIONS.resolutionMeter),
      sensors: faker.helpers.multiple(
        () => {
          return faker.word.words();
        },
        { count: { min: 1, max: 3 } }
      ),
      sourceName: faker.word.words().replace(' ', '_'),
      sourceResolutionMeter: faker.number.float(INGESTION_VALIDATIONS.resolutionMeter),
      cities: faker.helpers.maybe(() => {
        return faker.helpers.multiple(
          () => {
            return faker.word.words();
          },
          { count: { min: 1, max: 3 } }
        );
      }),
      countries: faker.helpers.maybe(() => {
        return faker.helpers.multiple(
          () => {
            return faker.word.words();
          },
          { count: { min: 1, max: 3 } }
        );
      }),
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      description: faker.helpers.maybe(() => faker.word.words({ count: { min: 0, max: 10 } })),
      sourceId: faker.helpers.maybe(() => faker.word.words()),
    },
  };
};

export const generateExistsPayload = (): ExistsRequestBody => {
  return {
    productId: generateProductId(),
    productType: generateProductType(),
  };
};

export function generatePolygonPartsPayload(partsCount: number): PolygonPartsPayload;
export function generatePolygonPartsPayload(template: PartialPolygonPartsPayload): PolygonPartsPayload;
export function generatePolygonPartsPayload(input: number | PartialPolygonPartsPayload): PolygonPartsPayload {
  const layerMetadata = {
    catalogId: faker.string.uuid(),
    productId: generateProductId(),
    productType: generateProductType(),
    productVersion: randexp(INGESTION_VALIDATIONS.productVersion.pattern),
    jobType: faker.helpers.arrayElement(['POLYGON_PARTS']),
  } satisfies Omit<PolygonPartsPayload, 'partsData'>;

  if (typeof input === 'number') {
    const partsCount = input;
    return {
      ...layerMetadata,
      partsData: {
        type: 'FeatureCollection',
        features: Array.from({ length: partsCount }, generatePolygonPart),
      },
    };
  }

  const { partsData: templatePartsData, ...templateLayerMetadata } = structuredClone(input);
  const featureCount = templatePartsData?.features?.length ?? 1;

  return {
    ...layerMetadata,
    ...templateLayerMetadata,
    partsData: {
      type: 'FeatureCollection',
      features: Array.from({ length: featureCount }, generatePolygonPart).map((partData, index) => {
        const templateFeature = templatePartsData?.features?.[index];

        if (!templateFeature) {
          return partData;
        }

        return {
          ...partData,
          ...(templateFeature.id !== undefined && { id: templateFeature.id }),
          ...(templateFeature.geometry !== undefined && { geometry: templateFeature.geometry }),
          ...(templateFeature.properties !== undefined && {
            properties: {
              ...partData.properties,
              ...templateFeature.properties,
            },
          }),
        };
      }),
    },
  };
}

export class HelperDB {
  private readonly appDataSource: DataSource;

  public constructor(private readonly dataSourceOptions: DataSourceOptions, private readonly schema: string) {
    this.appDataSource = new DataSource(this.dataSourceOptions);
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

  public async createSchema(schema: string): Promise<void> {
    await this.appDataSource.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  }

  public async dropSchema(schema: string): Promise<void> {
    await this.appDataSource.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  }

  public async createTable(table: string, schema: string): Promise<void> {
    await this.appDataSource.query(`CREATE TABLE IF NOT EXISTS ${schema}.${table}()`);
  }

  public async tableExists(table: string, schema: string): Promise<boolean> {
    const exists = await this.appDataSource
      .createQueryBuilder()
      .select()
      .from('information_schema.tables', 'information_schema.tables')
      .where(`table_schema = '${schema}'`)
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

  public async getTableData(table: string, schema: string): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.appDataSource.query(`SELECT * FROM ${schema}.${table}`);
    return data as unknown[];
  }

  public async getTableDataWithGeoJSON(table: string, schema: string, geometryColumn = 'footprint'): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.appDataSource.query(
      `SELECT *, ST_AsGeoJSON(${geometryColumn})::json as ${geometryColumn}_geojson FROM ${schema}.${table}`
    );
    return data as unknown[];
  }

  /**
   * Creates a table that inherits from a parent table for test initialization
   * @param tableName - The name of the table to create
   * @param schema - The schema where the table should be created
   * @param parentTable - The parent table to inherit from (e.g., 'polygon_parts', 'history', 'validation_parts')
   */
  public async createInheritedTable(tableName: string, schema: string, parentTable: string): Promise<void> {
    await this.appDataSource.query(
      `CREATE TABLE ${schema}.${tableName} (LIKE ${schema}.${parentTable} INCLUDING ALL) INHERITS (${schema}.${parentTable})`
    );
  }

  /**
   * Inserts polygon parts data directly into the polygon_parts table from a validation payload
   * This bypasses the API and inserts data directly for test setup purposes
   */
  public async insertPolygonPartsFromValidationPayload(
    polygonPartsTableName: string,
    schema: string,
    payload: InsertPayload,
    arraySeparator: string
  ): Promise<void> {
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
        `INSERT INTO ${schema}.${polygonPartsTableName} (
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

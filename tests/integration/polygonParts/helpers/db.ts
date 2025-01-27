import { faker } from '@faker-js/faker';
import { PolygonPart, RASTER_PRODUCT_TYPES, VALIDATIONS } from '@map-colonies/mc-model-types';
import { randomPolygon } from '@turf/random';
import { randexp } from 'randexp';
import { DataSource, type DataSourceOptions, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { DatabaseCreateContext, createDatabase, dropDatabase } from 'typeorm-extension';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import type { DeepPartial } from './types';

export const createDB = async (options: Partial<DatabaseCreateContext>): Promise<void> => {
  await createDatabase({ ...options, synchronize: false, ifNotExist: false });
};

export const deleteDB = async (options: DataSourceOptions): Promise<void> => {
  await dropDatabase({ options });
};

export const createPolygonPart = (): PolygonPart => {
  const date1 = faker.date.past();
  const date2 = faker.date.past();
  const [dateOlder, dateRecent] = date1 < date2 ? [date1, date2] : [date2, date1];
  return {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers, @typescript-eslint/naming-convention
    footprint: randomPolygon(1, { bbox: [-170, -80, 170, 80], max_radial_length: 10 }).features[0].geometry, // polygon maximum extent cannot exceed [-180,-90,180,90]
    horizontalAccuracyCE90: faker.number.float(VALIDATIONS.horizontalAccuracyCE90),
    imagingTimeBeginUTC: dateOlder,
    imagingTimeEndUTC: dateRecent,
    resolutionDegree: faker.number.float(VALIDATIONS.resolutionDeg),
    resolutionMeter: faker.number.float(VALIDATIONS.resolutionMeter),
    sensors: faker.helpers.multiple(
      () => {
        return faker.word.words();
      },
      { count: { min: 1, max: 3 } }
    ),
    sourceName: faker.word.words().replace(' ', '_'),
    sourceResolutionMeter: faker.number.float(VALIDATIONS.resolutionMeter),
    cities: faker.helpers.maybe(() => {
      return faker.helpers.multiple(
        () => {
          return faker.word.words();
        },
        { count: { min: 0, max: 3 } }
      );
    }),
    countries: faker.helpers.maybe(() => {
      return faker.helpers.multiple(
        () => {
          return faker.word.words();
        },
        { count: { min: 0, max: 3 } }
      );
    }),
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    description: faker.helpers.maybe(() => faker.word.words({ count: { min: 0, max: 10 } })),
    sourceId: faker.helpers.maybe(() => faker.word.words()),
  };
};

// TODO: merge with generateRequest() in requestsMocks.ts
export function generatePolygonPartsPayload(partsCount: number): PolygonPartsPayload;
export function generatePolygonPartsPayload(template: DeepPartial<PolygonPartsPayload>): PolygonPartsPayload;
export function generatePolygonPartsPayload(input: number | DeepPartial<PolygonPartsPayload>): PolygonPartsPayload {
  const layerMetadata = {
    catalogId: faker.string.uuid(),
    productId: randexp(VALIDATIONS.productId.pattern),
    productType: faker.helpers.arrayElement(RASTER_PRODUCT_TYPES),
    productVersion: randexp(VALIDATIONS.productVersion.pattern),
  };

  if (typeof input === 'number') {
    const partsCount = input;
    return {
      ...layerMetadata,
      partsData: Array.from({ length: partsCount }, createPolygonPart),
    };
  }

  const { partsData: templatePartsData, ...templateLayerMetadata } = input;

  return {
    ...layerMetadata,
    ...templateLayerMetadata,
    partsData: Array.from({ length: templatePartsData?.length ?? 1 }, createPolygonPart).map((partData, index) => {
      const templatePartsDataValues = templatePartsData?.[index];
      return templatePartsDataValues ? { ...partData, ...templatePartsDataValues } : partData;
    }),
  };
}

export class HelperDB {
  private readonly appDataSource: DataSource;

  public constructor(private readonly dataSourceOptions: DataSourceOptions) {
    this.appDataSource = new DataSource(this.dataSourceOptions);
  }

  public async initConnection(): Promise<void> {
    await this.appDataSource.initialize();
  }

  public async destroyConnection(): Promise<void> {
    await this.appDataSource.destroy();
  }

  public async sync(): Promise<void> {
    await this.appDataSource.runMigrations({ transaction: 'all' });
  }

  public async createSchema(schema: string): Promise<void> {
    await this.appDataSource.query(`CREATE SCHEMA ${schema}`);
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
    repository.metadata.tablePath = table; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283
    const response = await repository.find();
    return response;
  }

  public async insert<Entity extends ObjectLiteral>(table: string, target: EntityTarget<Entity>, insertValues: Entity | Entity[]): Promise<void> {
    const repository = this.appDataSource.getRepository(target);
    repository.metadata.tablePath = table; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283
    await repository.insert(insertValues);
  }
}

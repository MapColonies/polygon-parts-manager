/* eslint-disable @typescript-eslint/no-magic-numbers */
import { faker } from '@faker-js/faker';
import { CORE_VALIDATIONS, INGESTION_VALIDATIONS, RASTER_PRODUCT_TYPE_LIST, RasterProductTypes, polygonPartsFeatureSchema } from '@map-colonies/raster-shared';
import { randomPolygon } from '@turf/random';
import type { Feature, Polygon } from 'geojson';
import { randexp } from 'randexp';
import { DataSource, type DataSourceOptions, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { DatabaseCreateContext, createDatabase, dropDatabase } from 'typeorm-extension';
import { z } from 'zod';
import { setRepositoryTablePath } from '../../../../src/polygonParts/DAL/utils';
import type { ExistsRequestBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import type { DeepPartial } from './types';

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

  public async createValidationsStoredProcedure(schema: string): Promise<void> {
    // Migrations should have already created base_parts, validation_parts, and enums
    // This helper just ensures the stored procedure exists for test usage
    await this.appDataSource.query(`
      CREATE OR REPLACE PROCEDURE ${schema}.create_polygon_parts_validations_tables(IN qualified_identifier text)
      LANGUAGE plpgsql
      AS $BODY$
      DECLARE
        ident_parts   name[] := parse_ident(qualified_identifier)::name[];
        schema_name   text   := ident_parts[1];
        child_table   text   := ident_parts[2];
        schm_child    text   := format('%I.%I', schema_name, child_table);
        child_exists  boolean;
      BEGIN
        IF schema_name IS NULL OR child_table IS NULL THEN
            RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier (schema.table)', qualified_identifier;
        END IF;

        SELECT to_regclass(schm_child) IS NOT NULL INTO child_exists;

        IF NOT child_exists THEN
            EXECUTE format('CREATE TABLE %s () INHERITS (%I.validation_parts)', schm_child, schema_name);
        END IF;

        -- Create indexes (idempotent with IF NOT EXISTS)
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s USING GIST (footprint)', child_table || '_footprint_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (validated)', child_table || '_validated_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (ingestion_date_utc)', child_table || '_ingestion_date_utc_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (imaging_time_begin_utc)', child_table || '_imaging_time_begin_utc_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (imaging_time_end_utc)', child_table || '_imaging_time_end_utc_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (resolution_degree)', child_table || '_resolution_degree_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (resolution_meter)', child_table || '_resolution_meter_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (product_id)', child_table || '_product_id_idx', schm_child);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (product_type)', child_table || '_product_type_idx', schm_child);
      END;
      $BODY$;
    `);
  }
}

import config from 'config';
import { validate, version } from 'uuid';
import { DEFAULT_SCHEMA } from '../../../../src/common/constants';
import { ApplicationConfig } from '../../../../src/common/interfaces';
import { DBSchema, EntityNames, InsertPartData, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NullableRecordValues<T extends Record<PropertyKey, any>> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? T[K] : Exclude<T[K] | null, undefined>;
};

const applicationConfig = config.get<ApplicationConfig>('application');
const schema = config.get<DBSchema>('db.schema') ?? DEFAULT_SCHEMA;

function getDatabaseObjectQualifiedName(schema: string, value: string): string {
  return `${schema}.${value}`;
}

export function getEntitiesNames(polygonPartsPayload: PolygonPartsPayload): EntityNames {
  const { productId, productType } = polygonPartsPayload;
  const baseName = [productId, productType].join('_').toLowerCase();
  const partsEntityName = `${applicationConfig.entities.parts.namePrefix}${baseName}${applicationConfig.entities.parts.nameSuffix}`;
  const polygonPartsEntityName = `${applicationConfig.entities.polygonParts.namePrefix}${baseName}${applicationConfig.entities.polygonParts.nameSuffix}`;

  return {
    parts: { entityName: partsEntityName, databaseObjectQualifiedName: getDatabaseObjectQualifiedName(schema, partsEntityName) },
    polygonParts: { entityName: polygonPartsEntityName, databaseObjectQualifiedName: getDatabaseObjectQualifiedName(schema, polygonPartsEntityName) },
  };
}

export function toPostgresResponse(records: InsertPartData[]): NullableRecordValues<InsertPartData>[] {
  return records.map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    return { cities, countries, description, sourceId, ...props };
  });
}

// TODO: extend jest instead => update matchers in tests
export function isValidUUIDv4(uuidV4: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return validate(uuidV4) && version(uuidV4) === 4;
}

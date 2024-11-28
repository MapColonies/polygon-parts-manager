import config from 'config';
import { DefaultNamingStrategy, type Table } from 'typeorm';
import { DEFAULT_SCHEMA } from '../../common/constants';
import type { ApplicationConfig } from '../../common/interfaces';
import { camelCaseToSnakeCase } from '../../common/utils';
import type { DBSchema, EntityNames, InsertPartData, PolygonPartsPayload } from '../models/interfaces';

const customNamingStrategy = new DefaultNamingStrategy();
customNamingStrategy.indexName = (tableOrName: Table | string, columnNames: string[], where?: string): string => {
  /* istanbul ignore next */
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}${where !== undefined ? '_partial' : ''}_idx`;
};
customNamingStrategy.uniqueConstraintName = (tableOrName: Table | string, columnNames: string[]): string => {
  /* istanbul ignore next */
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}_uq`;
};
// TODO: add logic if a column name already defined
customNamingStrategy.columnName = (propertyName: string): string => {
  return camelCaseToSnakeCase(propertyName);
};
customNamingStrategy.primaryKeyName = (tableOrName: Table | string): string => {
  /* istanbul ignore next */
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_pkey`;
};

const arraySeparator = config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');
const applicationConfig = config.get<ApplicationConfig>('application');
const schema = config.get<DBSchema>('db.schema') ?? DEFAULT_SCHEMA;

export function payloadToInsertPartsData(polygonPartsPayload: PolygonPartsPayload): InsertPartData[] {
  const { partsData, ...layerMetadata } = polygonPartsPayload;

  return partsData.map((partData) => {
    return {
      ...layerMetadata,
      ...partData,
      sensors: partData.sensors.join(arraySeparator),
      countries: partData.countries?.join(arraySeparator),
      cities: partData.cities?.join(arraySeparator),
    };
  });
}

export const getDatabaseObjectQualifiedName = (value: string): string => {
  return `${schema}.${value}`;
};

export const getEntitiesNames = (polygonPartsPayload: PolygonPartsPayload): EntityNames => {
  const { productId, productType } = polygonPartsPayload;
  const baseName = [productId, productType].join('_').toLowerCase();
  const partsEntityName = `${applicationConfig.entities.parts.namePrefix}${baseName}${applicationConfig.entities.parts.nameSuffix}`;
  const polygonPartsEntityName = `${applicationConfig.entities.polygonParts.namePrefix}${baseName}${applicationConfig.entities.polygonParts.nameSuffix}`;

  return {
    parts: { entityName: partsEntityName, databaseObjectQualifiedName: getDatabaseObjectQualifiedName(partsEntityName) },
    polygonParts: { entityName: polygonPartsEntityName, databaseObjectQualifiedName: getDatabaseObjectQualifiedName(polygonPartsEntityName) },
  };
};

export const namingStrategy = customNamingStrategy;

import { DefaultNamingStrategy, type Table } from 'typeorm';
import type { ApplicationConfig } from '../../common/interfaces';
import { camelCaseToSnakeCase } from '../../common/utils';
import type { FindPolygonPartsResponse, FindPolygonPartsResponseItem, InsertPartData, PolygonPartsPayload } from '../models/interfaces';

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
  return getMappedColumnName(propertyName);
};
customNamingStrategy.primaryKeyName = (tableOrName: Table | string): string => {
  /* istanbul ignore next */
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_pkey`;
};

export const getMappedColumnName = (propertyName: string): string => {
  return camelCaseToSnakeCase(propertyName);
};

export const payloadToInsertPartsData = (
  polygonPartsPayload: PolygonPartsPayload,
  arraySeparator: ApplicationConfig['arraySeparator']
): InsertPartData[] => {
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
};

export const polygonPartsDataToPayload = (
  polygonPartsData: FindPolygonPartsResponseItem[],
  arraySeparator: ApplicationConfig['arraySeparator']
): FindPolygonPartsResponse => {
  return polygonPartsData.map((polygonPartData) => {
    const { cities, countries, description = null, sensors, sourceId = null, ...polygonPartsData } = polygonPartData;

    return {
      ...polygonPartsData,
      cities: cities?.split(arraySeparator) ?? null,
      countries: countries?.split(arraySeparator) ?? null,
      description,
      sourceId,
      sensors: sensors.split(arraySeparator),
    };
  });
};

export const namingStrategy = customNamingStrategy;

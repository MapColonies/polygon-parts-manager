import config from 'config';
import { DefaultNamingStrategy, type Table } from 'typeorm';
import type { ApplicationConfig } from '../../common/interfaces';
import { camelCaseToSnakeCase } from '../../common/utils';
import type { NonGeneratedCommonRecord, PolygonPartsPayload } from '../models/interfaces';

const customNamingStrategy = new DefaultNamingStrategy();
customNamingStrategy.indexName = (tableOrName: Table | string, columnNames: string[], where?: string): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}${where !== undefined ? '_partial' : ''}_idx`;
};
customNamingStrategy.uniqueConstraintName = (tableOrName: Table | string, columnNames: string[]): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_${columnNames.join('_')}`;
};
// TODO: add logic if a column name already defined
customNamingStrategy.columnName = (propertyName: string): string => {
  return camelCaseToSnakeCase(propertyName);
};
customNamingStrategy.primaryKeyName = (tableOrName: Table | string): string => {
  return `${typeof tableOrName === 'string' ? tableOrName : tableOrName.name}_pkey`;
};

const arraySeparator = config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');

export function payloadToRecords(polygonPartsPayload: PolygonPartsPayload): NonGeneratedCommonRecord[] {
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

export const namingStrategy = customNamingStrategy;

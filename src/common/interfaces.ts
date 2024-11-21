import type { IRasterCatalogUpsertRequestBody } from '@map-colonies/mc-model-types';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface ApplicationConfig {
  arraySeparator: string;
  createPolygonPartsTablesStoredProcedure: string;
  updatePolygonPartsTablesStoredProcedure: string;
  entities: {
    parts: {
      namePrefix: string;
      nameSuffix: string;
    };
    polygonParts: {
      namePrefix: string;
      nameSuffix: string;
    };
  };
}

export type DbConfig = PostgresConnectionOptions & {
  enableSslAuth: boolean;
  sslPaths: { ca: string; cert: string; key: string };
};

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

//#region catalogClient
// TODO: raster-catalog-manager defines findRecords input which requires the definition of each property (instead of partial) for no reason - use this fix until upstream type is fixed
export type FindOptions = Partial<{
  id: string;
  metadata: Partial<IRasterCatalogUpsertRequestBody['metadata']>;
  links: Partial<IRasterCatalogUpsertRequestBody['links']>;
}>;
export type FindResponse = Partial<IRasterCatalogUpsertRequestBody>[];
//#endregion catalogClient

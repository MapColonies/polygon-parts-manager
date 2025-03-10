import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface ApplicationConfig {
  chunkSize: number;
  arraySeparator: string;
  createPolygonPartsTablesStoredProcedure: string;
  updatePolygonPartsTablesStoredProcedure: string;
  entities: {
    parts: {
      namePrefix: Lowercase<string>;
      nameSuffix: Lowercase<string>;
    };
    polygonParts: {
      find: {
        maxDecimalDigits: number;
      };
      namePrefix: Lowercase<string>;
      nameSuffix: Lowercase<string>;
      minAreaSquareDeg: number;
    };
  };
  aggregation: {
    fixGeometry: {
      enabled: boolean;
      bufferSizeDeg: number;
      bufferStyleParameters: string;
    };
    simplifyGeometry: {
      enabled: boolean;
      toleranceDeg: number;
    };
    maxDecimalDigits: number;
  };
}

export interface DbConfig extends PostgresConnectionOptions {
  enableSslAuth: boolean;
  sslPaths: { ca: string; cert: string; key: string };
  schema: Lowercase<NonNullable<PostgresConnectionOptions['schema']>>;
}

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

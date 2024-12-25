import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export interface ApplicationConfig {
  chunkSize: number;
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
  aggregation: {
    fixGeometry: {
      enabled: boolean;
      bufferSizeDeg: number;
    };
    maxDecimalDigits: number;
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

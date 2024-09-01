import type { DataSourceOptions } from 'typeorm';

export type DbConfig = DataSourceOptions & {
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

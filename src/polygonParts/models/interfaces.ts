import type { Logger } from '@map-colonies/js-logger';
import type {
  IPolygonPart,
  PolygonPart,
  PolygonPartsPayload as PolygonPartsPayloadType,
  ProductType as ProductTypeEnum,
} from '@map-colonies/mc-model-types';
import type { EntityManager } from 'typeorm';
import type { DbConfig } from '../../common/interfaces';
import type { EnsureType } from '../../common/types';
import { PRODUCT_TYPES } from './constants';

interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}
interface CommonProperties extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
}
interface PartProperties extends Readonly<Pick<IPolygonPart, 'id'>> {}
interface PolygonPartProperties extends Readonly<Pick<IPolygonPart, 'id' | 'partId'>> {}

/**
 * Polygon parts ingestion payload
 */
export interface PolygonPartsPayload extends Omit<PolygonPartsPayloadType, 'productType'> {
  readonly productType: ProductType;
}

/**
 * Common record properties of part and polygon part
 */
export interface CommonRecord extends CommonProperties {
  readonly ingestionDateUTC: Date;
}

/**
 * Part record properties of the raw ingested part
 */
export interface PartRecord extends CommonProperties, PartProperties {
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

/**
 * Polygon part record properties of the processed parts
 */
export interface PolygonPartRecord extends CommonProperties, PolygonPartProperties {
  readonly insertionOrder: number;
}

/**
 * Ingestion properties of polygon parts for create and update operations on DB
 */
export interface IngestionProperties extends Omit<CommonProperties, 'ingestionDateUTC'> {
  readonly ingestionDateUTC: undefined;
}

/**
 * Base ingestion context used for interaction with the data source
 */
export interface BaseIngestionContext {
  entityManager: EntityManager;
  logger: Logger;
  polygonPartsPayload: PolygonPartsPayload;
}

/**
 * Ingestion context used for interaction with the data source
 */
export interface IngestionContext extends BaseIngestionContext {
  entityNames: EntityNames;
}

/**
 * Properties describing a name of an entity
 */
export interface EntityName {
  entityName: string;
  databaseObjectQualifiedName: string;
}

/**
 * Properties describing parts & polygon parts entities names
 */
export interface EntityNames {
  parts: EntityName;
  polygonParts: EntityName;
}

/**
 * DB schema type
 */
export type DBSchema = DbConfig['schema'];

/**
 * Product type values acceptable for polygon parts
 */
export type ProductType = Extract<`${ProductTypeEnum}`, EnsureType<(typeof PRODUCT_TYPES)[number], `${ProductTypeEnum}`>>;

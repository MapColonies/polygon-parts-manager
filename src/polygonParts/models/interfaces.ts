import type { Logger } from '@map-colonies/js-logger';
import type { PolygonPart, PolygonPartsPayload as PolygonPartsPayloadType, ProductType as ProductTypeEnum } from '@map-colonies/mc-model-types';
import type { EntityManager } from 'typeorm';
import type { DbConfig } from '../../common/interfaces';
import type { EnsureType } from '../../common/types';
import { PRODUCT_TYPES } from './constants';

interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}

/**
 * Common record properties of part and polygon part
 */
export interface NonGeneratedCommonRecord extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
}

/**
 * Polygon parts ingestion payload
 */
export interface PolygonPartsPayload extends Omit<PolygonPartsPayloadType, 'productType'> {
  readonly productType: ProductType;
}

/**
 * Common record properties of part and polygon part
 */
export interface CommonRecord extends NonGeneratedCommonRecord {
  readonly ingestionDateUTC: Date;
}

/**
 * Part record properties of the raw ingested part
 */
export interface PartRecord extends CommonRecord {
  readonly id: string;
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

/**
 * Polygon part record properties of the processed parts
 */
export interface PolygonPartRecord extends CommonRecord {
  readonly id: string;
  readonly partId: string;
  readonly insertionOrder: number;
}

/**
 * Ingestion properties of polygon parts for create and update operations on DB
 */
export interface IngestionProperties extends NonGeneratedCommonRecord {
  readonly ingestionDateUTC: undefined;
}
/**
 * Base context used for interaction with the data source
 */

export interface BaseContext {
  entityManager: EntityManager;
  logger: Logger;
  polygonPartsPayload: PolygonPartsPayload;
}

/**
 * Base ingestion context used for interaction with the data source
 */
export interface BaseIngestionContext extends BaseContext {}

/**
 * Base update context used for interaction with the data source
 */
export interface BaseUpdateContext extends BaseContext {}

/**
 * Table names availability verification context
 */
export interface VerifyAvailableTableNamesContext extends Pick<BaseContext, 'entityManager' | 'logger' | 'polygonPartsPayload'> {}

/**
 * Table names verification context
 */
export interface VerifyTablesExistsContext extends Pick<BaseContext, 'entityManager' | 'logger' | 'polygonPartsPayload'> {}

/**
 * Table creation context
 */
export interface CreateTablesContext extends Pick<BaseContext, 'entityManager' | 'logger'> {
  entityNames: EntityNames;
}

/**
 * Part insertion context
 */
export interface InsertContext extends BaseContext {
  entityNames: EntityNames;
}

/**
 * Polygon parts calculation context
 */
export interface CalculatePolygonPartsContext extends Pick<BaseContext, 'entityManager' | 'logger'> {
  entityNames: EntityNames;
}

/**
 * Ingestion context used for interaction with the data source
 */
export interface IngestionContext extends InsertContext {}
export interface UpdateContext extends InsertContext {}

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

export interface IsSwapQueryParams {
  isSwap: boolean;
}

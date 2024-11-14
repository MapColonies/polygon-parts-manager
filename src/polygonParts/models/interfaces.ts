import type { PolygonPart, PolygonPartsPayload as PolygonPartsPayloadType, ProductType as ProductTypeEnum } from '@map-colonies/mc-model-types';
import type { DbConfig } from '../../common/interfaces';
import type { EnsureType } from '../../common/types';
import { PRODUCT_TYPES } from './constants';

interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}

/**
 * Properties of part data for insertion
 */
export interface InsertPartData extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
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
export interface CommonRecord extends InsertPartData {
  readonly id: string;
  readonly ingestionDateUTC: Date;
}

/**
 * Part record properties of the raw ingested part
 */
export interface PartRecord extends CommonRecord {
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

/**
 * Polygon part record properties of the processed parts
 */
export interface PolygonPartRecord extends CommonRecord {
  readonly partId: string;
  readonly insertionOrder: number;
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

export interface IsSwapQueryParams {
  isSwap: boolean;
}

import type { JobTypes } from '@map-colonies/raster-shared';
import type {
  AggregateLayerMetadataOptions,
  AggregationLayerMetadataResponse,
  EntityIdentifier,
  ExistsOptions,
  ExistsResponse,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
  CommonRecord,
} from '../models/interfaces';
import { PolygonPartsFeatureCollection } from '../../common/types';

/**
 * Exists request body
 */
export type ExistsRequestBody = Pick<ExistsOptions, 'payload'>['payload'];

/**
 * Exists response body
 */
export interface ExistsResponseBody extends ExistsResponse {}

/**
 * Find polygon parts params
 */
export interface FindPolygonPartsParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Find polygon parts query params
 */
export interface FindPolygonPartsQueryParams extends Readonly<Pick<FindPolygonPartsOptions, 'shouldClip'>> {}

/**
 * Find polygon parts request body
 */
export type FindPolygonPartsRequestBody = Pick<FindPolygonPartsOptions, 'filter'>;
export type AggregatePolygonPartsRequestBody = Pick<AggregateLayerMetadataOptions, 'filter'>;

/**
 * Find polygon parts response body
 */
export interface FindPolygonPartsResponseBody<ShouldClip extends boolean = boolean> extends FindPolygonPartsResponse<ShouldClip> {}

/**
 * Get aggregation layer metadata params
 */
export interface AggregationLayerMetadataParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Get aggregation layer metadata response body
 */
export interface AggregationLayerMetadataResponseBody extends AggregationLayerMetadataResponse {}

export interface ValidateError {
  id: string;
  errors: string[];
}
export interface ValidatePolygonPartsResponseBody {
  parts: ValidateError[];
  smallGeometriesCount: number; // count in this chunk
  smallHolesCount: number; // count in this chunk
}

export type ValidatePolygonPartsRequestBody = Pick<CommonRecord, 'productId' | 'productType' | 'productVersion' | 'catalogId'> & {
  jobType: JobTypes;
} & {
  featureCollection: PolygonPartsFeatureCollection;
};

export type DeleteValidationEntityQuery = Pick<CommonRecord, 'productId' | 'productType'>;

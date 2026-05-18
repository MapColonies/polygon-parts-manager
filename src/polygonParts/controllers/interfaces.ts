import { PolygonPartsChunkValidationResult } from '@map-colonies/raster-shared';
import type {
  AggregateLayerMetadataOptions,
  AggregationLayerMetadataResponse,
  CommonRecord,
  EntityIdentifier,
  ExistsOptions,
  ExistsResponse,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
  IntersectionOptions,
  IntersectionResponse,
  PolygonPartsPayload,
  ProcessPolygonPartsOptions,
} from '../models/interfaces';

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
 * Intersection params
 */
export interface IntersectionParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Intersection request body
 */
export type IntersectionRequestBody = Pick<IntersectionOptions, 'geometry'>['geometry'];

/**
 * Intersection response body
 */
export type IntersectionResponseBody = IntersectionResponse;

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

export type ValidatePolygonPartsResponseBody = PolygonPartsChunkValidationResult;

export type ValidatePolygonPartsRequestBody = PolygonPartsPayload;

export type ValidationEntityQuery = Pick<CommonRecord, 'productId' | 'productType'>;

export type ProcessPolygonPartsRequestBody = Pick<CommonRecord, 'productId' | 'productType'> &
  Pick<ProcessPolygonPartsOptions, 'shouldClearEntities'>;

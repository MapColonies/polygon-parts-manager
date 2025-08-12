import type {
  AggregateLayerMetadataOptions,
  AggregationLayerMetadataResponse,
  EntityIdentifier,
  ExistsOptions,
  ExistsResponse,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
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
 * Get aggregation layer metadata params
 */
export interface AggregationLayerMetadataParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Get aggregation layer metadata response body
 */
export interface AggregationLayerMetadataResponseBody extends AggregationLayerMetadataResponse {}

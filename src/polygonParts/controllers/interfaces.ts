import type {
  AggregateLayerMetadataOptions,
  AggregateLayerMetadataResponse,
  EntityIdentifier,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
} from '../models/interfaces';

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
export interface AggregateLayerMetadataParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Get aggregation layer metadata response body
 */
export interface AggregateLayerMetadataResponseBody extends AggregateLayerMetadataResponse {}

/**
 * Get aggregation layer metadata query params
 */
export interface AggregateLayerMetadataQueryParams extends Readonly<Pick<AggregateLayerMetadataOptions, 'shouldIgnoreFootprint'>> {}

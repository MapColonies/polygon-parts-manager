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
 * Get aggregation layer metadata request body
 */
export type AggregateLayerMetadataRequestBody = Pick<AggregateLayerMetadataOptions, 'filter'>;

/**
 * Get aggregation layer metadata response body
 */
export type AggregateLayerMetadataResponseBody<T extends boolean = false> = AggregateLayerMetadataResponse<T>;

/**
 * Get aggregation layer metadata query params
 */
export interface AggregateLayerMetadataQueryParams<T extends boolean = boolean>
  extends Readonly<Pick<AggregateLayerMetadataOptions<T>, 'shouldIgnoreFootprint'>> {}

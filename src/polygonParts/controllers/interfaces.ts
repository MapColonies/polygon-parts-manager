import type { EntityIdentifier, FindPolygonPartsOptions, FindPolygonPartsResponse } from '../models/interfaces';

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
export interface FindPolygonPartsRequestBody extends Readonly<Pick<FindPolygonPartsOptions, 'footprint'>> {}

/**
 * Find polygon parts response body
 */
export interface FindPolygonPartsResponseBody extends FindPolygonPartsResponse {}

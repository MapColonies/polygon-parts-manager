// TODO: verify @map-colonies/raster-shared is updated to include this type
import type { RequestHandler } from 'express';
import type {
  EntitiesMetadata,
  EntityIdentifier,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
  IsSwapQueryParams,
  PolygonPartsPayload,
  PolygonPartsResponse,
} from '../models/interfaces';

/**
 * Find polygon parts params
 */
interface FindPolygonPartsParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Find polygon parts response body
 */
interface FindPolygonPartsResponseBody extends FindPolygonPartsResponse {}

/**
 * Create polygon parts handler
 */
export interface CreatePolygonPartsHandler
  extends RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, undefined, EntitiesMetadata> {}

/**
 * Create polygon parts validation handler
 */
export interface CreatePolygonPartsValidationHandler extends RequestHandler<undefined, PolygonPartsResponse, unknown, undefined> {}

/**
 * Find polygon parts handler
 */
export interface FindPolygonPartsHandler
  extends RequestHandler<
    FindPolygonPartsParams,
    FindPolygonPartsResponseBody,
    FindPolygonPartsRequestBody,
    FindPolygonPartsQueryParams,
    EntitiesMetadata
  > {}

/**
 * Find polygon parts query params
 */
export interface FindPolygonPartsQueryParams extends Readonly<Pick<FindPolygonPartsOptions, 'shouldClip'>> {}

/**
 * Find polygon parts request body
 */
export interface FindPolygonPartsRequestBody extends Readonly<Pick<FindPolygonPartsOptions, 'footprint'>> {}

/**
 * Find polygon parts validation handler
 */
export interface FindPolygonPartsValidationHandler extends RequestHandler<FindPolygonPartsParams, FindPolygonPartsResponseBody, unknown, unknown> {}

/**
 * Update polygon parts handler
 */
export interface UpdatePolygonPartsHandler
  extends RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, IsSwapQueryParams, EntitiesMetadata> {}

/**
 * Update polygon parts validation handler
 */
export interface UpdatePolygonPartsValidationHandler extends RequestHandler<undefined, PolygonPartsResponse, unknown, unknown> {}

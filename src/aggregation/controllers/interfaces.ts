import type { RequestHandler } from 'express';
import type { EntitiesMetadata, EntityIdentifier } from '../../polygonParts/models/interfaces';
import type { GetAggregationLayerMetadataResponse } from '../models/interfaces';

/**
 * Get aggregation layer metadata params
 */
interface GetAggregationLayerMetadataParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Get aggregation layer metadata response body
 */
interface GetAggregationLayerMetadataResponseBody extends GetAggregationLayerMetadataResponse {}

/**
 * Get aggregation layer metadata handler
 */
export interface GetAggregationLayerMetadataHandler
  extends RequestHandler<GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody, undefined, undefined, EntitiesMetadata> {}

/**
 * Get aggregation layer metadata validation handler
 */
export interface GetAggregationLayerMetadataValidationHandler
  extends RequestHandler<GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody, undefined, undefined> {}

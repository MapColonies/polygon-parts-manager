import type { EntityIdentifier } from '../../polygonParts/models/interfaces';
import type { GetAggregationLayerMetadataResponse } from '../models/interfaces';

/**
 * Get aggregation layer metadata params
 */
export interface GetAggregationLayerMetadataParams {
  readonly polygonPartsEntityName: EntityIdentifier;
}

/**
 * Get aggregation layer metadata response body
 */
export interface GetAggregationLayerMetadataResponseBody extends GetAggregationLayerMetadataResponse {}

import type { AggregationLayerMetadata } from '@map-colonies/raster-shared';
import type { EntityNames } from '../../polygonParts/models/interfaces';

/**
 * Get aggregation layer metadata options
 */
export interface GetAggregationLayerMetadataOptions {
  readonly polygonPartsEntityName: EntityNames;
}

/**
 * Get aggregation layer metadata response
 */
export interface GetAggregationLayerMetadataResponse extends AggregationLayerMetadata {}

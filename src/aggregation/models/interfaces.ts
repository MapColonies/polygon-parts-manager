import { IPolygonPart } from '@map-colonies/mc-model-types';

/**
 * Aggregation params
 */
export interface AggregationParams {
  readonly catalogId: Pick<IPolygonPart, 'id'>['id'];
}

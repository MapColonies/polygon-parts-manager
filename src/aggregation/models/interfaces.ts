import { IPolygonPart } from '@map-colonies/mc-model-types';
import type { MultiPolygon, Polygon } from 'geojson';

/**
 * Aggregation params
 */
export interface AggregationParams {
  readonly catalogId: Pick<IPolygonPart, 'id'>['id'];
}

/**
 * Aggregation metadata
 */
export interface AggregationMetadata {
  imagingTimeBeginUTC: Date;
  imagingTimeEndUTC: Date;
  maxResolutionDeg: number;
  minResolutionDeg: number;
  maxResolutionMeter: number;
  minResolutionMeter: number;
  maxHorizontalAccuracyCE90: number;
  minHorizontalAccuracyCE90: number;
  sensors: string;
  footprint: Polygon | MultiPolygon;
}

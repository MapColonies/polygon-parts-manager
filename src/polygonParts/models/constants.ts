import type { MapValues } from '../../common/types';
import type { PolygonPartRecord } from './interfaces';

/**
 * Fields to select in find polygon parts query
 */
export const FIND_OUTPUT_FIELDS: MapValues<Required<Omit<PolygonPartRecord, 'footprint' | 'id' | 'partId' | 'insertionOrder'>>, boolean> = {
  catalogId: true,
  cities: true,
  countries: true,
  description: true,
  horizontalAccuracyCE90: true,
  imagingTimeBeginUTC: true,
  imagingTimeEndUTC: true,
  ingestionDateUTC: true,
  productId: true,
  productType: true,
  productVersion: true,
  resolutionDegree: true,
  resolutionMeter: true,
  sensors: true,
  sourceId: true,
  sourceName: true,
  sourceResolutionMeter: true,
};

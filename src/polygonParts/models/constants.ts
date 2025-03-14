import type { MapValues } from '../../common/types';
import type { PolygonPartRecord } from './interfaces';

/**
 * Properties to select (include/exclude) in find polygon parts query or a select query applied to the mapped column (implicitly included)
 */
export const FIND_OUTPUT_PROPERTIES: MapValues<
  Required<Omit<PolygonPartRecord, 'footprint' | 'partId' | 'insertionOrder'>>,
  boolean | ((column: string) => string)
> = {
  catalogId: true,
  cities: (column: string) => `string_to_array("${column}", ',')`,
  countries: (column: string) => `string_to_array("${column}", ',')`,
  description: true,
  horizontalAccuracyCE90: true,
  id: true,
  imagingTimeBeginUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  imagingTimeEndUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  ingestionDateUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  productId: true,
  productType: true,
  productVersion: true,
  resolutionDegree: true,
  resolutionMeter: true,
  sensors: (column: string) => `string_to_array("${column}", ',')`,
  sourceId: true,
  sourceName: true,
  sourceResolutionMeter: true,
};

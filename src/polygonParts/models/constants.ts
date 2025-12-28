import type { RoiProperties } from '@map-colonies/raster-shared';
import type { IdenticalKeyValuePairs, MapValues } from '../../common/types';
import { getMappedColumnName } from '../DAL/utils';
import type { FindPolygonPartsResponse, IsValidDetailsResult, PolygonPartRecord } from './interfaces';

/**
 * Properties to select (include/exclude) in find polygon parts query or a select query applied to the mapped column (implicitly included)
 */
const FIND_OUTPUT_PROPERTIES: MapValues<Required<Omit<PolygonPartRecord, 'footprint' | 'insertionOrder'>>, boolean | ((column: string) => string)> = {
  catalogId: true,
  cities: (column: string) => `string_to_array("${column}", ',')`,
  countries: (column: string) => `string_to_array("${column}", ',')`,
  description: true,
  horizontalAccuracyCE90: true,
  id: true,
  imagingTimeBeginUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  imagingTimeEndUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  ingestionDateUTC: (column: string) => `to_char("${column}" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  partId: true,
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

export const geometryColumn = getMappedColumnName('footprint' satisfies keyof Pick<PolygonPartRecord, 'footprint'>);
export const idColumn = getMappedColumnName('id' satisfies keyof Pick<PolygonPartRecord, 'id'>);
export const insertionOrderColumn = getMappedColumnName('insertionOrder' satisfies keyof Pick<PolygonPartRecord, 'insertionOrder'>);
export const isValidDetailsResult: IdenticalKeyValuePairs<IsValidDetailsResult> = {
  valid: 'valid',
  reason: 'reason',
  location: 'location',
};
export const minResolutionDeg = 'minResolutionDeg' satisfies keyof Pick<RoiProperties, 'minResolutionDeg'>;
export const requestFeatureId = 'requestFeatureId' satisfies keyof Pick<
  FindPolygonPartsResponse['features'][number]['properties'],
  'requestFeatureId'
>;

export const findSelectOutputColumns = Object.entries(FIND_OUTPUT_PROPERTIES)
  .filter(([, value]) => value)
  .map(([key, value]) => `${typeof value === 'boolean' ? `"${getMappedColumnName(key)}"` : value(getMappedColumnName(key))} as "${key}"`);

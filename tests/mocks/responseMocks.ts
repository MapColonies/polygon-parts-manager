/* eslint-disable @typescript-eslint/no-magic-numbers */
import type { AggregateLayerMetadataResponse } from '../../src/polygonParts/models/interfaces';

export const emptyFeature: AggregateLayerMetadataResponse = {
  type: 'Feature',
  geometry: null,
  properties: null,
};

export const customAggregationNoFilter: AggregateLayerMetadataResponse = {
  type: 'Feature',
  geometry: {
    bbox: [34.851494459228, 31.764309584483, 35.231494406371, 32.305431896406],
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [34.851494459228, 32.305431896406],
          [34.868241544701, 32.305431896406],
          [34.868241544701, 32.294309584483],
          [34.851494459228, 32.294309584483],
          [34.851494459228, 32.305431896406],
        ],
      ],
      [
        [
          [35.210121597558, 31.782431896406],
          [35.231494406371, 31.782431896406],
          [35.231494406371, 31.764309584483],
          [35.210121597558, 31.764309584483],
          [35.210121597558, 31.782431896406],
        ],
      ],
    ],
  },
  properties: {
    sensors: ['Sensor_A', 'Sensor_B', 'Sensor_C'],
    maxResolutionDeg: 0.0001,
    minResolutionDeg: 0.00025,
    imagingTimeEndUTC: new Date('2024-01-16T10:15:00+00:00'),
    maxResolutionMeter: 10.2,
    minResolutionMeter: 25.5,
    productBoundingBox: '34.851494459228,31.764309584483,35.231494406371,32.305431896406',
    imagingTimeBeginUTC: new Date('2024-01-15T10:30:00+00:00'),
    maxHorizontalAccuracyCE90: 2.1,
    minHorizontalAccuracyCE90: 3.5,
  },
};

export const customAggregationWithFilter: AggregateLayerMetadataResponse = {
  type: 'Feature',
  geometry: {
    bbox: [35.210121597558, 31.764309584483, 35.231494406371, 31.782431896406],
    type: 'Polygon',
    coordinates: [
      [
        [35.210121597558, 31.764309584483],
        [35.210121597558, 31.782431896406],
        [35.231494406371, 31.782431896406],
        [35.231494406371, 31.764309584483],
        [35.210121597558, 31.764309584483],
      ],
    ],
  },
  properties: {
    sensors: ['Sensor_C'],
    maxResolutionDeg: 0.0001,
    minResolutionDeg: 0.0001,
    imagingTimeEndUTC: new Date('2024-01-16T10:15:00+00:00'),
    maxResolutionMeter: 10.2,
    minResolutionMeter: 10.2,
    productBoundingBox: '35.210121597558,31.764309584483,35.231494406371,31.782431896406',
    imagingTimeBeginUTC: new Date('2024-01-16T09:20:00+00:00'),
    maxHorizontalAccuracyCE90: 2.1,
    minHorizontalAccuracyCE90: 2.1,
  },
};

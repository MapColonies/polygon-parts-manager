/* eslint-disable  @typescript-eslint/no-magic-numbers */
import { JobTypes, RasterProductTypes } from '@map-colonies/raster-shared';
import type { MultiPolygon, Polygon } from 'geojson';
import type { PolygonPartsPayload } from '../../src/polygonParts/models/interfaces';
import { generatePolygonPartsPayload } from '../integration/polygonParts/helpers/db';
import { ValidatePolygonPartsRequestBody } from '../../src/polygonParts/controllers/interfaces';

type LayerMetadata = Pick<PolygonPartsPayload, 'catalogId' | 'productId' | 'productType' | 'productVersion'>;

const createLayerMetadata: LayerMetadata = {
  productId: 'BLUE_MARBLE',
  productType: RasterProductTypes.ORTHOPHOTO,
  catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
  productVersion: '1.0',
};

const createLayerMetadataForValidation: LayerMetadata = {
  catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
  productId: 'AGGREGATED_EXAMPLE',
  productType: RasterProductTypes.ORTHOPHOTO,
  productVersion: '1.5',
};

const updateLayerMetadata: LayerMetadata = {
  ...createLayerMetadata,
  productVersion: '2.0',
};

const propertiesToGenerate = {
  sourceName: 'Blue Marble Source',
  imagingTimeBeginUTC: '2024-01-01T00:00:00.000Z',
  imagingTimeEndUTC: '2024-12-31T23:59:59.000Z',
  resolutionDegree: 0.0001,
  resolutionMeter: 10,
  sourceResolutionMeter: 10,
  horizontalAccuracyCE90: 1.5,
  sensors: ['Sensor_X', 'Sensor_Y'],
};

export const worldFootprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-180, 90],
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
    ],
  ],
};

export const franceFootprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-2.4665482828026484, 48.887141594331894],
      [-1.2454127629423795, 43.89934370894406],
      [6.1233025322743515, 44.11822053690119],
      [5.856707262678924, 49.31450588562336],
      [-2.4665482828026484, 48.887141594331894],
    ],
  ],
};

export const germanyFootprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [7.27089952814373, 53.180758608636125],
      [8.234012102070523, 48.84326694299858],
      [13.657889668595743, 48.81988047270431],
      [13.852779148663245, 53.743357886857154],
      [7.27089952814373, 53.180758608636125],
    ],
  ],
};

export const italyFootprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [8.00965846045662, 45.07006283085923],
      [12.556004637006907, 39.09877499242364],
      [18.45834665868881, 39.843200896431],
      [14.213356721380023, 45.07951202671654],
      [8.00965846045662, 45.07006283085923],
    ],
  ],
};

export const europeMultiPolygon: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [franceFootprint.coordinates, germanyFootprint.coordinates],
};

export const intersectionWithItalyFootprint: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [15.242703744811251, 47.63748815188245],
      [12.619116067663526, 44.40706680284379],
      [16.663020524356796, 41.46011220063403],
      [20.155700258171464, 43.52570628088938],
      [15.242703744811251, 47.63748815188245],
    ],
  ],
};

export const worldMinusSeparateCountries: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [180, 90],
      [180, -90],
      [-180, -90],
      [-180, 90],
      [180, 90],
    ],
    [
      [5.856707262678924, 49.31450588562336],
      [-2.4665482828026484, 48.887141594331894],
      [-1.2454127629423795, 43.89934370894406],
      [6.1233025322743515, 44.11822053690119],
      [5.856707262678924, 49.31450588562336],
    ],
    [
      [8.234012102070523, 48.84326694299858],
      [13.657889668595743, 48.81988047270431],
      [13.852779148663245, 53.743357886857154],
      [7.27089952814373, 53.180758608636125],
      [8.234012102070523, 48.84326694299858],
    ],
    [
      [8.00965846045662, 45.07006283085923],
      [12.556004637006907, 39.09877499242364],
      [18.45834665868881, 39.843200896431],
      [14.213356721380023, 45.07951202671654],
      [8.00965846045662, 45.07006283085923],
    ],
  ],
};

export const italyWithoutIntersection: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [18.45834665868881, 39.843200896431],
      [12.556004637006907, 39.09877499242364],
      [8.00965846045662, 45.07006283085923],
      [13.163944504441575, 45.07791360894124],
      [12.619116067663526, 44.40706680284379],
      [16.663020524356796, 41.46011220063403],
      [16.990524181526254, 41.6538000469492],
      [18.45834665868881, 39.843200896431],
    ],
  ],
};

export const createInitPayloadRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...createLayerMetadata,
  partsData: [{ footprint: worldFootprint }],
});
export const separatePolygonsRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...updateLayerMetadata,
  partsData: [{ footprint: franceFootprint }, { footprint: germanyFootprint }, { footprint: italyFootprint }],
});
export const intersectionWithItalyRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...updateLayerMetadata,
  partsData: [{ footprint: italyFootprint }, { footprint: intersectionWithItalyFootprint }],
});

// Aggregation request
export const createEuropeInitPayloadRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...createLayerMetadata,
  productId: 'EUROPE',
  partsData: [{ footprint: franceFootprint }, { footprint: germanyFootprint }, { footprint: italyFootprint }],
});

export const outsideEuropePolygon: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-74.01635160613628, 40.7056039283942],
      [-73.97589673652533, 40.711341979367205],
      [-73.97269222486422, 40.729207684432765],
      [-73.94155345753425, 40.77550944512822],
      [-73.92903628251918, 40.79975012847805],
      [-73.94507323481, 40.84266749777501],
      [-74.0079112667282, 40.75192233366903],
      [-74.01635160613628, 40.7056039283942],
    ],
  ],
};

export const createCustomInitPayloadRequestForAggregation: PolygonPartsPayload = {
  catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
  productId: 'AGGREGATED_EXAMPLE',
  productType: RasterProductTypes.ORTHOPHOTO,
  productVersion: '1.5',
  partsData: [
    {
      sourceName: 'Example Source 1',
      imagingTimeBeginUTC: new Date('2024-01-15T10:30:00.000Z'),
      imagingTimeEndUTC: new Date('2024-01-15T11:45:00.000Z'),
      resolutionDegree: 0.00025,
      resolutionMeter: 25.5,
      sourceResolutionMeter: 25.5,
      horizontalAccuracyCE90: 3.5,
      sensors: ['Sensor_A', 'Sensor_B'],
      countries: ['Israel'],
      cities: ['Haifa', 'Tel Aviv'],
      description: 'Northern coastal region imagery',
      footprint: {
        type: 'Polygon',
        coordinates: [
          [
            [34.85149443279957, 32.30543192283443],
            [34.85149443279957, 32.29430955805424],
            [34.86824157112912, 32.29430955805424],
            [34.86824157112912, 32.30543192283443],
            [34.85149443279957, 32.30543192283443],
          ],
        ],
      },
    },
    {
      sourceName: 'Example Source 2',
      imagingTimeBeginUTC: new Date('2024-01-16T09:20:00.000Z'),
      imagingTimeEndUTC: new Date('2024-01-16T10:15:00.000Z'),
      resolutionDegree: 0.0001,
      resolutionMeter: 10.2,
      sourceResolutionMeter: 10.2,
      horizontalAccuracyCE90: 2.1,
      sensors: ['Sensor_C'],
      countries: ['Israel'],
      cities: ['Jerusalem'],
      description: 'Central region high-resolution capture',
      footprint: {
        type: 'Polygon',
        coordinates: [
          [
            [35.21012157112912, 31.78243192283443],
            [35.21012157112912, 31.76430955805424],
            [35.23149443279957, 31.76430955805424],
            [35.23149443279957, 31.78243192283443],
            [35.21012157112912, 31.78243192283443],
          ],
        ],
      },
    },
  ],
};

export const validValidationPolygonPartsPayload: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: italyFootprint,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: europeMultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const validationEntireWorldRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: '1111',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-180, -90],
              [180, -90],
              [180, 90],
              [-180, 90],
              [-180, -90],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const invalidGeometryValidRequest = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: '1111',
        geometry: {
          type: 'LineString',
          coordinates: [
            [1.3756380206141898, 43.08988386275399],
            [2.2905211473345446, 43.37799276998723],
          ],
        },
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const invalidGeometriesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [2, 2],
              [0, 2],
              [2, 0],
              [0, 0], // ring closes but self-intersects at (1,1)
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            // Polygon A: valid square
            [
              [
                [10, 10],
                [12, 10],
                [12, 12],
                [10, 12],
                [10, 10],
              ],
            ],
            // Polygon B: bow-tie (self-intersecting)
            [
              [
                [11, 10.5],
                [12.5, 12],
                [11, 12],
                [12.5, 10.5],
                [11, 10.5], // closes, but crosses itself
              ],
            ],
          ],
        } as MultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const invalidSmallGeometriesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.900289407308634, 32.10019101688825],
              [34.90031059269137, 32.10019101688825],
              [34.90031059269137, 32.10020898311175],
              [34.900289407308634, 32.10020898311175],
              [34.900289407308634, 32.10019101688825],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            // --- Polygon A: ~2m x 2m (≈ 4 m²) ---
            [
              [
                [34.9003, 32.1002],
                [34.9003212, 32.1002],
                [34.9003212, 32.100218],
                [34.9003, 32.100218],
                [34.9003, 32.1002],
              ],
            ],

            // --- Polygon B: ~25m x 25m (≈ 625 m²) ---
            [
              [
                [34.9007, 32.1005],
                [34.9009646, 32.1005],
                [34.9009646, 32.1007245],
                [34.9007, 32.1007245],
                [34.9007, 32.1005],
              ],
            ],
          ],
        } as MultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const invalidSmallHolesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            // outer ~100m x ~100m
            [
              [34.9, 32.1],
              [34.901, 32.1],
              [34.901, 32.101],
              [34.9, 32.101],
              [34.9, 32.1],
            ],
            // hole ~2m x ~2m (~4 m²)
            [
              [34.9003, 32.1003],
              [34.9003212, 32.1003],
              [34.9003212, 32.100318],
              [34.9003, 32.100318],
              [34.9003, 32.1003],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            // component 1: big, no holes
            [
              [
                [34.9007, 32.1005],
                [34.90095, 32.1005],
                [34.90095, 32.10073],
                [34.9007, 32.10073],
                [34.9007, 32.1005],
              ],
            ],
            // component 2: big outer + tiny hole
            [
              [
                [34.9012, 32.1005],
                [34.90145, 32.1005],
                [34.90145, 32.10073],
                [34.9012, 32.10073],
                [34.9012, 32.1005],
              ],
              // tiny hole ~2m x ~2m
              [
                [34.9013, 32.1006],
                [34.9013212, 32.1006],
                [34.9013212, 32.100618],
                [34.9013, 32.100618],
                [34.9013, 32.1006],
              ],
            ],
          ],
        } as MultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const mockSmallAreaAndHole: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          // A) Polygon whose total area < 5 m² (~2m x ~2m)
          type: 'Polygon',
          coordinates: [
            [
              [34.9002894073, 32.1001910169],
              [34.9003105927, 32.1001910169],
              [34.9003105927, 32.1002089831],
              [34.9002894073, 32.1002089831],
              [34.9002894073, 32.1001910169],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            // component with tiny hole
            [
              [
                [34.9007, 32.1005],
                [34.90095, 32.1005],
                [34.90095, 32.10073],
                [34.9007, 32.10073],
                [34.9007, 32.1005],
              ],
              [
                [34.9008, 32.1006],
                [34.9008212, 32.1006],
                [34.9008212, 32.100618],
                [34.9008, 32.100618],
                [34.9008, 32.1006],
              ],
            ],
            // normal component (no holes)
            [
              [
                [34.9011, 32.1005],
                [34.90135, 32.1005],
                [34.90135, 32.10073],
                [34.9011, 32.10073],
                [34.9011, 32.1005],
              ],
            ],
          ],
        } as MultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const mockMultipleInvalidGeometries: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          // A)  1) Invalid polygon (bow-tie / self-intersecting)
          type: 'Polygon',
          coordinates: [
            [
              [34.902, 32.1],
              [34.90204, 32.10004],
              [34.902, 32.10004],
              [34.90204, 32.1],
              [34.902, 32.1],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'Polygon',
          coordinates: [
            // outer ~2.5m x ~2.5m (~6.25 m²) — adjust slightly under 5 by shrinking:
            [
              [34.9005, 32.1008],
              [34.9005212, 32.1008],
              [34.9005212, 32.100818],
              [34.9005, 32.100818],
              [34.9005, 32.1008],
            ],
            // hole ~1m x ~1m (~1 m²) — ensures both: has a hole, and net area still < 5 m²
            [
              [34.900507, 32.100807],
              [34.900516, 32.100807],
              [34.900516, 32.100815],
              [34.900507, 32.100815],
              [34.900507, 32.100807],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e3',
        geometry: {
          // 3) MultiPolygon: one invalid component + one valid with hole

          type: 'MultiPolygon',
          coordinates: [
            // component 1: INVALID bow-tie (self-intersecting)
            [
              [
                [34.9018, 32.1002],
                [34.90184, 32.10024],
                [34.9018, 32.10024],
                [34.90184, 32.1002],
                [34.9018, 32.1002],
              ],
            ],
            // component 2: valid with tiny hole
            [
              [
                [34.9011, 32.1005],
                [34.90135, 32.1005],
                [34.90135, 32.10073],
                [34.9011, 32.10073],
                [34.9011, 32.1005],
              ],
              [
                [34.9012, 32.1006],
                [34.9012212, 32.1006],
                [34.9012212, 32.100618],
                [34.9012, 32.100618],
                [34.9012, 32.1006],
              ],
            ],
          ],
        } as MultiPolygon,
        properties: {
          ...propertiesToGenerate,
        },
      },
    ],
  },
};

export const mockUpdateWithIntersectingParts: ValidatePolygonPartsRequestBody = {
  productId: createCustomInitPayloadRequestForAggregation.productId,
  productType: RasterProductTypes.ORTHOPHOTO,
  catalogId: createCustomInitPayloadRequestForAggregation.catalogId,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  featureCollection: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.85149443279957, 32.30543192283443],
              [34.85149443279957, 32.29430955805424],
              [34.86824157112912, 32.29430955805424],
              [34.86824157112912, 32.30543192283443],
              [34.85149443279957, 32.30543192283443],
            ],
          ],
        },
        properties: {
          sourceName: 'Example Source 1',
          imagingTimeBeginUTC: '2024-01-15T10:30:00.000Z',
          imagingTimeEndUTC: '2024-01-15T11:45:00.000Z',
          resolutionDegree: 0.00026,
          resolutionMeter: 25.5,
          sourceResolutionMeter: 25.5,
          horizontalAccuracyCE90: 3.5,
          sensors: ['Sensor_A', 'Sensor_B'],
          countries: ['Israel'],
          cities: ['Haifa', 'Tel Aviv'],
          description: 'Northern coastal region imagery',
        },
      },
      {
        type: 'Feature',
        id: 'c52d8189-7e07-456a-8c6b-53859523c3e2',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [35.21012157112912, 31.78243192283443],
              [35.21012157112912, 31.76430955805424],
              [35.23149443279957, 31.76430955805424],
              [35.23149443279957, 31.78243192283443],
              [35.21012157112912, 31.78243192283443],
            ],
          ],
        },
        properties: {
          sourceName: 'Example Source 2',
          imagingTimeBeginUTC: '2024-01-16T09:20:00.000Z',
          imagingTimeEndUTC: '2024-01-16T10:15:00.000Z',
          resolutionDegree: 0.00012,
          resolutionMeter: 10.2,
          sourceResolutionMeter: 10.2,
          horizontalAccuracyCE90: 2.1,
          sensors: ['Sensor_C'],
          countries: ['Israel'],
          cities: ['Jerusalem'],
          description: 'Central region high-resolution capture',
        },
      },
    ],
  },
};

/* eslint-disable  @typescript-eslint/no-magic-numbers */
import { faker } from '@faker-js/faker/.';
import { zoomLevelToResolutionDeg } from '@map-colonies/mc-utils';
import { JobTypes, PartFeatureProperties, RasterProductTypes } from '@map-colonies/raster-shared';
import config from 'config';
import type { MultiPolygon, Polygon } from 'geojson';
import { ValidatePolygonPartsRequestBody } from '../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../src/polygonParts/models/interfaces';
import { generatePolygonPartsPayload } from '../integration/polygonParts/helpers/utils';

const zoomLevelThreshold = config.get<number>('application.validation.zoomLevelThreshold');

// Anchor zoom for the pre-existing high-resolution layer used in resolution validation tests
const HIGH_RES_EXISTING_ZOOM = 21;
// Zoom for the pre-existing low-resolution layer (no error expected when new part is higher res)
const LOWER_RES_EXISTING_ZOOM = 10;
// Zoom for touch-boundary tests (both sides at the same level so no resolution error)
const TOUCH_ZOOM = 15;
// New-part zoom that exceeds the threshold: diff = threshold + 1 → isExceeded: true
const EXCEEDED_NEW_PART_ZOOM = HIGH_RES_EXISTING_ZOOM - (zoomLevelThreshold + 1);
// New-part zoom within the threshold: diff = floor(threshold/2) → isExceeded: false
const NOT_EXCEEDED_NEW_PART_ZOOM = HIGH_RES_EXISTING_ZOOM - Math.max(1, Math.floor(zoomLevelThreshold / 2));

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

const propertiesToGenerate = (): PartFeatureProperties => ({
  id: faker.string.uuid(),
  sourceName: 'Blue Marble Source',
  imagingTimeBeginUTC: new Date('2024-01-01T00:00:00.000Z'),
  imagingTimeEndUTC: new Date('2024-12-31T23:59:59.000Z'),
  resolutionDegree: 0.0001,
  resolutionMeter: 10,
  sourceResolutionMeter: 10,
  horizontalAccuracyCE90: 1.5,
  sensors: ['Sensor_X', 'Sensor_Y'],
});

// productId/type/catalogId shared between mockTouchingLayerInitPayload and mockUpdateWithTouchPart
const layerMetadata: LayerMetadata = {
  productId: 'Resolution_Conflict_Test',
  productType: RasterProductTypes.ORTHOPHOTO,
  catalogId: faker.string.uuid(),
  productVersion: '1.0',
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
  partsData: {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: worldFootprint }],
  },
});
export const separatePolygonsRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...updateLayerMetadata,
  partsData: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: franceFootprint },
      { type: 'Feature', geometry: germanyFootprint },
      { type: 'Feature', geometry: italyFootprint },
    ],
  },
});
export const intersectionWithItalyRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...updateLayerMetadata,
  partsData: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: italyFootprint },
      { type: 'Feature', geometry: intersectionWithItalyFootprint },
    ],
  },
});

// Aggregation request
export const createEuropeInitPayloadRequest: PolygonPartsPayload = generatePolygonPartsPayload({
  ...createLayerMetadata,
  productId: 'EUROPE',
  partsData: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: franceFootprint },
      { type: 'Feature', geometry: germanyFootprint },
      { type: 'Feature', geometry: italyFootprint },
    ],
  },
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
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          id: faker.string.uuid(),
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
        },
      },
      {
        type: 'Feature',
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
          id: faker.string.uuid(),
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
        },
      },
    ],
  },
};

export const validValidationPolygonPartsPayload: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: italyFootprint,
        properties: {
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
        geometry: europeMultiPolygon,
        properties: {
          ...propertiesToGenerate(),
        },
      },
    ],
  },
};

export const invalidGeometriesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
    ],
  },
};

export const invalidSmallGeometriesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
    ],
  },
};

export const invalidSmallHolesValidateRequest: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
    ],
  },
};

// 4-feature payload covering all geometry error combinations:
//   feature 0: GEOMETRY_VALIDITY (bow-tie / self-intersecting polygon)
//   feature 1: SMALL_GEOMETRY only (~2m x ~2m, area < 5 m², no holes)
//   feature 2: SMALL_HOLES only (large polygon with a single tiny hole)
//   feature 3: SMALL_GEOMETRY + SMALL_HOLES (tiny polygon with a tiny hole)
export const mockMultipleInvalidGeometries: ValidatePolygonPartsRequestBody = {
  ...createLayerMetadataForValidation,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
        geometry: {
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            // outer ~2.5m x ~2.5m — net area < 5 m² after subtracting hole
            [
              [34.9005, 32.1008],
              [34.9005212, 32.1008],
              [34.9005212, 32.100818],
              [34.9005, 32.100818],
              [34.9005, 32.1008],
            ],
            // hole ~1m x ~1m (~1 m²)
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
          ...propertiesToGenerate(),
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
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: 0.00026,
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: 0.00012,
        },
      },
    ],
  },
};

// Existing layer at HIGH_RES_EXISTING_ZOOM. Used as the pre-existing
// polygon_parts table data when testing the isExceeded=true path.
export const highResolutionInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload at EXCEEDED_NEW_PART_ZOOM intersecting highResolutionInitPayload.
// zoom diff = HIGH_RES_EXISTING_ZOOM - EXCEEDED_NEW_PART_ZOOM = threshold + 1 → isExceeded: true
export const mockUpdateWithExceededResolution: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload with two parts intersecting highResolutionInitPayload:
//   part A at EXCEEDED_NEW_PART_ZOOM → diff = threshold + 1 > threshold → isExceeded: true
//   part B at NOT_EXCEEDED_NEW_PART_ZOOM → diff = floor(threshold/2) ≤ threshold → isExceeded: false
export const mockUpdateWithMixedResolutions: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number, // isExceeded: true
        },
      },
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(NOT_EXCEEDED_NEW_PART_ZOOM) as number, // isExceeded: false
        },
      },
    ],
  },
};

// Existing layer occupying the polygon immediately to the left of mockUpdateWithTouchPart.
// The two polygons share the vertical edge at x=34.86824157112912 — they touch but do not overlap.
export const mockTouchingLayerInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.85149443279957, 32.29430955805424],
              [34.85149443279957, 32.30543192283443],
              [34.86824157112912, 32.30543192283443],
              [34.86824157112912, 32.29430955805424],
              [34.85149443279957, 32.29430955805424],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(TOUCH_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload at TOUCH_ZOOM that only touches (shares an edge with)
// the mockTouchingLayerInitPayload polygon. ST_Intersects && NOT ST_Touches → false → no resolution error.
export const mockUpdateWithTouchPart: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.86824157112912, 32.29430955805424],
              [34.86824157112912, 32.30543192283443],
              [34.88498870945867, 32.30543192283443],
              [34.88498870945867, 32.29430955805424],
              [34.86824157112912, 32.29430955805424],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(TOUCH_ZOOM) as number,
        },
      },
    ],
  },
};

// Update at EXCEEDED_NEW_PART_ZOOM with a tiny (~2m x ~2m, area < 5 m²) polygon
// that intersects highResolutionInitPayload. zoom diff = threshold + 1 > threshold.
// Expects both RESOLUTION (isExceeded: true) and SMALL_GEOMETRY errors on the same part.
export const mockUpdateWithResolutionAndSmallGeometry: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.852, 32.296],
              [34.8520215, 32.296],
              [34.8520215, 32.296018],
              [34.852, 32.296018],
              [34.852, 32.296],
            ],
          ],
        } as Polygon,
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number, // isExceeded: true
        },
      },
    ],
  },
};

// Existing layer at LOWER_RES_EXISTING_ZOOM (low resolution). Used as the pre-existing
// polygon_parts table data when testing that a lower-resolution existing part produces no resolution error.
export const lowerResolutionInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(LOWER_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload at HIGH_RES_EXISTING_ZOOM intersecting lowerResolutionInitPayload.
// Existing part has higher resolutionDegree (lower resolution) than the new part →
// SQL condition p.resolution_degree < v.resolution_degree is NOT satisfied → no resolution error.
export const mockUpdateWithHighResIntersectingLowRes: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
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
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Existing layer with two spatially distinct parts, both at HIGH_RES_EXISTING_ZOOM.
// Used to verify that a new part intersecting multiple higher-resolution existing parts
// appears only once in the validation response (GROUP BY deduplication in the SQL query).
export const twoHighResExistingPartsInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.852, 32.305],
              [34.852, 32.3],
              [34.854, 32.3],
              [34.854, 32.305],
              [34.852, 32.305],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.864, 32.298],
              [34.864, 32.295],
              [34.866, 32.295],
              [34.866, 32.298],
              [34.864, 32.298],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload at EXCEEDED_NEW_PART_ZOOM with a single part that spatially
// contains both parts of twoHighResExistingPartsInitPayload.
// The single new part's id must appear exactly once in the validation response,
// even though it joins two existing higher-resolution parts.
export const mockUpdateIntersectingTwoHighResParts: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.85, 32.307],
              [34.85, 32.293],
              [34.868, 32.293],
              [34.868, 32.307],
              [34.85, 32.307],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number,
        },
      },
    ],
  },
};

// Existing layer for testing the ST_Area filter in validate_resolutions.
// A simple rectangle polygon at HIGH_RES_EXISTING_ZOOM
export const sliverIntersectionInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.85, 32.29],
              [34.86, 32.29],
              [34.86, 32.30],
              [34.85, 32.30],
              [34.85, 32.29],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Update at EXCEEDED_NEW_PART_ZOOM whose footprint overlaps sliverIntersectionInitPayload
// by a sliver of width ≈ 1e-11 degrees × height 0.01 degrees ≈ 1e-13 sq deg.
// Since 1e-13 < minAreaSquareDeg (1e-12), the ST_Area filter discards this intersection
// and validate_resolutions returns no resolution error.
export const mockUpdateWithSliverIntersection: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.85999999999, 32.29],
              [34.87, 32.29],
              [34.87, 32.30],
              [34.85999999999, 32.30],
              [34.85999999999, 32.29],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number,
        },
      },
    ],
  },
};

// Existing layer for testing the ST_GeometryType filter in validate_resolutions.
// A rectangle at HIGH_RES_EXISTING_ZOOM whose right edge is at x=34.88.
// When the new part (mockUpdateWithLineIntersection) shares exactly this edge,
// ST_Intersection returns a ST_LineString with ST_Area = 0.
// The ST_GeometryType IN ('ST_Polygon', 'ST_MultiPolygon') condition filters it out,
// so no resolution error is raised.
export const lineIntersectionInitPayload: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  jobType: JobTypes.Ingestion_New,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.87, 32.29],
              [34.88, 32.29],
              [34.88, 32.30],
              [34.87, 32.30],
              [34.87, 32.29],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(HIGH_RES_EXISTING_ZOOM) as number,
        },
      },
    ],
  },
};

// Update at EXCEEDED_NEW_PART_ZOOM whose left edge is exactly x=34.88 — the right edge of
// lineIntersectionInitPayload. The two polygons share precisely that vertical line segment,
// so ST_Intersection(p.footprint, v.footprint) = ST_LineString with ST_Area = 0.
// The ST_GeometryType filter removes this row; no resolution error is returned.
export const mockUpdateWithLineIntersection: ValidatePolygonPartsRequestBody = {
  ...layerMetadata,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [34.88, 32.29],
              [34.89, 32.29],
              [34.89, 32.30],
              [34.88, 32.30],
              [34.88, 32.29],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: zoomLevelToResolutionDeg(EXCEEDED_NEW_PART_ZOOM) as number,
        },
      },
    ],
  },
};

// Update payload with geometry completely disjoint from the pre-existing AGGREGATED_EXAMPLE parts.
// Used to verify that the resolution check produces no errors when there is no spatial intersection.
export const mockUpdateWithNonIntersectingPart: ValidatePolygonPartsRequestBody = {
  productId: createCustomInitPayloadRequestForAggregation.productId,
  productType: RasterProductTypes.ORTHOPHOTO,
  catalogId: createCustomInitPayloadRequestForAggregation.catalogId,
  productVersion: '2.0',
  jobType: JobTypes.Ingestion_Update,
  partsData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [33.0, 30.0],
              [33.01, 30.0],
              [33.01, 30.01],
              [33.0, 30.01],
              [33.0, 30.0],
            ],
          ],
        },
        properties: {
          ...propertiesToGenerate(),
          resolutionDegree: 0.0001,
        },
      },
    ],
  },
};

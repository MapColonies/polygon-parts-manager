/* eslint-disable  @typescript-eslint/no-magic-numbers */
import { PolygonPart } from '@map-colonies/mc-model-types';
import { Polygon } from 'geojson';
import { PolygonPartsPayload } from '../../src/polygonParts/models/interfaces';

type LayerMetadata = Pick<PolygonPartsPayload, 'catalogId' | 'productId' | 'productType' | 'productVersion'>;
type PartDataDetails = Omit<PolygonPart, 'footprint'>;

const createLayerMetadata: LayerMetadata = {
  productId: 'BLUE_MARBLE',
  productType: 'Orthophoto',
  catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
  productVersion: '1.0',
};

const updateLayerMetadata: LayerMetadata = {
  productId: 'BLUE_MARBLE',
  productType: 'Orthophoto',
  catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
  productVersion: '2.0',
};

const partDataDetails: PartDataDetails = {
  sourceId: 'string',
  sourceName: 'string',
  imagingTimeBeginUTC: new Date('2024-11-13T14:26:21.715Z'),
  imagingTimeEndUTC: new Date('2024-11-13T14:26:21.715Z'),
  resolutionDegree: 0.703125,
  resolutionMeter: 78271.52,
  sourceResolutionMeter: 78271.52,
  horizontalAccuracyCE90: 4000,
  sensors: ['string'],
  countries: ['string'],
  cities: ['string'],
  description: 'string',
};

function generateRequest(layerMetadata: LayerMetadata, partDataDetails: PartDataDetails, footprints: Polygon[]): PolygonPartsPayload {
  return {
    ...layerMetadata,
    partsData: generatePartsData(partDataDetails, footprints),
  };
}

function generatePartsData(partDataDetails: PartDataDetails, footprints: Polygon[]): PolygonPart[] {
  return footprints.map((footprint) => {
    return {
      ...partDataDetails,
      footprint,
    };
  });
}

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

export const createInitPayloadRequest: PolygonPartsPayload = generateRequest(createLayerMetadata, partDataDetails, [worldFootprint]);
export const separatePolygonsRequest: PolygonPartsPayload = generateRequest(updateLayerMetadata, partDataDetails, [
  franceFootprint,
  germanyFootprint,
  italyFootprint,
]);
export const intersectionWithItalyRequest: PolygonPartsPayload = generateRequest(updateLayerMetadata, partDataDetails, [
  italyFootprint,
  intersectionWithItalyFootprint,
]);

import type { Polygon } from 'typeorm';

type PolygonPartMetadata = Readonly<{
  geometry: Polygon;
  imagingTimeBeginUTC: Date;
  imagingTimeEndUTC: Date;
  resolutionDegree: number;
  resolutionMeter: number;
  sourceResolutionMeter: number;
  cities?: string[];
  countries?: string[];
  description?: string;
  horizontalAccuracyCE90?: number;
  sensors?: string[];
  sourceId?: string;
  sourceName?: string;
}>;

export type PolygonPartsPayload = Readonly<{
  catalogId: string;
  polygonPartsMetadata: PolygonPartMetadata[];
  productId: string;
  productType: string;
  productVersion?: string;
}>;

export interface CommonRecord extends Omit<PolygonPartsPayload, 'polygonPartsMetadata'>, PolygonPartMetadata {
  readonly ingestionDateUTC: Date;
}

export interface PartRecord extends CommonRecord {
  readonly id: string;
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

export interface PolygonPartRecord extends CommonRecord {
  readonly id: string;
  readonly insertionOrder: number;
  readonly partId: string;
}

export interface PolygonPartsIngestionPayload extends Omit<CommonRecord, 'ingestionDateUTC'> {
  readonly ingestionDateUTC: undefined;
}

export type ProductType =
  | 'Orthophoto'
  | 'OrthophotoHistory'
  | 'OrthophotoBest'
  | 'RasterMap'
  | 'RasterMapBest'
  | 'RasterAid'
  | 'RasterAidBest'
  | 'RasterVector'
  | 'RasterVectorBest';

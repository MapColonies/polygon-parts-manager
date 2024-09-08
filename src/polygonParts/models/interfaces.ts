import type { Polygon } from 'typeorm';

interface PolygonPartMetadata {
  geometry: Polygon;
  imagingTimeBeginUTC: Date;
  imagingTimeEndUTC: Date;
  resolutionDegree: number;
  resolutionMeter: number;
  sourceResolutionMeter: number;
  cities?: string;
  countries?: string;
  description?: string;
  horizontalAccuracyCE90?: number;
  sensors?: string;
  sourceId?: string;
  sourceName?: string;
}

export interface PolygonPartsPayload {
  catalogId: string;
  polygonPartsMetadata: PolygonPartMetadata[];
  productId: string;
  productType: string;
  productVersion?: string;
}

export interface PolygonPartRecord extends CommonRecord {
  readonly id: string;
  readonly insertionOrder: number;
  readonly partId: string;
}

export interface PartRecord extends CommonRecord {
  readonly id: string;
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

export interface PolygonPartsIngestionPayload extends Readonly<Omit<PolygonPartsPayload, 'polygonPartsMetadata'>>, Readonly<PolygonPartMetadata> {}

export interface CommonRecord extends PolygonPartsIngestionPayload {
  ingestionDateUTC: Date;
}

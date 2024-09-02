import type { Polygon } from 'typeorm';

interface PolygonPartMetadata {
  geometry: Polygon;
  imagingTimeBeginUtc: Date;
  imagingTimeEndUtc: Date;
  resolutionDegree: number;
  resolutionMeter: number;
  sourceResolutionMeter: number;
  cities?: string;
  countries?: string;
  description?: string;
  horizontalAccuracyCe90?: number;
  sensors?: string;
  sourceId?: string;
  sourceName?: string;
}

export interface PolygonPartsPayload {
  catalogId: string;
  ingestionDateUtc: Date;
  polygonPartsMetadata: PolygonPartMetadata[];
  productId: string;
  productType: string;
  productVersion?: string;
}

export interface PolygonPartRecord extends PolygonPart {
  id: string;
  partId: string;
}

export interface PartRecord extends PolygonPart {
  id: string;
  isProcessedPart: boolean;
}

export interface PolygonPart extends Omit<PolygonPartsPayload, 'polygonPartsMetadata'>, PolygonPartMetadata {}

import type { Polygon } from 'typeorm';

export interface PolygonPartRecord extends Part {
  id: string;
  partId: string;
}

export interface PartRecord extends Part {
  id: string;
  isProcessedPart: boolean;
}

export interface Part {
  catalogId: string;
  geometry: Polygon;
  imagingTimeBeginUtc: Date;
  imagingTimeEndUtc: Date;
  ingestionDateUtc: Date;
  productId: string;
  productType: string;
  resolutionDegree: number;
  resolutionMeter: number;
  sourceResolutionMeter: number;
  cities?: string;
  countries?: string;
  description?: string;
  horizontalAccuracyCe90?: number;
  productVersion?: string;
  sensors?: string;
  sourceId?: string;
  sourceName?: string;
}

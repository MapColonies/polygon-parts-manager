import type { IPolygonPart } from '@map-colonies/mc-model-types';

type PolygonPartMetadata = Readonly<Omit<IPolygonPart, 'id' | 'partId' | 'catalogId' | 'productId' | 'productType' | 'productVersion'>>;

export interface PolygonPartsPayload extends Readonly<Pick<IPolygonPart, 'catalogId' | 'productId' | 'productType' | 'productVersion'>> {
  readonly polygonPartsMetadata: PolygonPartMetadata[];
}

export interface CommonRecord extends Omit<PolygonPartsPayload, 'polygonPartsMetadata'>, PolygonPartMetadata {
  readonly ingestionDateUTC: Date;
}

export interface PartRecord extends CommonRecord, Readonly<Pick<IPolygonPart, 'id'>> {
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

export interface PolygonPartRecord extends CommonRecord, Readonly<Pick<IPolygonPart, 'id' | 'partId'>> {
  readonly insertionOrder: number;
}

export interface PolygonPartsIngestionPayload extends Omit<CommonRecord, 'ingestionDateUTC'> {
  readonly ingestionDateUTC: undefined;
}

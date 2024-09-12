import type { IPolygonPart, PolygonPartsPayload } from '@map-colonies/mc-model-types';

type PartData = Readonly<Pick<PolygonPartsPayload, 'partsData'>['partsData'][number]>;

export interface CommonRecord extends Omit<PolygonPartsPayload, 'partsData'>, PartData {
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

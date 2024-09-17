import type { IPolygonPart, PolygonPartsPayload } from '@map-colonies/mc-model-types';

type PartData = Readonly<Omit<Pick<PolygonPartsPayload, 'partsData'>['partsData'][number], 'countries' | 'cities' | 'sensors'>> &
  Readonly<{
    countries?: string;
    cities?: string;
    sensors: string;
  }>;

export interface CommonRecord extends Readonly<Omit<PolygonPartsPayload, 'partsData'>>, PartData {
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

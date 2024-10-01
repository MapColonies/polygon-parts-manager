import type { IPolygonPart, PolygonPart, PolygonPartsPayload } from '@map-colonies/mc-model-types';

interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}
interface CommonProperties extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
}
interface PartProperties extends Readonly<Pick<IPolygonPart, 'id'>> {}
interface PolygonPartProperties extends Readonly<Pick<IPolygonPart, 'id' | 'partId'>> {}

/**
 * Common record properties of part and polygon part
 */
export interface CommonRecord extends Readonly<Omit<PolygonPartsPayload, 'partsData'>>, CommonProperties {
  readonly ingestionDateUTC: Date;
}

/**
 * Part record properties of the raw ingested part
 */
export interface PartRecord extends CommonProperties, PartProperties {
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

/**
 * Polygon part record properties of the processed parts
 */
export interface PolygonPartRecord extends CommonProperties, PolygonPartProperties {
  readonly insertionOrder: number;
}

/**
 * Ingestion properties of polygon parts for create and update operations on DB
 */
export interface IngestionProperties extends Omit<CommonProperties, 'ingestionDateUTC'> {
  readonly ingestionDateUTC: undefined;
}

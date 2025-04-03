import type {
  PolygonPart,
  PolygonPartsEntityName,
  PolygonPartsEntityNameObject,
  PolygonPartsPayload as PolygonPartsPayloadType,
  RoiProperties,
} from '@map-colonies/raster-shared';
import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import type { NullableRecordValues, ReplaceValuesOfType } from '../../common/types';

interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}
type FindPolygonPartsOptionsFilterGeometries = Polygon | MultiPolygon | null;

/**
 * Properties of part data for insertion
 */
export interface InsertPartData extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
}

/**
 * Find polygon parts options
 */
export interface FindPolygonPartsOptions<ShouldClip extends boolean = boolean> {
  readonly shouldClip: ShouldClip;
  readonly polygonPartsEntityName: EntityNames;
  readonly filter: FeatureCollection<FindPolygonPartsOptionsFilterGeometries, (GeoJsonProperties & Partial<RoiProperties>) | null>;
}

/**
 * Find polygon parts response
 */
export type FindPolygonPartsResponse<ShouldClip extends boolean = boolean> = FeatureCollection<
  Polygon,
  ReplaceValuesOfType<
    NullableRecordValues<
      Omit<PolygonPartRecord, 'countries' | 'cities' | 'footprint' | 'insertionOrder' | 'sensors'> & {
        countries?: string[];
        cities?: string[];
        sensors: string[];
      }
    >,
    Date,
    string
  > & {
    requestFeatureId?: NonNullable<Feature['id']> | (ShouldClip extends true ? never : NonNullable<Feature['id']>[]);
  }
>;

/**
 * Polygon parts ingestion payload
 */
export interface PolygonPartsPayload extends PolygonPartsPayloadType {}

/**
 * Polygon parts response
 */
export interface PolygonPartsResponse extends EntityIdentifierObject {}

/**
 * Common record properties of part and polygon part
 */
export interface CommonRecord extends InsertPartData {
  readonly id: string;
  readonly ingestionDateUTC: Date;
}

/**
 * Part record properties of the raw ingested part
 */
export interface PartRecord extends CommonRecord {
  readonly insertionOrder: number;
  readonly isProcessedPart: boolean;
}

/**
 * Polygon part record properties of the processed parts
 */
export interface PolygonPartRecord extends CommonRecord {
  readonly partId: string;
  readonly insertionOrder: number;
}

/**
 * Entity identifier
 */
export type EntityIdentifier = PolygonPartsEntityName;

/**
 * Entity identifier
 */
export type EntityIdentifierObject = PolygonPartsEntityNameObject;

/**
 * Properties describing a name of an entity
 */
export type EntityName = `${Lowercase<string>}${EntityIdentifier}${Lowercase<string>}`;

/**
 * Properties describing names of an entity
 */
export interface EntityNames {
  entityName: EntityName;
  databaseObjectQualifiedName: `${Lowercase<string>}.${EntityName}`;
}

/**
 * Properties describing parts & polygon parts entities names
 */
export interface EntitiesMetadata {
  entityIdentifier: EntityIdentifier;
  entitiesNames: {
    parts: EntityNames;
    polygonParts: EntityNames;
  };
}

export interface IsSwapQueryParams {
  isSwap: boolean;
}

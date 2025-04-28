import type {
  AggregationFeature,
  PolygonPart,
  PolygonPartsEntityName,
  PolygonPartsEntityNameObject,
  PolygonPartsPayload as PolygonPartsPayloadType,
  RoiProperties,
} from '@map-colonies/raster-shared';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, MultiPolygon, Polygon } from 'geojson';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { NonNullableRecordValues, ReplaceValuesOfType } from '../../common/types';

//#region public
interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData'>, PolygonPart {}
/**
 * Polygonal geometries
 */
type PolygonalGeometries = Polygon | MultiPolygon;

/**
 * Properties of part data for insertion
 */
export interface InsertPartData extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
}

export type FeatureCollectionFilter = FeatureCollection<PolygonalGeometries, (GeoJsonProperties & Partial<RoiProperties>) | null>;

/**
 * Find polygon parts options
 */
export interface FindPolygonPartsOptions<ShouldClip extends boolean = boolean> {
  readonly shouldClip: ShouldClip;
  readonly polygonPartsEntityName: EntityNames;
  readonly filter?: FeatureCollectionFilter;
}

/**
 * Geometry type options for filtering polygon parts
 */
export type FindPolygonPartsOptionsFilterGeometries = Polygon | MultiPolygon;

/**
 * Find polygon parts response
 */
export type FindPolygonPartsResponse<ShouldClip extends boolean = boolean> = FeatureCollection<
  Polygon,
  ReplaceValuesOfType<
    NonNullableRecordValues<
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

/**
 * Get aggregation layer metadata options
 */
export type EmptyFilter = Record<string, never>;

export interface AggregateLayerMetadataOptions {
  readonly polygonPartsEntityName: EntityNames;
  readonly filter: FeatureCollectionFilter;
}

export interface FilterQueryMetadata {
  filterQueryAlias: string;
  filterRequestFeatureIds: string;
  selectOutputColumns: string[];
}

/**
 * Get aggregation layer metadata response
 */

export interface GetAggregationLayerMetadataResponse extends AggregationFeature {}
//#endregion

//#region private
export type IsValidDetailsResult = { valid: true; reason: null; location: null } | { valid: false; reason: string; location: Geometry | null };
export interface FindPolygonPartsQueryResponse<ShouldClip extends boolean = boolean> {
  readonly geojson: FindPolygonPartsResponse<ShouldClip>;
}
export type FindQueryFilterOptions<ShouldClip extends boolean = boolean> = Omit<FindPolygonPartsOptions<ShouldClip>, 'filter'> & {
  entityManager: EntityManager;
  filter: {
    inputFilter: FindPolygonPartsOptions<ShouldClip>['filter'];
    filterQueryAlias: string;
    filterRequestFeatureIds: string;
    selectOutputColumns: string[];
  };
};
export interface FindQuerySelectOptions {
  geometryColumn: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: { findFilterQuery: SelectQueryBuilder<any>; filterQueryAlias: string; filterRequestFeatureIds: string };
  requestFeatureId: string;
}
//#endregion

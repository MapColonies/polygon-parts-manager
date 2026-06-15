import type {
  AggregationFeature,
  IntersectedFeatureCollection,
  IntersectionFeatureCollection,
  JobTypes,
  PolygonPartsEntityName,
  PolygonPartsPayload as PolygonPartsPayloadType,
  RoiProperties,
  partSchema,
  polygonPartsEntityNameSchema,
} from '@map-colonies/raster-shared';
import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { z } from 'zod';
import type { OptionalToNullableRecordValues, ReplaceValuesOfType } from '../../common/types';

//#region public
interface CommonPayload extends Omit<PolygonPartsPayload, 'partsData' | 'jobType'>, Omit<z.infer<typeof partSchema>, 'id'> {}

/**
 * Polygonal geometries
 */
type PolygonalGeometries = Polygon | MultiPolygon;

/**
 * Job types for ingestion operations
 */
export type IngestionJobTypes = Extract<JobTypes, 'Ingestion_New' | 'Ingestion_Update' | 'Ingestion_Swap_Update'>;

/**
 * Properties of part data for insertion
 */
export interface InsertPartDataToHistory extends Readonly<Omit<CommonPayload, 'countries' | 'cities' | 'sensors'>> {
  readonly countries?: string;
  readonly cities?: string;
  readonly sensors: string;
  readonly footprint: Polygon;
}

// Used for the Base record
export type BasePart = Readonly<Omit<InsertPartDataToHistory, 'footprint' | 'id'>>;

export interface ValidatePartData extends Readonly<BasePart> {
  readonly footprint: Polygon | MultiPolygon;
  readonly id: string;
}

export type FeatureCollectionFilter = FeatureCollection<PolygonalGeometries, (GeoJsonProperties & Partial<RoiProperties>) | null>;

/**
 * Find polygon parts options
 */
export interface FindPolygonPartsOptions<ShouldClip extends boolean = boolean> {
  readonly shouldClip: ShouldClip;
  readonly polygonPartsEntityName: EntityNames;
  readonly filter: FeatureCollectionFilter | null;
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
    OptionalToNullableRecordValues<
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
 * Intersection options
 */
export interface IntersectionOptions {
  readonly polygonPartsEntityName: EntityNames;
  readonly geometry: IntersectionFeatureCollection;
}

/**
 * Itersection response
 */
export type IntersectionResponse = IntersectedFeatureCollection;

/**
 * Polygon parts ingestion payload - based on data producer
 */
export type PolygonPartsPayload = PolygonPartsPayloadType;

/**
 * Polygon parts response
 */
export type PolygonPartsResponse = EntityIdentifierObject;

/**
 * Common record properties of part and polygon part
 */
export interface CommonRecord extends Omit<InsertPartDataToHistory, 'footprint'> {
  readonly id: string;
  readonly ingestionDateUTC: Date;
  readonly footprint: Polygon | MultiPolygon;
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

export type BasePartRecord = BasePart;

export interface ValidatePartRecord extends ValidatePartData {
  readonly validated: boolean;
}

/**
 * Entity identifier
 */
export type EntityIdentifier = PolygonPartsEntityName;

/**
 * Entity identifier
 */
export type EntityIdentifierObject = z.infer<typeof polygonPartsEntityNameSchema>;

/**
 * Name of an entity
 */
export type EntityName = `${Lowercase<string>}${EntityIdentifier}${Lowercase<string>}`;

/**
 * Database object qualified name of an entity
 */
export type DatabaseObjectQualifiedName = `${Lowercase<string>}.${EntityName}`;

/**
 * Properties describing names of an entity
 */
export interface EntityNames {
  entityName: EntityName;
  databaseObjectQualifiedName: DatabaseObjectQualifiedName;
}

/**
 * Properties describing parts & polygon parts entities names
 */
export interface EntitiesMetadata {
  entityIdentifier: EntityIdentifier;
  entitiesNames: {
    history: EntityNames;
    polygonParts: EntityNames;
    validations: EntityNames;
  };
}

export interface IsSwapQueryParams {
  isSwap: boolean;
}

export interface ProcessPolygonPartsOptions {
  entitiesMetadata: EntitiesMetadata;
  shouldClearEntities?: boolean;
}

export interface FilterQueryMetadata {
  filterQueryAlias: string;
  filterRequestFeatureIds: string;
  selectOutputColumns: string[];
}

/**
 * Get aggregation layer metadata options
 */
export interface AggregateLayerMetadataOptions {
  readonly polygonPartsEntityName: EntityNames;
  readonly filter: FeatureCollectionFilter | null;
}

/**
 * Get aggregation layer metadata response
 */
export type AggregationLayerMetadataResponse = AggregationFeature;

/**
 * Get exists options
 */
export interface ExistsOptions {
  readonly payload: Pick<PolygonPartsPayload, 'productId' | 'productType'>;
  readonly entitiesMetadata: EntitiesMetadata;
}

/**
 * Get exists response
 */
export type ExistsResponse = EntityIdentifierObject;
//#endregion

//#region private
export interface FindPolygonPartsQueryResponse<ShouldClip extends boolean = boolean> {
  readonly geojson: FindPolygonPartsResponse<ShouldClip>;
}

export interface IntersectionQueryResponse {
  geojson: IntersectionResponse;
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

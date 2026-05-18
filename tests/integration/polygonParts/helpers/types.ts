import type { polygonPartsFeatureSchema } from '@map-colonies/raster-shared';
import type { z } from 'zod';
import type { OptionalToNullableRecordValues } from '../../../../src/common/types';
import type { ValidatePolygonPartsRequestBody } from '../../../../src/polygonParts/controllers/interfaces';
import type {
  EntitiesMetadata,
  EntityIdentifierObject,
  InsertPartDataToHistory,
  PolygonPartsPayload,
} from '../../../../src/polygonParts/models/interfaces';

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends Record<PropertyKey, unknown>[] | Record<PropertyKey, unknown> ? DeepPartial<T[P]> : T[P];
    }
  : T;

export type ExpectedPostgresResponse = OptionalToNullableRecordValues<InsertPartDataToHistory>[];

export type GetEntitiesMetadata = (
  entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
) => EntitiesMetadata;

// Helper type for test data insertion - accepts string or Date for date fields
export type InsertPayload = Omit<ValidatePolygonPartsRequestBody, 'jobType'>;

export type PolygonPartFeature = z.infer<typeof polygonPartsFeatureSchema>;

export type PartialPolygonPartsPayload = Partial<Omit<PolygonPartsPayload, 'partsData'>> & {
  partsData?: {
    type?: 'FeatureCollection';
    features?: (Pick<PolygonPartFeature, 'type'> & DeepPartial<Omit<PolygonPartFeature, 'type'>>)[];
  };
};

import type { OptionalToNullableRecordValues } from '../../../../src/common/types';
import type { InsertPartData } from '../../../../src/polygonParts/models/interfaces';

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends Record<PropertyKey, unknown>[] | Record<PropertyKey, unknown> ? DeepPartial<T[P]> : T[P];
    }
  : T;

export type ExpectedPostgresResponse = OptionalToNullableRecordValues<InsertPartData>[];

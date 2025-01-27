export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends Record<PropertyKey, unknown>[] | Record<PropertyKey, unknown> ? DeepPartial<T[P]> : T[P];
    }
  : T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NullableRecordValues<T extends Record<PropertyKey, any>> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? T[K] : Exclude<T[K] | null, undefined>;
};
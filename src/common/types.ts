export type DeepMapValues<T extends object, V> = {
  [K in keyof T]: T[K] extends object ? DeepMapValues<T[K], V> : V;
};

export type MapValues<T, V> = {
  [K in keyof T]: V;
};

export type ReplaceValuesOfType<T, VFrom, VTo> = {
  [K in keyof T]: T[K] extends VFrom ? VTo : T[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NonNullableRecordValues<T extends Record<PropertyKey, any>> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? T[K] : Exclude<T[K] | null, undefined>;
};

export type PickPropertiesOfType<T, PT> = keyof {
  [K in keyof T as Exclude<K, T[K] extends PT ? never : K>]: T[K];
};

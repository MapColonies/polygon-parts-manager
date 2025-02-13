export type MapValues<T, V> = {
  [K in keyof T]: V;
};

export type PickPropertiesOfType<T, PT> = keyof {
  [K in keyof T as Exclude<K, T[K] extends PT ? never : K>]: T[K];
};

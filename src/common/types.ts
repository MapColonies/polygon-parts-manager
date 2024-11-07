export type EnsureType<T extends Expected, Expected> = T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UndefineProperties<T extends Record<PropertyKey, any>, S> = {
  [K in keyof T]: K extends S ? undefined : T[K];
};

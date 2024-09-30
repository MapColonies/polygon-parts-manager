// Helper logical AND type
type And<T, U> = T extends true ? (U extends true ? true : false) : false;

// Helper type to add underscore before each first capital/digit in a string
type AppendSeperator<S extends string, PrevCapital extends boolean = false, Separator extends string = '_'> = S extends `${infer First}${infer Rest}` // ignore capitalized
  ? And<Rest extends Capitalize<Rest> ? true : false, PrevCapital extends false ? true : false> extends true
    ? Rest extends ''
      ? S
      : `${First}${Separator}${AppendSeperator<Rest, true>}`
    : `${First}${AppendSeperator<Rest, And<Rest extends Capitalize<Rest> ? true : false, PrevCapital extends true ? true : false>>}`
  : S;

// Helper type to transform camel case to snake case by lowercasing all the separated parts of the snake case
export type CamelToSnakeCase<S extends string> = Lowercase<AppendSeperator<S>>;

// Helper type to transform object keys from camel to snake case
export type CamelToSnake<T extends Record<string, any>> = {
  [K in keyof T as CamelToSnakeCase<Extract<K, string>>]: T[K];
};

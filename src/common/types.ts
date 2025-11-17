import { polygonSchema, multiPolygonSchema } from '@map-colonies/raster-shared';
import { z } from 'zod';

const featurePropertiesSchema = z.object({
  sourceId: z.string().optional(),
  sourceName: z.string(),
  imagingTimeBeginUTC: z.string(),
  imagingTimeEndUTC: z.string(),
  resolutionDegree: z.number(),
  resolutionMeter: z.number(),
  sourceResolutionMeter: z.number(),
  horizontalAccuracyCE90: z.number(),
  sensors: z.array(z.string()).min(1),
  countries: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const validationFeaureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string(),
  properties: featurePropertiesSchema,
  geometry: z.union([polygonSchema, multiPolygonSchema]),
  bbox: z.any().optional(),
});

const polygonPartsFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(validationFeaureSchema),
  bbox: z.any().optional(),
});

export type DeepMapValues<T extends object, V> = {
  [K in keyof T]: T[K] extends object ? DeepMapValues<T[K], V> : V;
};

export type IdenticalKeyValuePairs<T> = {
  [K in keyof T]: K;
};

export type MapValues<T, V> = {
  [K in keyof T]: V;
};

export type ReplaceValuesOfType<T, VFrom, VTo> = {
  [K in keyof T]: T[K] extends VFrom ? VTo : T[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionalToNullableRecordValues<T extends Record<PropertyKey, any>> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? T[K] : Exclude<T[K] | null, undefined>;
};

export type PolygonPartsFeatureCollection = z.infer<typeof polygonPartsFeatureCollectionSchema>;

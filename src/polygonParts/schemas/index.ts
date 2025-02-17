import {
  multiPolygonSchema,
  partSchema,
  polygonPartsEntityPatternSchema,
  polygonSchema,
  rasterProductTypeSchema,
  resourceIdSchema,
} from '@map-colonies/raster-shared';
import { ZodType, z, type ZodTypeDef } from 'zod';
import type { ApplicationConfig, DbConfig } from '../../common/interfaces';
import { Transformer } from '../../common/middlewares/transformer';
import type { DeepMapValues } from '../../common/types';
import type { FindPolygonPartsQueryParams, FindPolygonPartsRequestBody } from '../controllers/interfaces';
import type { EntitiesMetadata, EntityNames, IsSwapQueryParams, PolygonPartsPayload } from '../models/interfaces';

export const findPolygonPartsQueryParamsSchema: ZodType<FindPolygonPartsQueryParams> = z.object({
  shouldClip: z.boolean(),
});

export const findPolygonPartsRequestBodySchema: ZodType<FindPolygonPartsRequestBody> = z
  .object({
    footprint: polygonSchema.or(multiPolygonSchema),
  })
  .partial();

export const polygonPartsRequestBodySchema: ZodType<PolygonPartsPayload> = z.object({
  productType: rasterProductTypeSchema,
  productId: resourceIdSchema,
  catalogId: z.string().uuid(),
  productVersion: z.string(),
  partsData: partSchema.array(),
});

export const updatePolygonPartsQueryParamsSchema: ZodType<IsSwapQueryParams> = z.object({
  isSwap: z.boolean(),
});

export const getDBEntityNameSchemaFactory = <T extends keyof ApplicationConfig['entities']>({
  namePrefix,
  nameSuffix,
  schema,
  entity,
  getEntitiesMetadata,
}: { entity: T } & ApplicationConfig['entities'][T] & Pick<DbConfig, 'schema'> & Pick<Transformer, 'getEntitiesMetadata'>): ZodType<
  EntityNames,
  ZodTypeDef,
  DeepMapValues<EntityNames, string>
> => {
  return z.object({
    entityName: z
      .string()
      .transform((val) => val.replaceAll(new RegExp(`(^${namePrefix})|(${nameSuffix}$)`, 'g'), ''))
      .pipe(polygonPartsEntityPatternSchema)
      .transform((val) => getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames[entity].entityName),
    databaseObjectQualifiedName: z
      .string()
      .transform((val) => val.replaceAll(new RegExp(`(^${schema}.${namePrefix})|(${nameSuffix}$)`, 'g'), ''))
      .pipe(polygonPartsEntityPatternSchema)
      .transform((val) => getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames[entity].databaseObjectQualifiedName),
  });
};

export const getEntitiesMetadataSchemaFactory = ({
  entities: { parts, polygonParts },
  schema,
  getEntitiesMetadata,
}: Pick<ApplicationConfig, 'entities'> & Pick<DbConfig, 'schema'> & Pick<Transformer, 'getEntitiesMetadata'>): ZodType<
  EntitiesMetadata,
  ZodTypeDef,
  DeepMapValues<EntitiesMetadata, string>
> => {
  const partsDBEntityNameSchema = getDBEntityNameSchemaFactory({
    ...parts,
    ...{ schema },
    getEntitiesMetadata,
    entity: 'parts',
  });

  const polygonPartsDBEntityNameSchema = getDBEntityNameSchemaFactory({
    ...polygonParts,
    ...{ schema },
    getEntitiesMetadata,
    entity: 'polygonParts',
  });

  return z
    .object({
      entityIdentifier: polygonPartsEntityPatternSchema,
      entitiesNames: z
        .object({
          parts: partsDBEntityNameSchema,
          polygonParts: polygonPartsDBEntityNameSchema,
        })
        .strict(),
    })
    .strict();
};

export const schemaParser = <T>(options: { schema: ZodType<T, ZodTypeDef, T>; value: unknown; errorMessagePrefix: string }): T => {
  const { schema, value, errorMessagePrefix } = options;
  return schema.parse(value, {
    errorMap: (issue, ctx) => {
      return { message: `${errorMessagePrefix}: ${issue.message ?? ctx.defaultError}` };
    },
  });
};

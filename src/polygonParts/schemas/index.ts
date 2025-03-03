import {
  INGESTION_VALIDATIONS,
  multiPolygonSchema,
  polygonPartsEntityPatternSchema,
  polygonSchema,
} from '@map-colonies/raster-shared';
import { ZodType, z, type ZodTypeDef } from 'zod';
import { ValidationError } from '../../common/errors';
import type { ApplicationConfig, DbConfig } from '../../common/interfaces';
import { Transformer } from '../../common/middlewares/transformer';
import type { DeepMapValues } from '../../common/types';
import type { FindPolygonPartsQueryParams, FindPolygonPartsRequestBody } from '../controllers/interfaces';
import type { EntitiesMetadata, EntityNames, IsSwapQueryParams } from '../models/interfaces';

const polygonPartsEntityNamePatternSchema = z.string().regex(new RegExp(INGESTION_VALIDATIONS.polygonPartsEntityName.pattern));

const findPolygonPartsFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: polygonSchema.or(multiPolygonSchema).nullable(),
  properties: z.object({}).passthrough().nullable(),
});

const findPolygonPartsFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(findPolygonPartsFeatureSchema),
});

export const findPolygonPartsQueryParamsSchema: ZodType<FindPolygonPartsQueryParams> = z.object({
  shouldClip: z.boolean(),
});

export const findPolygonPartsRequestBodySchema: ZodType<FindPolygonPartsRequestBody> = findPolygonPartsFeatureCollectionSchema;

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
    entityName: polygonPartsEntityNamePatternSchema
      .transform((val) => val.replaceAll(new RegExp(`(^${namePrefix})|(${nameSuffix}$)`, 'g'), ''))
      .pipe(polygonPartsEntityPatternSchema)
      .transform((val) => getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames[entity].entityName),
    databaseObjectQualifiedName: z
      .string()
      .transform((val) => val.replaceAll(new RegExp(`(^${schema}\\.)`, 'g'), ''))
      .pipe(polygonPartsEntityNamePatternSchema)
      .transform((val) => val.replaceAll(new RegExp(`(^${namePrefix})|(${nameSuffix}$)`, 'g'), ''))
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

export const schemaParser = <Ouput, Def extends ZodTypeDef = ZodTypeDef, Input = Ouput>(options: {
  schema: ZodType<Ouput, Def, Input>;
  value: unknown;
  errorMessagePrefix?: string;
}): Ouput => {
  const { schema, value, errorMessagePrefix } = options;
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError({ issues: error.issues, errorMessagePrefix });
    }
    throw error;
  }
};

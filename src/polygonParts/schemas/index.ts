import {
  INGESTION_VALIDATIONS,
  featureCollectionSchema,
  featureSchema,
  intersectionFeatureCollectionSchema,
  multiPolygonSchema,
  polygonPartsEntityPatternSchema,
  polygonSchema,
  roiPropertiesSchema,
} from '@map-colonies/raster-shared';
import type { Feature } from 'geojson';
import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { ApplicationConfig, DbConfig } from '../../common/interfaces';
import type { DeepMapValues } from '../../common/types';
import type { Transformer } from '../../middlewares/transformer';
import type { FindPolygonPartsQueryParams } from '../controllers/interfaces';
import type { EntitiesMetadata, EntityNames, IsSwapQueryParams } from '../models/interfaces';

const getDBEntityNameSchemaFactory = <T extends keyof ApplicationConfig['entities']>({
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

const aggregatePolygonPartsFeatureSchema = featureSchema(polygonSchema.or(multiPolygonSchema), roiPropertiesSchema);
const aggregatePolygonPartsFeatureCollectionSchema = featureCollectionSchema(aggregatePolygonPartsFeatureSchema);

const polygonPartsEntityNamePatternSchema = z
  .string()
  .regex(new RegExp(INGESTION_VALIDATIONS.polygonPartsEntityName.pattern), { message: 'Polygon parts entity name should valid entity name' });
const findPolygonPartsFeatureSchema = featureSchema(polygonSchema.or(multiPolygonSchema), roiPropertiesSchema.partial().passthrough().nullable());
const findPolygonPartsFeatureCollectionSchema = featureCollectionSchema(findPolygonPartsFeatureSchema);

export const aggregationPolygonPartsRequestBodySchema = z.object({
  filter: aggregatePolygonPartsFeatureCollectionSchema.nullable(),
});

export const findPolygonPartsQueryParamsSchema: ZodType<FindPolygonPartsQueryParams> = z.object({
  shouldClip: z.boolean(),
});

export const findPolygonPartsRequestBodySchema = z
  .object({
    filter: findPolygonPartsFeatureCollectionSchema.nullable(),
  })
  .refine((body) => {
    if (!body.filter) {
      return true;
    }

    const featureIds = body.filter.features
      .map((feature) => feature.id)
      .filter((featureId): featureId is NonNullable<Feature['id']> => featureId !== undefined);
    const uniqueFeatureIds = new Set(featureIds);
    return uniqueFeatureIds.size === featureIds.length;
  }, 'Input features should have unique ids');

export const intersectionRequestBodySchema = intersectionFeatureCollectionSchema;

export const updatePolygonPartsQueryParamsSchema: ZodType<IsSwapQueryParams> = z.object({
  isSwap: z.boolean(),
});

export const getEntitiesMetadataSchemaFactory = ({
  entities: { history: parts, polygonParts, validations },
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
    entity: 'history',
  });

  const polygonPartsDBEntityNameSchema = getDBEntityNameSchemaFactory({
    ...polygonParts,
    ...{ schema },
    getEntitiesMetadata,
    entity: 'polygonParts',
  });
  const validationsDBEntityNameSchema = getDBEntityNameSchemaFactory({
    ...validations,
    ...{ schema },
    getEntitiesMetadata,
    entity: 'validations',
  });

  return z
    .object({
      entityIdentifier: polygonPartsEntityPatternSchema,
      entitiesNames: z
        .object({
          history: partsDBEntityNameSchema,
          polygonParts: polygonPartsDBEntityNameSchema,
          validations: validationsDBEntityNameSchema,
        })
        .strict(),
    })
    .strict();
};

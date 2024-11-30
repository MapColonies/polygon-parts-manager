import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema, VALIDATIONS } from '@map-colonies/mc-model-types';
import { z, ZodError, type ZodType } from 'zod';
import type { GetAggregationLayerMetadataHandler } from '../../aggregation/controllers/aggregationController';
import type { CreatePolygonPartsHandler, UpdatePolygonPartsHandler } from '../../polygonParts/controllers/polygonPartsController';
import { getEntitiesNames } from '../../polygonParts/DAL/utils';
import type { EntityName, EntityNames, PolygonPartsPayload } from '../../polygonParts/models/interfaces';

const polygonPartsDBEntityNameSchema: ZodType<EntityName> = z.object({
  entityName: polygonPartsEntityNameSchema.shape.polygonPartsEntityName,
  databaseObjectQualifiedName: z.string().regex(new RegExp('^[a-z][a-z0-9_]{0,62}\\.[a-z][a-z0-9_]{0,62}$')),
});

const partsDBEntityNameSchema: ZodType<EntityName> = z.object({
  entityName: z.string().regex(new RegExp(VALIDATIONS.polygonPartsEntityName.pattern)),
  databaseObjectQualifiedName: z.string().regex(new RegExp('^[a-z][a-z0-9_]{0,62}\\.[a-z][a-z0-9_]{0,62}$')),
});

const entityNamesSchema: ZodType<EntityNames> = z
  .object({
    parts: partsDBEntityNameSchema,
    polygonParts: polygonPartsDBEntityNameSchema,
  })
  .strict();

const parsePolygonPartsEntityName = (polygonPartsPayload: PolygonPartsPayload): EntityNames => {
  const entityNames = getEntitiesNames(polygonPartsPayload);
  return entityNamesSchema.parse(entityNames);
};

export const validateGetAggregationLayerMetadata: GetAggregationLayerMetadataHandler = (req, _, next) => {
  try {
    polygonPartsEntityNameSchema.shape.polygonPartsEntityName.parse(req.params.polygonPartsEntityName);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestError(`Input could not qualify for allowed entity identifiers: ${error.message}`);
    }
    next(error);
  }
};

export const parseCreatePolygonParts: CreatePolygonPartsHandler = (req, res, next) => {
  try {
    const entityNames = parsePolygonPartsEntityName(req.body);
    res.locals = entityNames;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestError(`Input could not qualify for allowed entity identifiers: ${error.message}`);
    }
    next(error);
  }
};

export const parseUpdatePolygonParts: UpdatePolygonPartsHandler = (req, res, next) => {
  try {
    const entityNames = parsePolygonPartsEntityName(req.body);
    res.locals = entityNames;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestError(error.message);
    }
    next(error);
  }
};

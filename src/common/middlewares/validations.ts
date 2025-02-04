import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema, VALIDATIONS } from '@map-colonies/mc-model-types';
import { z, ZodError, type ZodType } from 'zod';
import type { GetAggregationLayerMetadataHandler } from '../../aggregation/controllers/aggregationController';
import type { CreatePolygonPartsHandler, UpdatePolygonPartsHandler } from '../../polygonParts/controllers/polygonPartsController';
import { getEntitiesNames } from '../../polygonParts/DAL/utils';
import type { EntityName, EntityNames, PolygonPartsPayload } from '../../polygonParts/models/interfaces';

const VALID_DATABASE_OBJECT_NAME = '[a-z][a-z0-9_]{0,61}[a-z0-9]';
const databaseObjectQualifiedName = `^${VALID_DATABASE_OBJECT_NAME}\\.${VALID_DATABASE_OBJECT_NAME}$`;
const databaseObjectQualifiedNameRegex = new RegExp(databaseObjectQualifiedName);

const polygonPartsDBEntityNameSchema: ZodType<EntityName> = z.object({
  entityName: polygonPartsEntityNameSchema.shape.polygonPartsEntityName,
  databaseObjectQualifiedName: z.string().regex(databaseObjectQualifiedNameRegex),
});

const partsDBEntityNameSchema: ZodType<EntityName> = z.object({
  entityName: z.string().regex(new RegExp(VALIDATIONS.polygonPartsEntityName.pattern)),
  databaseObjectQualifiedName: z.string().regex(databaseObjectQualifiedNameRegex),
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
    polygonPartsEntityNameSchema.parse(req.params);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestError(`Request parameters could not qualify for a valid entity identifiers: ${error.message}`);
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
      throw new BadRequestError(`Request parameters could not qualify for a valid entity identifiers: ${error.message}`);
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
      throw new BadRequestError(`Request parameters could not qualify for a valid entity identifiers: ${error.message}`);
    }
    next(error);
  }
};

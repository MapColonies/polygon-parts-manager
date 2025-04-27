import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { polygonPartsEntityNameSchema, polygonPartsPayloadSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import type { Feature } from 'geojson';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ValidationError } from '../../common/errors';
import { findPolygonPartsQueryParamsSchema, findPolygonPartsRequestBodySchema, schemaParser, updatePolygonPartsQueryParamsSchema } from '../schemas';

/**
 * Create polygon parts validation handler
 */
type CreatePolygonPartsValidationHandler = RequestHandler<undefined, undefined, unknown, undefined>;

/**
 * Find polygon parts validation handler
 */
type FindPolygonPartsValidationHandler = RequestHandler<unknown, undefined, unknown, unknown>;

/**
 * Update polygon parts validation handler
 */
type UpdatePolygonPartsValidationHandler = RequestHandler<undefined, undefined, unknown, unknown>;

@singleton()
export class ValidationsController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public readonly validateCreatePolygonParts: CreatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'create polygon parts validation failed', error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };

  public readonly validateUpdatePolygonParts: UpdatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      schemaParser({ schema: updatePolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'update polygon parts validation failed', error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };

  public readonly validateFindPolygonParts: FindPolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      schemaParser({ schema: findPolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
      schemaParser({
        schema: findPolygonPartsRequestBodySchema.refine((featureCollection) => {
          if (!featureCollection) {
            return true;
          }

          const featureIds = featureCollection.features
            .map((feature) => feature.id)
            .filter((featureId): featureId is NonNullable<Feature['id']> => featureId !== undefined);
          const uniqueFeatureIds = new Set(featureIds);
          return uniqueFeatureIds.size === featureIds.length;
        }, 'Input features should have unique ids'),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      next();
    } catch (error) {
      this.logger.error({ msg: 'find polygon parts validation failed', error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };
}

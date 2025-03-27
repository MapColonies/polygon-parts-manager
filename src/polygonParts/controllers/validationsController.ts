import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { polygonPartsEntityNameSchema, polygonPartsPayloadSchema } from '@map-colonies/raster-shared';
import { intersect } from '@turf/intersect';
import type { RequestHandler } from 'express';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ValidationError } from '../../common/errors';
import type { FindPolygonPartsParams, FindPolygonPartsResponseBody } from '../../polygonParts/controllers/interfaces';
import type { PolygonPartsResponse } from '../models/interfaces';
import { findPolygonPartsQueryParamsSchema, findPolygonPartsRequestBodySchema, schemaParser, updatePolygonPartsQueryParamsSchema } from '../schemas';

/**
 * Create polygon parts validation handler
 */
type CreatePolygonPartsValidationHandler = RequestHandler<undefined, PolygonPartsResponse, unknown, undefined>;

/**
 * Find polygon parts validation handler
 */
type FindPolygonPartsValidationHandler = RequestHandler<FindPolygonPartsParams, FindPolygonPartsResponseBody, unknown, unknown>;

/**
 * Update polygon parts validation handler
 */
type UpdatePolygonPartsValidationHandler = RequestHandler<undefined, PolygonPartsResponse, unknown, unknown>;

@singleton()
export class ValidationsController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public readonly validateCreatePolygonParts: CreatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
    next();
  };

  public readonly validateUpdatePolygonParts: UpdatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      schemaParser({ schema: updatePolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
    next();
  };

  public readonly validateFindPolygonParts: FindPolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      schemaParser({ schema: findPolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
      schemaParser({
        schema: findPolygonPartsRequestBodySchema.refine((findPolygonPartsRequestBody) => {
          const nonEmptyGeometryFeatures = {
            ...findPolygonPartsRequestBody,
            features: findPolygonPartsRequestBody.features.filter((feature): feature is Feature<Polygon | MultiPolygon> => feature.geometry !== null),
          };
          try {
            const inputGeometriesSelfIntersect = !(nonEmptyGeometryFeatures.features.length > 1 && intersect(nonEmptyGeometryFeatures));
            return inputGeometriesSelfIntersect;
          } catch (error) {
            this.logger.error(error);
            return false;
          }
        }, 'Input features should not intersect'),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
    next();
  };
}

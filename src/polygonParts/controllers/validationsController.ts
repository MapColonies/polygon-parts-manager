import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema, polygonPartsPayloadSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import { singleton } from 'tsyringe';
import { ZodError } from 'zod';
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
  public readonly validateCreatePolygonParts: CreatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
    } catch (error) {
      if (error instanceof ZodError) {
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
      if (error instanceof ZodError) {
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
      schemaParser({ schema: findPolygonPartsRequestBodySchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
    next();
  };
}

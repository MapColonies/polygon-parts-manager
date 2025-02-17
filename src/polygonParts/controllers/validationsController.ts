import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import { singleton } from 'tsyringe';
import { ZodError } from 'zod';
import type { FindPolygonPartsParams, FindPolygonPartsResponseBody } from '../../polygonParts/controllers/interfaces';
import type { PolygonPartsResponse } from '../models/interfaces';
import {
  findPolygonPartsQueryParamsSchema,
  findPolygonPartsRequestBodySchema,
  polygonPartsRequestBodySchema,
  updatePolygonPartsQueryParamsSchema,
} from '../schemas';

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
      try {
        polygonPartsRequestBodySchema.parse(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid request body: ${error.message}`);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  public readonly validateUpdatePolygonParts: UpdatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      try {
        polygonPartsRequestBodySchema.parse(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid request body: ${error.message}`);
        }
      }

      try {
        updatePolygonPartsQueryParamsSchema.parse(req.query);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid query params: ${error.message}`);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  public readonly validateFindPolygonParts: FindPolygonPartsValidationHandler = (req, _, next) => {
    try {
      try {
        polygonPartsEntityNameSchema.parse(req.params);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid request params: ${error.message}`);
        }
      }

      try {
        findPolygonPartsQueryParamsSchema.parse(req.query);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid query params: ${error.message}`);
        }
      }

      try {
        findPolygonPartsRequestBodySchema.parse(req.body, {
          errorMap: (issue, ctx) => {
            return { message: `${issue.message ?? ''}` };
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid request body: ${error.message}`);
        }
      }
      // try {
      //   findPolygonPartsRequestBodySchema.parse(req.body, {
      //     errorMap: (issue, ctx) => {
      //       return { message: 'blat' };
      //     },
      //   });
      // } catch (error) {
      //   if (error instanceof ZodError) {
      //     throw new BadRequestError(`Invalid request body: ${error.message}`);
      //   }
      // }
      next();
    } catch (error) {
      next(error);
    }
  };
}

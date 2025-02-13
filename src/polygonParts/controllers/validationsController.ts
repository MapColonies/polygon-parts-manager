import { BadRequestError } from '@map-colonies/error-types';
import {
  multiPolygonSchema,
  partSchema,
  polygonPartsEntityNameSchema,
  polygonSchema,
  rasterProductTypeSchema,
  resourceIdSchema,
} from '@map-colonies/raster-shared';
import { singleton } from 'tsyringe';
import { ZodError, ZodType, z } from 'zod';
import type {
  CreatePolygonPartsValidationHandler,
  FindPolygonPartsQueryParams,
  FindPolygonPartsRequestBody,
  FindPolygonPartsValidationHandler,
  UpdatePolygonPartsValidationHandler,
} from '../../polygonParts/controllers/interfaces';
import type { IsSwapQueryParams, PolygonPartsPayload } from '../../polygonParts/models/interfaces';

const findPolygonPartsQueryParamsSchema: ZodType<FindPolygonPartsQueryParams> = z.object({
  clip: z.boolean(),
});

const findPolygonPartsRequestBodySchema: ZodType<FindPolygonPartsRequestBody> = z
  .object({
    footprint: polygonSchema.or(multiPolygonSchema),
  })
  .partial();

const polygonPartsRequestBodySchema: ZodType<PolygonPartsPayload> = z.object({
  productType: rasterProductTypeSchema,
  productId: resourceIdSchema,
  catalogId: z.string().uuid(),
  productVersion: z.string(), // TODO: import from raster-shared
  partsData: partSchema.array(),
});

const updatePolygonPartsQueryParamsSchema: ZodType<IsSwapQueryParams> = z.object({
  isSwap: z.boolean(),
});

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
        findPolygonPartsRequestBodySchema.parse(req.body);
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
}

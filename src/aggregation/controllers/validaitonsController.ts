import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import { singleton } from 'tsyringe';
import { ZodError } from 'zod';
import type { GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody } from '../../aggregation/controllers/interfaces';
import { schemaParser } from '../../polygonParts/schemas';

/**
 * Get aggregation layer metadata validation handler
 */
type GetAggregationLayerMetadataValidationHandler = RequestHandler<
  GetAggregationLayerMetadataParams,
  GetAggregationLayerMetadataResponseBody,
  undefined,
  undefined
>;

@singleton()
export class ValidationsController {
  public readonly validateGetAggregationLayerMetadata: GetAggregationLayerMetadataValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
    next();
  };
}

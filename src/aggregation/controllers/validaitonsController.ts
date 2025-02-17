import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import { singleton } from 'tsyringe';
import { ZodError } from 'zod';
import type { GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody } from '../../aggregation/controllers/interfaces';

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
      polygonPartsEntityNameSchema.parse(req.params);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError(`Invalid request params: ${error.message}`);
      }
    }
    next();
  };
}

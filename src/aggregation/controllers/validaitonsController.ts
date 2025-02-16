import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityNameSchema } from '@map-colonies/raster-shared';
import { singleton } from 'tsyringe';
import { ZodError } from 'zod';
import type { GetAggregationLayerMetadataValidationHandler } from '../../aggregation/controllers/interfaces';

@singleton()
export class ValidationsController {
  public readonly validateGetAggregationLayerMetadata: GetAggregationLayerMetadataValidationHandler = (req, _, next) => {
    try {
      try {
        polygonPartsEntityNameSchema.parse(req.params);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new BadRequestError(`Invalid request params: ${error.message}`);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

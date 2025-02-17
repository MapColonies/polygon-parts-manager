import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import type { EntitiesMetadata } from '../../polygonParts/models/interfaces';
import { AggregationManager } from '../models/aggregationManager';
import type { GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody } from './interfaces';

/**
 * Get aggregation layer metadata handler
 */
export type GetAggregationLayerMetadataHandler = RequestHandler<GetAggregationLayerMetadataParams, GetAggregationLayerMetadataResponseBody, undefined, undefined, EntitiesMetadata>;

@injectable()
export class AggregationController {
  public constructor(@inject(AggregationManager) private readonly aggregationManager: AggregationManager) {}

  public getAggregationLayerMetadata: GetAggregationLayerMetadataHandler = async (_, res, next) => {
    try {
      const response = await this.aggregationManager.getAggregationLayerMetadata({
        polygonPartsEntityName: res.locals.entitiesNames.polygonParts,
      });
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      next(error);
    }
  };
}

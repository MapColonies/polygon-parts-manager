import type { AggregationLayerMetadata } from '@map-colonies/mc-model-types';
import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AggregationManager } from '../models/aggregationManager';
import type { AggregationParams } from '../models/interfaces';

export type GetAggregationLayerMetadataHandler = RequestHandler<AggregationParams, AggregationLayerMetadata, undefined>;

@injectable()
export class AggregationController {
  public constructor(@inject(AggregationManager) private readonly aggregationManager: AggregationManager) {}

  public getAggregationLayerMetadata: GetAggregationLayerMetadataHandler = async (req, res, next) => {
    try {
      const aggregationMetadata = await this.aggregationManager.getAggregationLayerMetadata(req.params);
      return res.status(httpStatus.OK).json(aggregationMetadata);
    } catch (error) {
      next(error);
    }
  };
}

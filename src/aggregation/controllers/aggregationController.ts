import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { AggregationManager } from '../models/aggregationManager';
import type { AggregationMetadata, AggregationParams } from '../models/interfaces';

type GetAggregationHandler = RequestHandler<AggregationParams, AggregationMetadata, undefined>;

@injectable()
export class AggregationController {
  public constructor(@inject(AggregationManager) private readonly aggregationManager: AggregationManager) {}

  public getAggregationMetadata: GetAggregationHandler = async (req, res, next) => {
    try {
      const aggregationMetadata = await this.aggregationManager.getAggregationMetadata(req.params);
      return res.status(httpStatus.OK).json(aggregationMetadata);
    } catch (error) {
      next(error);
    }
  };
}

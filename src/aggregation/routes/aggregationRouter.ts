import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { validateGetAggregationLayerMetadata } from '../../common/middlewares/validations';
import { AggregationController } from '../controllers/aggregationController';

const aggregationRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(AggregationController);

  router.get('/:polygonPartsEntityName', validateGetAggregationLayerMetadata, controller.getAggregationLayerMetadata);

  return router;
};

export const AGGREGATION_ROUTER_SYMBOL = Symbol('aggregationRouterFactory');

export { aggregationRouterFactory };

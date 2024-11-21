import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { AggregationController } from '../controllers/aggregationController';

const aggregationRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(AggregationController);

  router.get('/:catalogId', controller.getAggregationMetadata);

  return router;
};

export const AGGREGATION_ROUTER_SYMBOL = Symbol('aggregationRouterFactory');

export { aggregationRouterFactory };

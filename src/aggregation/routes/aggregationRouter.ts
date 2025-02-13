import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { AggregationController } from '../controllers/aggregationController';
import { TransformerController } from '../controllers/transformerController';
import { ValidationsController } from '../controllers/validaitonsController';

const aggregationRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(AggregationController);
  const validations = dependencyContainer.resolve(ValidationsController);
  const transformer = dependencyContainer.resolve(TransformerController);

  router.get('/:polygonPartsEntityName', validations.validateGetAggregationLayerMetadata, transformer.parseGetAggregationLayerMetadata, controller.getAggregationLayerMetadata);

  return router;
};

export const AGGREGATION_ROUTER_SYMBOL = Symbol('aggregationRouterFactory');

export { aggregationRouterFactory };

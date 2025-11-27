import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { DatasetesController } from '../controllers/datesetsController';
import { TransformerController } from '../controllers/transformerController';
import { ValidationsController } from '../controllers/validationsController';

const datasetsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(DatasetesController);
  const validations = dependencyContainer.resolve(ValidationsController);
  const transformer = dependencyContainer.resolve(TransformerController);

  router.put('/:id', validations.validateUpsertDatasets, transformer.parseUpsertDatasets, controller.updatePolygonParts);

  return router;
};

export const DATASETS_ROUTER_SYMBOL = Symbol('datasetsRouterFactory');

export { datasetsRouterFactory };

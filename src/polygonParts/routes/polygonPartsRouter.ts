import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { PolygonPartsController } from '../controllers/polygonPartsController';
import { TransformerController } from '../controllers/transformerController';
import { ValidationsController } from '../controllers/validationsController';

const polygonPartsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(PolygonPartsController);
  const validations = dependencyContainer.resolve(ValidationsController);
  const transformer = dependencyContainer.resolve(TransformerController);

  router.post('/:polygonPartsEntityName/find', validations.validateFindPolygonParts, transformer.parseFindPolygonParts, controller.findPolygonParts);
  router.post('/', validations.validateCreatePolygonParts, transformer.parseCreatePolygonParts, controller.createPolygonParts);
  router.put('/', validations.validateUpdatePolygonParts, transformer.parseUpdatePolygonParts, controller.updatePolygonParts);

  return router;
};

export const POLYGON_PARTS_ROUTER_SYMBOL = Symbol('polygonPartsRouterFactory');

export { polygonPartsRouterFactory };
